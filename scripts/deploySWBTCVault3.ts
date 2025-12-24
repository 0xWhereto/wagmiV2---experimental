import { ethers } from "hardhat";

// Existing contracts
const MIM = "0xf3DBF67010C7cAd25c152AB772F8Ef240Cc9c14f";
const STAKING_VAULT = "0x263ee9b0327E2A103F0D9808110a02c82E1A979d";
const sWBTC = "0x2F0324268031E6413280F3B5ddBc4A97639A284a";

// Already deployed in previous steps
const sWBTC_MIM_POOL = "0x930a91b74Cd3e70f9F18ED98A8311Ade347f6Bd0";
const WBTC_ORACLE = "0xAb8adE53A4Ba00B2bb857F7f2B0d67a1BB1A124F";
const WBTC_V3_VAULT = "0x81A8A7DF164F40f56e3dED6eD3a5cC75a9f79Cb9";

async function main() {
  console.log("=== Continue sWBTC Zero-IL Vault Deployment (Step 5+) ===\n");
  
  // ========== STEP 5: Deploy LeverageAMMV2 for sWBTC ==========
  console.log("5. Deploying LeverageAMMV2 for sWBTC...");
  
  // Constructor: _underlyingAsset, _mim, _stakingVault, _v3LPVault, _oracle
  const LeverageAMM = await ethers.getContractFactory("LeverageAMMV2");
  const wbtcLeverageAMM = await LeverageAMM.deploy(
    sWBTC,                    // underlying
    MIM,                      // mim
    STAKING_VAULT,            // stakingVault
    WBTC_V3_VAULT,            // v3LPVault
    WBTC_ORACLE               // oracle
  );
  await wbtcLeverageAMM.deployed();
  console.log("   LeverageAMMV2 deployed:", wbtcLeverageAMM.address);
  
  // Check underlyingIsToken0
  const underlyingIsToken0 = await wbtcLeverageAMM.underlyingIsToken0();
  console.log("   underlyingIsToken0:", underlyingIsToken0);
  
  // ========== STEP 6: Deploy WToken (wBTC) ==========
  console.log("\n6. Deploying WToken (wBTC)...");
  
  const WToken = await ethers.getContractFactory("WToken");
  const wBTC = await WToken.deploy(
    "Wrapped Zero-IL BTC",    // name
    "wBTC",                   // symbol
    sWBTC,                    // underlying
    wbtcLeverageAMM.address,  // leverageAMM
    WBTC_V3_VAULT             // v3LPVault
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
  const v3VaultABI = ["function setOperator(address operator, bool allowed) external"];
  const v3Vault = await ethers.getContractAt(v3VaultABI, WBTC_V3_VAULT);
  const addOpTx = await v3Vault.setOperator(wbtcLeverageAMM.address, true);
  await addOpTx.wait();
  
  // Add LeverageAMM as borrower in StakingVault
  console.log("   Adding LeverageAMM as borrower in StakingVault...");
  const stakingABI = ["function setBorrower(address borrower, bool allowed) external"];
  const stakingVault = await ethers.getContractAt(stakingABI, STAKING_VAULT);
  const setBorrowerTx = await stakingVault.setBorrower(wbtcLeverageAMM.address, true);
  await setBorrowerTx.wait();
  
  console.log("   All configurations complete!");
  
  // ========== SUMMARY ==========
  console.log("\n========== DEPLOYMENT SUMMARY ==========");
  console.log("sWBTC/MIM Pool:", sWBTC_MIM_POOL);
  console.log("SimpleOracle (sWBTC):", WBTC_ORACLE);
  console.log("V3LPVault (sWBTC/MIM):", WBTC_V3_VAULT);
  console.log("LeverageAMMV2 (sWBTC):", wbtcLeverageAMM.address);
  console.log("WToken (wBTC):", wBTC.address);
}

main().catch(console.error);
