import { ethers } from "hardhat";

// Existing deployed addresses
const DEPLOYED = {
  MIM: "0x0462c2926DCb2e80891Bf31d28383C9b63bEcF8D",
  STAKING_VAULT: "0x5E0453350dA7F94259FA84BcF140606A2e86706B",
  SWETH_MIM_POOL: "0xF6126331eb757475e2B29D858770cBb3D902D91c",
  ORACLE: "0x7C431B67d912a7a4937c936d17fAE30A6003Be37",
  V3LP_VAULT: "0x590EE27e4dCECdf484c5dDbC2b7047164E65dB04",
  WETH: "0x94a3b6B5DFf4F862985b38AD673541D5a50E0fB7",
  SWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  TREASURY: "0x4151E05ABe56192e2A6775612C2020509Fd50637",
};

async function main() {
  console.log("========================================");
  console.log("Redeploying LeverageAMM with Token Ordering Fix");
  console.log("========================================\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("");

  // 1. Deploy new LeverageAMM
  console.log("1. Deploying new LeverageAMM...");
  const LeverageAMM = await ethers.getContractFactory("LeverageAMM");
  const leverageAMM = await LeverageAMM.deploy(
    DEPLOYED.SWETH,           // underlying asset
    DEPLOYED.MIM,             // MIM token
    DEPLOYED.STAKING_VAULT,   // staking vault
    DEPLOYED.V3LP_VAULT,      // V3 LP vault
    DEPLOYED.ORACLE           // oracle
  );
  await leverageAMM.deployed();
  console.log("   LeverageAMM deployed to:", leverageAMM.address);

  // Verify token ordering
  const underlyingIsToken0 = await leverageAMM.underlyingIsToken0();
  console.log("   underlyingIsToken0:", underlyingIsToken0);
  console.log("   (sWETH address:", DEPLOYED.SWETH, ")");
  console.log("   (MIM address:", DEPLOYED.MIM, ")");
  console.log("   Expected: false (since MIM < sWETH by address)");

  // 2. Set wToken in new LeverageAMM
  console.log("\n2. Setting wToken in LeverageAMM...");
  const setWTokenTx = await leverageAMM.setWToken(DEPLOYED.WETH);
  await setWTokenTx.wait();
  console.log("   ✅ wToken set");

  // 3. Set treasury
  console.log("\n3. Setting treasury...");
  const setTreasuryTx = await leverageAMM.setTreasury(DEPLOYED.TREASURY);
  await setTreasuryTx.wait();
  console.log("   ✅ Treasury set");

  // 4. Update StakingVault to authorize new LeverageAMM as borrower
  console.log("\n4. Authorizing new LeverageAMM as borrower in StakingVault...");
  const stakingVault = await ethers.getContractAt("MIMStakingVault", DEPLOYED.STAKING_VAULT);
  const setBorrowerTx = await stakingVault.setBorrower(leverageAMM.address, true);
  await setBorrowerTx.wait();
  console.log("   ✅ LeverageAMM authorized as borrower");

  // 5. Update V3LPVault to authorize new LeverageAMM as operator
  console.log("\n5. Authorizing new LeverageAMM as operator in V3LPVault...");
  const v3LPVault = await ethers.getContractAt("V3LPVault", DEPLOYED.V3LP_VAULT);
  const setOperatorTx = await v3LPVault.setOperator(leverageAMM.address, true);
  await setOperatorTx.wait();
  console.log("   ✅ LeverageAMM authorized as operator");

  // 6. Deploy new WToken pointing to new LeverageAMM
  console.log("\n6. Deploying new WToken...");
  const WToken = await ethers.getContractFactory("WToken");
  const wToken = await WToken.deploy(
    "Zero-IL Wrapped ETH",
    "wETH",
    DEPLOYED.SWETH,           // underlying asset (sWETH)
    leverageAMM.address,      // NEW LeverageAMM
    DEPLOYED.V3LP_VAULT       // V3 LP vault
  );
  await wToken.deployed();
  console.log("   wETH Token deployed to:", wToken.address);

  // 7. Update LeverageAMM to point to new WToken
  console.log("\n7. Updating LeverageAMM's wToken reference...");
  const updateWTokenTx = await leverageAMM.setWToken(wToken.address);
  await updateWTokenTx.wait();
  console.log("   ✅ WToken reference updated");

  console.log("\n========================================");
  console.log("DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("");
  console.log("New contract addresses for frontend config.ts:");
  console.log(`  leverageAMM: "${leverageAMM.address}",`);
  console.log(`  wETH: "${wToken.address}",`);
  console.log("");
  console.log("Test the deposit with the updated addresses!");
}

main().catch(console.error);

