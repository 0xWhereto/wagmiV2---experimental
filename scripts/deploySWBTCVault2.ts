import { ethers } from "hardhat";

// Existing contracts
const MIM = "0xf3DBF67010C7cAd25c152AB772F8Ef240Cc9c14f";
const STAKING_VAULT = "0x263ee9b0327E2A103F0D9808110a02c82E1A979d";
const sWBTC = "0x2F0324268031E6413280F3B5ddBc4A97639A284a";
const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";

// Already created pool
const sWBTC_MIM_POOL = "0x930a91b74Cd3e70f9F18ED98A8311Ade347f6Bd0";

async function main() {
  console.log("=== Continue sWBTC Zero-IL Vault Deployment ===\n");
  
  const [signer] = await ethers.getSigners();
  console.log("Deployer:", signer.address);
  
  // Check pool token ordering
  const poolABI = [
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function slot0() view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)"
  ];
  const pool = await ethers.getContractAt(poolABI, sWBTC_MIM_POOL);
  const token0 = await pool.token0();
  const token1 = await pool.token1();
  const [sqrtPriceX96, tick] = await pool.slot0();
  
  console.log("Pool token0:", token0);
  console.log("Pool token1:", token1);
  console.log("Pool tick:", tick);
  
  const sWBTCIsToken0 = token0.toLowerCase() === sWBTC.toLowerCase();
  console.log("sWBTC is token0:", sWBTCIsToken0);
  
  // ========== STEP 3: Deploy SimpleOracle for sWBTC ==========
  console.log("\n3. Deploying SimpleOracle for sWBTC/MIM...");
  
  const SimpleOracle = await ethers.getContractFactory("SimpleOracle");
  const wbtcOracle = await SimpleOracle.deploy(sWBTC_MIM_POOL);
  await wbtcOracle.deployed();
  console.log("   SimpleOracle deployed:", wbtcOracle.address);
  
  // Oracle returns price in token1/token0
  // If sWBTC is token0, price = MIM per sWBTC (correct)
  // If MIM is token0, price = sWBTC per MIM (need to invert)
  if (!sWBTCIsToken0) {
    console.log("   Inverting oracle price (MIM is token0)...");
    const invertTx = await wbtcOracle.setInvertPrice(true);
    await invertTx.wait();
  }
  
  // Test oracle
  const oraclePrice = await wbtcOracle.getPrice();
  console.log("   Oracle price:", ethers.utils.formatUnits(oraclePrice, 18), "MIM per sWBTC");
  
  // ========== STEP 4: Deploy V3LPVault for sWBTC/MIM ==========
  console.log("\n4. Deploying V3LPVault for sWBTC/MIM...");
  
  const V3LPVault = await ethers.getContractFactory("V3LPVault");
  const wbtcV3Vault = await V3LPVault.deploy(POSITION_MANAGER, sWBTC_MIM_POOL);
  await wbtcV3Vault.deployed();
  console.log("   V3LPVault deployed:", wbtcV3Vault.address);
  
  // Set default layers
  console.log("   Setting default layers...");
  const setLayersTx = await wbtcV3Vault.setDefaultLayers();
  await setLayersTx.wait();
  console.log("   Layers configured!");
  
  // ========== STEP 5: Deploy LeverageAMMV2 for sWBTC ==========
  console.log("\n5. Deploying LeverageAMMV2 for sWBTC...");
  
  const LeverageAMM = await ethers.getContractFactory("LeverageAMMV2");
  const wbtcLeverageAMM = await LeverageAMM.deploy(
    sWBTC,                    // underlying
    MIM,                      // mim
    wbtcOracle.address,       // oracle
    wbtcV3Vault.address,      // v3LPVault
    STAKING_VAULT,            // stakingVault
    sWBTCIsToken0             // underlyingIsToken0
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
  console.log("sWBTC/MIM Pool:", sWBTC_MIM_POOL);
  console.log("SimpleOracle (sWBTC):", wbtcOracle.address);
  console.log("V3LPVault (sWBTC/MIM):", wbtcV3Vault.address);
  console.log("LeverageAMMV2 (sWBTC):", wbtcLeverageAMM.address);
  console.log("WToken (wBTC):", wBTC.address);
}

main().catch(console.error);
