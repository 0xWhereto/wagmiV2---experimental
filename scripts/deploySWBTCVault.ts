import { ethers } from "hardhat";

// Existing contracts
const MIM = "0xf3DBF67010C7cAd25c152AB772F8Ef240Cc9c14f";
const STAKING_VAULT = "0x263ee9b0327E2A103F0D9808110a02c82E1A979d";
const sWBTC = "0x2F0324268031E6413280F3B5ddBc4A97639A284a";
const UNISWAP_FACTORY = "0x3a1713B6C3734cfC883A3897647f3128Fe789f39";
const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";
const OWNER = "0x4151E05ABe56192e2A6775612C2020509Fd50637";

async function main() {
  console.log("=== Deploy sWBTC Zero-IL Vault Infrastructure ===\n");
  
  const [signer] = await ethers.getSigners();
  console.log("Deployer:", signer.address);
  
  // ========== STEP 1: Create sWBTC/MIM Pool ==========
  console.log("\n1. Creating sWBTC/MIM pool...");
  
  const factoryABI = [
    "function createPool(address tokenA, address tokenB, uint24 fee) external returns (address pool)",
    "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
  ];
  const factory = await ethers.getContractAt(factoryABI, UNISWAP_FACTORY);
  
  // Use 0.01% fee for MIM pairs
  const FEE = 100;
  let poolAddress = await factory.getPool(sWBTC, MIM, FEE);
  
  if (poolAddress === "0x0000000000000000000000000000000000000000") {
    console.log("   Creating new pool...");
    const tx = await factory.createPool(sWBTC, MIM, FEE);
    await tx.wait();
    poolAddress = await factory.getPool(sWBTC, MIM, FEE);
    console.log("   Pool created:", poolAddress);
  } else {
    console.log("   Pool already exists:", poolAddress);
  }
  
  // ========== STEP 2: Initialize Pool with Price ==========
  console.log("\n2. Initializing pool with correct price...");
  
  const poolABI = [
    "function initialize(uint160 sqrtPriceX96) external",
    "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
    "function token0() view returns (address)",
    "function token1() view returns (address)"
  ];
  const pool = await ethers.getContractAt(poolABI, poolAddress);
  
  const token0 = await pool.token0();
  const token1 = await pool.token1();
  console.log("   Token0:", token0);
  console.log("   Token1:", token1);
  
  // Determine if MIM is token0 or token1
  const mimIsToken0 = token0.toLowerCase() === MIM.toLowerCase();
  console.log("   MIM is token0:", mimIsToken0);
  
  // sWBTC has 8 decimals, MIM has 18 decimals
  // BTC price ~$95,000, so 1 sWBTC = 95000 MIM
  // If MIM is token0: price = sWBTC/MIM = 1/95000 in raw = 1e8 / (95000 * 1e18) = 1e8 / 95e21 ≈ 1.05e-15
  // If sWBTC is token0: price = MIM/sWBTC = 95000 in raw = 95000 * 1e18 / 1e8 = 95e21 / 1e8 = 9.5e17
  
  let isInitialized = false;
  try {
    const slot0 = await pool.slot0();
    if (slot0.sqrtPriceX96.gt(0)) {
      console.log("   Pool already initialized");
      console.log("   Current tick:", slot0.tick);
      isInitialized = true;
    }
  } catch {
    isInitialized = false;
  }
  
  if (!isInitialized) {
    // sqrtPriceX96 = sqrt(price) * 2^96
    // For BTC at $95000:
    let sqrtPriceX96;
    if (mimIsToken0) {
      // MIM is token0, sWBTC is token1: price = sWBTC/MIM in raw units
      // 1 sWBTC (1e8) = 95000 MIM (95000e18)
      // price = 1e8 / 95000e18 = 1e8 / 9.5e22 ≈ 1.05e-15
      // sqrt(1.05e-15) ≈ 3.24e-8
      // sqrtPriceX96 = 3.24e-8 * 2^96 ≈ 2.57e21
      sqrtPriceX96 = ethers.BigNumber.from("2565726409233066901504"); // sqrt(1e8/(95000*1e18)) * 2^96
    } else {
      // sWBTC is token0, MIM is token1: price = MIM/sWBTC in raw units
      // 95000 MIM (95000e18) = 1 sWBTC (1e8)
      // price = 95000e18 / 1e8 = 9.5e17
      // sqrt(9.5e17) ≈ 9.75e8
      // sqrtPriceX96 = 9.75e8 * 2^96 ≈ 7.72e37
      sqrtPriceX96 = ethers.BigNumber.from("77220094381018860003442484338688"); // sqrt(95000*1e18/1e8) * 2^96
    }
    
    console.log("   Initializing with sqrtPriceX96:", sqrtPriceX96.toString());
    const initTx = await pool.initialize(sqrtPriceX96);
    await initTx.wait();
    console.log("   Pool initialized!");
  }
  
  // Verify pool state
  const slot0 = await pool.slot0();
  console.log("   Current tick:", slot0.tick);
  
  // ========== STEP 3: Deploy SimpleOracle for sWBTC ==========
  console.log("\n3. Deploying SimpleOracle for sWBTC/MIM...");
  
  const SimpleOracle = await ethers.getContractFactory("SimpleOracle");
  const wbtcOracle = await SimpleOracle.deploy(poolAddress, sWBTC);
  await wbtcOracle.deployed();
  console.log("   SimpleOracle deployed:", wbtcOracle.address);
  
  // Test oracle
  const oraclePrice = await wbtcOracle.getPrice();
  console.log("   Oracle price:", ethers.utils.formatUnits(oraclePrice, 18), "MIM per sWBTC");
  
  // ========== STEP 4: Deploy V3LPVault for sWBTC/MIM ==========
  console.log("\n4. Deploying V3LPVault for sWBTC/MIM...");
  
  const V3LPVault = await ethers.getContractFactory("V3LPVault");
  const wbtcV3Vault = await V3LPVault.deploy(POSITION_MANAGER, poolAddress);
  await wbtcV3Vault.deployed();
  console.log("   V3LPVault deployed:", wbtcV3Vault.address);
  
  // Set default layers
  console.log("   Setting default layers...");
  const setLayersTx = await wbtcV3Vault.setDefaultLayers();
  await setLayersTx.wait();
  console.log("   Layers configured!");
  
  // ========== STEP 5: Deploy LeverageAMMV2 for sWBTC ==========
  console.log("\n5. Deploying LeverageAMMV2 for sWBTC...");
  
  // Determine if sWBTC is token0
  const underlyingIsToken0 = token0.toLowerCase() === sWBTC.toLowerCase();
  console.log("   sWBTC is token0:", underlyingIsToken0);
  
  const LeverageAMM = await ethers.getContractFactory("LeverageAMMV2");
  const wbtcLeverageAMM = await LeverageAMM.deploy(
    sWBTC,                    // underlying
    MIM,                      // mim
    wbtcOracle.address,       // oracle
    wbtcV3Vault.address,      // v3LPVault
    STAKING_VAULT,            // stakingVault
    underlyingIsToken0        // underlyingIsToken0
  );
  await wbtcLeverageAMM.deployed();
  console.log("   LeverageAMMV2 deployed:", wbtcLeverageAMM.address);
  
  // ========== STEP 6: Deploy WToken (wBTC) ==========
  console.log("\n6. Deploying WToken (wBTC)...");
  
  const WToken = await ethers.getContractFactory("WToken");
  const wBTC = await WToken.deploy(
    "Wrapped Zero-IL BTC",    // name
    "wBTC",                   // symbol
    sWBTC,                    // underlying
    wbtcLeverageAMM.address,  // leverageAMM
    wbtcV3Vault.address       // v3LPVault
  );
  await wBTC.deployed();
  console.log("   WToken (wBTC) deployed:", wBTC.address);
  
  // ========== STEP 7: Configure Contracts ==========
  console.log("\n7. Configuring contracts...");
  
  // Set WToken in LeverageAMM
  console.log("   Setting WToken in LeverageAMM...");
  const setWTokenTx = await wbtcLeverageAMM.setWToken(wBTC.address);
  await setWTokenTx.wait();
  
  // Add LeverageAMM as operator in V3LPVault
  console.log("   Adding LeverageAMM as operator in V3LPVault...");
  const addOpTx = await wbtcV3Vault.setOperator(wbtcLeverageAMM.address, true);
  await addOpTx.wait();
  
  // Add LeverageAMM as borrower in StakingVault
  console.log("   Adding LeverageAMM as borrower in StakingVault...");
  const stakingABI = [
    "function setBorrower(address borrower, bool allowed) external"
  ];
  const stakingVault = await ethers.getContractAt(stakingABI, STAKING_VAULT);
  const setBorrowerTx = await stakingVault.setBorrower(wbtcLeverageAMM.address, true);
  await setBorrowerTx.wait();
  
  console.log("   All configurations complete!");
  
  // ========== SUMMARY ==========
  console.log("\n========== DEPLOYMENT SUMMARY ==========");
  console.log("sWBTC/MIM Pool:", poolAddress);
  console.log("SimpleOracle (sWBTC):", wbtcOracle.address);
  console.log("V3LPVault (sWBTC/MIM):", wbtcV3Vault.address);
  console.log("LeverageAMMV2 (sWBTC):", wbtcLeverageAMM.address);
  console.log("WToken (wBTC):", wBTC.address);
  console.log("\n========== UPDATE FRONTEND ==========");
  console.log("Add these to MAGICPOOL_ADDRESSES:");
  console.log(`  wBTC: "${wBTC.address}" as \`0x\${string}\`,`);
  console.log(`  sWBTCMIMPool: "${poolAddress}" as \`0x\${string}\`,`);
  console.log(`  wBTCOracle: "${wbtcOracle.address}" as \`0x\${string}\`,`);
  console.log(`  wBTCV3Vault: "${wbtcV3Vault.address}" as \`0x\${string}\`,`);
  console.log(`  wBTCLeverageAMM: "${wbtcLeverageAMM.address}" as \`0x\${string}\`,`);
}

main().catch(console.error);
