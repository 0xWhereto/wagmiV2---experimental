import { ethers } from "hardhat";

// Existing contracts
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const V3LP_VAULT = "0x1139d155D39b2520047178444C51D3D70204650F";
const ORACLE = "0xD8680463F66C7bF74C61A2660aF4d7094ee9F749";

// New LeverageAMM just deployed
const NEW_LEVERAGE_AMM = "0x81513AFec6B50073dE566C95B6140f21b67B6091";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Continue: Deploy WToken and Configure ===\n");
  console.log("Deployer:", signer.address);
  console.log("LeverageAMM:", NEW_LEVERAGE_AMM);

  // Step 2: Deploy new WToken
  console.log("\n--- Deploying new WToken ---");
  const WToken = await ethers.getContractFactory("WToken");
  const wToken = await WToken.deploy(
    "wETH Zero-IL",     // name
    "wETH",             // symbol
    SWETH,              // _underlyingAsset
    NEW_LEVERAGE_AMM,   // _leverageAMM
    V3LP_VAULT          // _v3LPVault
  );
  await wToken.deployed();
  console.log("New WToken deployed to:", wToken.address);

  // Step 3: Set wToken in LeverageAMM
  console.log("\n--- Configuring LeverageAMM ---");
  const leverageAMM = new ethers.Contract(NEW_LEVERAGE_AMM, [
    "function setWToken(address) external",
    "function wToken() view returns (address)"
  ], signer);
  
  await (await leverageAMM.setWToken(wToken.address)).wait();
  console.log("wToken set in LeverageAMM");

  // Step 4: Authorize LeverageAMM as borrower in StakingVault
  console.log("\n--- Setting up permissions ---");
  const stakingVault = new ethers.Contract(STAKING_VAULT, [
    "function setBorrower(address, bool) external",
    "function isBorrower(address) view returns (bool)"
  ], signer);
  
  await (await stakingVault.setBorrower(NEW_LEVERAGE_AMM, true)).wait();
  console.log("LeverageAMM authorized as borrower in StakingVault");

  // Step 5: Set LeverageAMM as operator in V3LPVault
  const v3Vault = new ethers.Contract(V3LP_VAULT, [
    "function setOperator(address, bool) external",
    "function isOperator(address) view returns (bool)"
  ], signer);
  
  await (await v3Vault.setOperator(NEW_LEVERAGE_AMM, true)).wait();
  console.log("LeverageAMM set as operator in V3LPVault");

  // Revoke old LeverageAMM's permissions
  const OLD_LEVERAGE_AMM = "0x8CA24d00ffcF60e9ba7F67F9d41ccA28E22dF508";
  console.log("\n--- Revoking old LeverageAMM permissions ---");
  try {
    await (await stakingVault.setBorrower(OLD_LEVERAGE_AMM, false)).wait();
    console.log("Old LeverageAMM removed as borrower");
  } catch (e: any) {
    console.log("Could not revoke old borrower:", e.message?.slice(0, 100));
  }
  try {
    await (await v3Vault.setOperator(OLD_LEVERAGE_AMM, false)).wait();
    console.log("Old LeverageAMM removed as operator");
  } catch (e: any) {
    console.log("Could not revoke old operator:", e.message?.slice(0, 100));
  }

  console.log("\n=== Deployment Complete ===");
  console.log("\nNew Addresses:");
  console.log("  LeverageAMM:", NEW_LEVERAGE_AMM);
  console.log("  wETH (WToken):", wToken.address);
  
  console.log("\nUpdate frontend config with:");
  console.log(`  leverageAMM: "${NEW_LEVERAGE_AMM}",`);
  console.log(`  wETH: "${wToken.address}",`);
}

main().catch(console.error);
