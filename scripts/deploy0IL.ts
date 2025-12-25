import { ethers } from "hardhat";

/**
 * Deploy 0IL Protocol to Sonic
 * 
 * Deployment order:
 * 1. MIM (stablecoin)
 * 2. MIMStakingVault (sMIM)
 * 3. OracleAdapter (for sWETH/MIM)
 * 4. V3LPVault (Curve-style multi-layer LP)
 * 5. LeverageAMM (2x leverage engine)
 * 6. WToken (wETH receipt token)
 * 
 * Then wire them together and authorize contracts
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.utils.formatEther(balance), "S");

  // Sonic contract addresses
  const sUSDC = "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B";
  const sWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
  const sWBTC = "0x2F0324268031E6413280F3B5ddBc4A97639A284a";
  const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";
  const UNISWAP_V3_FACTORY = "0x3a1713B6C3734cfC883A3897647f3128Fe789f39";
  
  const TREASURY = deployer.address; // Use deployer as treasury for now

  console.log("\n========================================");
  console.log("DEPLOYING 0IL PROTOCOL");
  console.log("========================================\n");

  // ========================================
  // 1. Deploy MIM Stablecoin
  // ========================================
  console.log("1. Deploying MIM...");
  const MIM = await ethers.getContractFactory("contracts/0IL/core/MIM.sol:MIM");
  const mim = await MIM.deploy(sUSDC);
  await mim.deployed();
  console.log("   ✅ MIM deployed to:", mim.address);

  // ========================================
  // 2. Deploy MIMStakingVault (sMIM)
  // ========================================
  console.log("\n2. Deploying MIMStakingVault (sMIM)...");
  const MIMStakingVault = await ethers.getContractFactory("MIMStakingVault");
  const stakingVault = await MIMStakingVault.deploy(mim.address, TREASURY);
  await stakingVault.deployed();
  console.log("   ✅ MIMStakingVault deployed to:", stakingVault.address);

  // ========================================
  // 3. Create or get sWETH/MIM pool
  // ========================================
  console.log("\n3. Checking for sWETH/MIM V3 pool...");
  
  // First, we need to create the pool if it doesn't exist
  // For now, we'll skip pool creation and use a placeholder address
  // In production, you'd create the pool first
  
  // Use the factory to check if pool exists
  const factoryABI = [
    "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address)",
    "function createPool(address tokenA, address tokenB, uint24 fee) external returns (address)"
  ];
  const factory = new ethers.Contract(UNISWAP_V3_FACTORY, factoryABI, deployer);
  
  const FEE_TIER = 3000; // 0.3%
  let swethMimPool = await factory.getPool(sWETH, mim.address, FEE_TIER);
  
  if (swethMimPool === ethers.constants.AddressZero) {
    console.log("   Pool doesn't exist yet. Creating...");
    const createTx = await factory.createPool(sWETH, mim.address, FEE_TIER);
    await createTx.wait();
    swethMimPool = await factory.getPool(sWETH, mim.address, FEE_TIER);
    console.log("   ✅ sWETH/MIM pool created at:", swethMimPool);
    
    // Initialize the pool at ~$3370 price
    const poolABI = [
      "function initialize(uint160 sqrtPriceX96) external"
    ];
    const pool = new ethers.Contract(swethMimPool, poolABI, deployer);
    
    // For sWETH/MIM at $3370:
    // sqrtPriceX96 depends on token order
    // This needs to be calculated properly based on token0/token1
    const sqrtPriceX96 = BigInt("4614253070214989000000000000"); // Approximate
    try {
      await pool.initialize(sqrtPriceX96);
      console.log("   ✅ Pool initialized");
    } catch (e: any) {
      console.log("   ⚠️ Pool might already be initialized:", e.message);
    }
  } else {
    console.log("   ✅ sWETH/MIM pool exists at:", swethMimPool);
  }

  // ========================================
  // 4. Deploy OracleAdapter
  // ========================================
  console.log("\n4. Deploying OracleAdapter...");
  const OracleAdapter = await ethers.getContractFactory("OracleAdapter");
  const oracleAdapter = await OracleAdapter.deploy(
    swethMimPool,
    300 // 5-minute TWAP period
  );
  await oracleAdapter.deployed();
  console.log("   ✅ OracleAdapter deployed to:", oracleAdapter.address);

  // ========================================
  // 5. Deploy V3LPVault
  // ========================================
  console.log("\n5. Deploying V3LPVault...");
  const V3LPVault = await ethers.getContractFactory("V3LPVault");
  const v3LPVault = await V3LPVault.deploy(
    POSITION_MANAGER,
    swethMimPool
  );
  await v3LPVault.deployed();
  console.log("   ✅ V3LPVault deployed to:", v3LPVault.address);

  // Set default Curve-style layers
  console.log("   Setting default layers...");
  const setLayersTx = await v3LPVault.setDefaultLayers();
  await setLayersTx.wait();
  console.log("   ✅ Default layers configured (±0.5%, ±1%, ±2%, ±5%)");

  // ========================================
  // 6. Deploy LeverageAMM
  // ========================================
  console.log("\n6. Deploying LeverageAMM...");
  const LeverageAMM = await ethers.getContractFactory("LeverageAMM");
  const leverageAMM = await LeverageAMM.deploy(
    sWETH,
    mim.address,
    stakingVault.address,
    v3LPVault.address,
    oracleAdapter.address
  );
  await leverageAMM.deployed();
  console.log("   ✅ LeverageAMM deployed to:", leverageAMM.address);

  // Set treasury
  console.log("   Setting treasury...");
  const setTreasuryTx = await leverageAMM.setTreasury(TREASURY);
  await setTreasuryTx.wait();
  console.log("   ✅ Treasury set");

  // ========================================
  // 7. Deploy WToken (wETH)
  // ========================================
  console.log("\n7. Deploying WToken (wETH)...");
  const WToken = await ethers.getContractFactory("WToken");
  const wETH = await WToken.deploy(
    "Wrapped Zero-IL ETH",
    "wETH",
    sWETH,
    leverageAMM.address,
    v3LPVault.address
  );
  await wETH.deployed();
  console.log("   ✅ WToken (wETH) deployed to:", wETH.address);

  // ========================================
  // 8. Wire contracts together
  // ========================================
  console.log("\n8. Wiring contracts together...");

  // Set WToken in LeverageAMM
  console.log("   Setting WToken in LeverageAMM...");
  const setWTokenTx = await leverageAMM.setWToken(wETH.address);
  await setWTokenTx.wait();
  console.log("   ✅ WToken set in LeverageAMM");

  // Set LeverageAMM as operator in V3LPVault
  console.log("   Setting LeverageAMM as V3LPVault operator...");
  const setOperatorTx = await v3LPVault.setOperator(leverageAMM.address, true);
  await setOperatorTx.wait();
  console.log("   ✅ LeverageAMM authorized as V3LPVault operator");

  // Set LeverageAMM as borrower in MIMStakingVault
  console.log("   Setting LeverageAMM as authorized borrower...");
  const setBorrowerTx = await stakingVault.setBorrower(leverageAMM.address, true);
  await setBorrowerTx.wait();
  console.log("   ✅ LeverageAMM authorized as MIMStakingVault borrower");

  // Set MIM minter allowance for LeverageAMM (in case it needs to mint)
  // Actually, the protocol borrows from staking vault, not mints directly
  // Users mint MIM by depositing sUSDC

  // ========================================
  // SUMMARY
  // ========================================
  console.log("\n========================================");
  console.log("0IL PROTOCOL DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("\nContract Addresses:");
  console.log("─────────────────────────────────────────");
  console.log(`MIM (stablecoin):        ${mim.address}`);
  console.log(`MIMStakingVault (sMIM):  ${stakingVault.address}`);
  console.log(`sWETH/MIM Pool:          ${swethMimPool}`);
  console.log(`OracleAdapter:           ${oracleAdapter.address}`);
  console.log(`V3LPVault:               ${v3LPVault.address}`);
  console.log(`LeverageAMM:             ${leverageAMM.address}`);
  console.log(`WToken (wETH):           ${wETH.address}`);
  console.log("─────────────────────────────────────────");

  console.log("\n📋 Next Steps:");
  console.log("1. Mint MIM by depositing sUSDC");
  console.log("2. Stake MIM to get sMIM");
  console.log("3. Deposit sWETH to get wETH (zero-IL tokens)");
  console.log("4. Update frontend config with new addresses");

  // Return addresses for frontend config
  return {
    mim: mim.address,
    stakingVault: stakingVault.address,
    swethMimPool: swethMimPool,
    oracleAdapter: oracleAdapter.address,
    v3LPVault: v3LPVault.address,
    leverageAMM: leverageAMM.address,
    wETH: wETH.address,
  };
}

main()
  .then((addresses) => {
    console.log("\n\nAddresses for config.ts:");
    console.log(JSON.stringify(addresses, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });


