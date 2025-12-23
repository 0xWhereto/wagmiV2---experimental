import { ethers } from "hardhat";

// Existing contracts
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const V3LP_VAULT = "0x1139d155D39b2520047178444C51D3D70204650F";
const ORACLE = "0xD8680463F66C7bF74C61A2660aF4d7094ee9F749";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Deploying LeverageAMM v11 (with swap fix) ===\n");
  console.log("Deployer:", signer.address);

  // Step 1: Deploy new LeverageAMM
  console.log("\n--- Deploying LeverageAMM ---");
  const LeverageAMM = await ethers.getContractFactory("LeverageAMM");
  const leverageAMM = await LeverageAMM.deploy(
    SWETH,           // _underlyingAsset
    MIM,             // _mim
    STAKING_VAULT,   // _stakingVault
    V3LP_VAULT,      // _v3LPVault
    ORACLE           // _oracle
  );
  await leverageAMM.deployed();
  console.log("LeverageAMM deployed to:", leverageAMM.address);

  // Step 2: Deploy new WToken
  console.log("\n--- Deploying WToken ---");
  const WToken = await ethers.getContractFactory("WToken");
  const wToken = await WToken.deploy(
    "wETH Zero-IL",     // name
    "wETH",             // symbol
    SWETH,              // _underlyingAsset
    leverageAMM.address, // _leverageAMM
    V3LP_VAULT          // _v3LPVault
  );
  await wToken.deployed();
  console.log("WToken deployed to:", wToken.address);

  // Step 3: Configure
  console.log("\n--- Configuring ---");
  await (await leverageAMM.setWToken(wToken.address)).wait();
  console.log("wToken set in LeverageAMM");

  // Permissions
  const stakingVault = new ethers.Contract(STAKING_VAULT, [
    "function setBorrower(address, bool) external"
  ], signer);
  
  const v3Vault = new ethers.Contract(V3LP_VAULT, [
    "function setOperator(address, bool) external"
  ], signer);

  // Revoke old permissions
  const OLD_AMM = "0x81513AFec6B50073dE566C95B6140f21b67B6091";
  console.log("\nRevoking old LeverageAMM permissions...");
  try {
    await (await stakingVault.setBorrower(OLD_AMM, false)).wait();
    await (await v3Vault.setOperator(OLD_AMM, false)).wait();
    console.log("Old permissions revoked");
  } catch (e: any) {
    console.log("Could not revoke:", e.message?.slice(0, 100));
  }

  // Set new permissions
  console.log("\nSetting new permissions...");
  await (await stakingVault.setBorrower(leverageAMM.address, true)).wait();
  await (await v3Vault.setOperator(leverageAMM.address, true)).wait();
  console.log("New permissions set");

  console.log("\n=== Deployment Complete ===");
  console.log("\nNew Addresses:");
  console.log("  LeverageAMM:", leverageAMM.address);
  console.log("  wETH (WToken):", wToken.address);
  
  console.log("\nUpdate frontend with:");
  console.log(`  leverageAMM: "${leverageAMM.address}",`);
  console.log(`  wETH: "${wToken.address}",`);
}

main().catch(console.error);
