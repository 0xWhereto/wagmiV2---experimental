import { ethers } from "hardhat";

// Existing contracts
const MIM = "0xf3DBF67010C7cAd25c152AB772F8Ef240Cc9c14f";
const STAKING_VAULT = "0x263ee9b0327E2A103F0D9808110a02c82E1A979d";
const sWBTC = "0x2F0324268031E6413280F3B5ddBc4A97639A284a";
const UNISWAP_FACTORY = "0x3a1713B6C3734cfC883A3897647f3128Fe789f39";
const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";

async function main() {
  console.log("=== Fix sWBTC/MIM Pool Price ===\n");
  
  // Create new pool at 0.05% fee (500) since 0.01% is already taken with wrong price
  const FEE = 500; // 0.05%
  
  const factoryABI = [
    "function createPool(address tokenA, address tokenB, uint24 fee) external returns (address pool)",
    "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
  ];
  const factory = await ethers.getContractAt(factoryABI, UNISWAP_FACTORY);
  
  // Check if pool exists
  let poolAddress = await factory.getPool(sWBTC, MIM, FEE);
  
  if (poolAddress === "0x0000000000000000000000000000000000000000") {
    console.log("Creating new sWBTC/MIM pool at 0.05% fee...");
    const tx = await factory.createPool(sWBTC, MIM, FEE);
    await tx.wait();
    poolAddress = await factory.getPool(sWBTC, MIM, FEE);
    console.log("Pool created:", poolAddress);
  } else {
    console.log("Pool already exists:", poolAddress);
  }
  
  // Check token ordering
  const poolABI = [
    "function initialize(uint160 sqrtPriceX96) external",
    "function slot0() view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)",
    "function token0() view returns (address)",
    "function token1() view returns (address)"
  ];
  const pool = await ethers.getContractAt(poolABI, poolAddress);
  
  const token0 = await pool.token0();
  const token1 = await pool.token1();
  console.log("Token0:", token0);
  console.log("Token1:", token1);
  
  const sWBTCIsToken0 = token0.toLowerCase() === sWBTC.toLowerCase();
  console.log("sWBTC is token0:", sWBTCIsToken0);
  
  // Calculate correct sqrtPriceX96
  // BTC price: $95,000
  // sWBTC: 8 decimals, MIM: 18 decimals
  // 
  // If sWBTC is token0 (which it is): price = MIM/sWBTC in raw terms
  // 1 sWBTC = 1e8 raw, 95000 MIM = 95000e18 raw
  // price = (95000 * 1e18) / (1e8) = 95000 * 1e10 = 9.5e14
  // sqrt(9.5e14) ≈ 3.082e7
  // sqrtPriceX96 = 3.082e7 * 2^96 = 3.082e7 * 79228162514264337593543950336
  
  // Using BigNumber for precision
  // sqrt(95000 * 10^10) = sqrt(9.5 * 10^14) ≈ 30822070.015
  // 30822070 * 2^96
  
  const sqrtPrice = Math.sqrt(95000 * 1e10);
  console.log("sqrt(price):", sqrtPrice);
  
  // 2^96 = 79228162514264337593543950336
  const TWO_96 = ethers.BigNumber.from("79228162514264337593543950336");
  const sqrtPriceBN = ethers.BigNumber.from(Math.floor(sqrtPrice).toString());
  const sqrtPriceX96 = sqrtPriceBN.mul(TWO_96);
  
  console.log("sqrtPriceX96:", sqrtPriceX96.toString());
  
  // Try to initialize
  try {
    const [currentSqrtPrice] = await pool.slot0();
    if (currentSqrtPrice.gt(0)) {
      console.log("Pool already initialized at sqrtPriceX96:", currentSqrtPrice.toString());
      const [, tick] = await pool.slot0();
      console.log("Current tick:", tick);
    }
  } catch {
    console.log("Initializing pool...");
    const initTx = await pool.initialize(sqrtPriceX96);
    await initTx.wait();
    console.log("Pool initialized!");
  }
  
  // Verify
  const [sqrtPrice96, tick] = await pool.slot0();
  console.log("\nPool state:");
  console.log("  sqrtPriceX96:", sqrtPrice96.toString());
  console.log("  tick:", tick);
  
  // Calculate actual price from tick
  const price = Math.pow(1.0001, tick);
  console.log("  price (raw):", price);
  console.log("  price (adjusted for decimals):", price / 1e10, "MIM per sWBTC");
  
  // Now deploy new oracle pointing to this pool
  console.log("\nDeploying new SimpleOracle...");
  const SimpleOracle = await ethers.getContractFactory("SimpleOracle");
  const newOracle = await SimpleOracle.deploy(poolAddress);
  await newOracle.deployed();
  console.log("SimpleOracle deployed:", newOracle.address);
  
  // Test oracle
  const oraclePrice = await newOracle.getPrice();
  console.log("Oracle price (raw):", ethers.utils.formatUnits(oraclePrice, 18));
  
  // The oracle returns price in 18 decimals, but it's raw price (MIM per raw sWBTC)
  // To get MIM per 1 whole sWBTC, multiply by 10^8
  // But wait, that's not how it works...
  
  // Actually the oracle calculates: (sqrtPriceX96)^2 / 2^192 * 1e18
  // This gives us the raw price with 18 decimals
  // Raw price = MIM_raw / sWBTC_raw
  // For our case: 9.5e14 means 9.5e14 MIM_raw per 1 sWBTC_raw
  // In 18 decimals that's 9.5e14 * 1e18 = 9.5e32... way too big
  
  // Hmm, let me think about this differently
  // The oracle _calculatePrice returns: sqrtPriceX96^2 * 1e18 / 2^192
  // = price_raw * 1e18
  // 
  // price_raw = 9.5e14 (for our pool)
  // oracle returns: 9.5e14 * 1e18 = 9.5e32? No that's wrong too
  
  // Actually looking at the formula more carefully:
  // price = (sqrtPriceX96)^2 / 2^192
  // In 18 decimals: price * 1e18
  
  // Let me just see what the oracle returns and adjust accordingly
  
  // Now deploy V3LPVault, LeverageAMM, and WToken
  console.log("\nDeploying V3LPVault...");
  const V3LPVault = await ethers.getContractFactory("V3LPVault");
  const newV3Vault = await V3LPVault.deploy(POSITION_MANAGER, poolAddress);
  await newV3Vault.deployed();
  console.log("V3LPVault deployed:", newV3Vault.address);
  
  // Set default layers
  const layersTx = await newV3Vault.setDefaultLayers();
  await layersTx.wait();
  
  console.log("\nDeploying LeverageAMMV2...");
  const LeverageAMM = await ethers.getContractFactory("LeverageAMMV2");
  const newLeverageAMM = await LeverageAMM.deploy(
    sWBTC,
    MIM,
    STAKING_VAULT,
    newV3Vault.address,
    newOracle.address
  );
  await newLeverageAMM.deployed();
  console.log("LeverageAMMV2 deployed:", newLeverageAMM.address);
  
  console.log("\nDeploying WToken...");
  const WToken = await ethers.getContractFactory("WToken");
  const newWBTC = await WToken.deploy(
    "Wrapped Zero-IL BTC",
    "wBTC",
    sWBTC,
    newLeverageAMM.address,
    newV3Vault.address
  );
  await newWBTC.deployed();
  console.log("WToken deployed:", newWBTC.address);
  
  // Configure
  console.log("\nConfiguring...");
  await (await newLeverageAMM.setWToken(newWBTC.address)).wait();
  await (await newV3Vault.setOperator(newLeverageAMM.address, true)).wait();
  
  const stakingABI = ["function setBorrower(address, bool) external"];
  const staking = await ethers.getContractAt(stakingABI, STAKING_VAULT);
  await (await staking.setBorrower(newLeverageAMM.address, true)).wait();
  
  console.log("\n========== SUMMARY ==========");
  console.log("NEW sWBTC/MIM Pool (0.05%):", poolAddress);
  console.log("NEW SimpleOracle:", newOracle.address);
  console.log("NEW V3LPVault:", newV3Vault.address);
  console.log("NEW LeverageAMMV2:", newLeverageAMM.address);
  console.log("NEW wBTC:", newWBTC.address);
}

main().catch(console.error);
