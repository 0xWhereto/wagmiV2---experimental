import { ethers } from "hardhat";

// Existing infrastructure (DO NOT CHANGE)
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const STAKING_VAULT = "0xbDbad1ae9b2bA67a1e0d8e6dD8EECf4a7a52C8d5";
const SIMPLE_ORACLE = "0xb09aEeBE0E3DfCA9F8fEa8F050F7d4b5F70DCf20";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const SWETH_MIM_POOL = "0x4ed3B3e2AD7e19124D921fE2F6956e1C62Cbf190"; // 0.05% fee
const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Deploy Fresh 0IL Stack v16 ===");
  console.log("Deployer:", signer.address);
  console.log("");

  // 1. Deploy new V3LPVault
  console.log("1. Deploying V3LPVault...");
  const V3LPVault = await ethers.getContractFactory("V3LPVault");
  const v3Vault = await V3LPVault.deploy(
    SWETH_MIM_POOL,
    POSITION_MANAGER
  );
  await v3Vault.deployed();
  console.log("   V3LPVault:", v3Vault.address);

  // 2. Deploy LeverageAMM
  console.log("2. Deploying LeverageAMM...");
  const LeverageAMM = await ethers.getContractFactory("LeverageAMM");
  const leverageAMM = await LeverageAMM.deploy(
    SWETH,        // underlying
    MIM,          // mim
    STAKING_VAULT,// staking vault
    v3Vault.address,
    SIMPLE_ORACLE,// oracle
    true          // underlyingIsToken0 (sWETH is token0 in pool)
  );
  await leverageAMM.deployed();
  console.log("   LeverageAMM:", leverageAMM.address);

  // 3. Deploy WToken
  console.log("3. Deploying WToken...");
  const WToken = await ethers.getContractFactory("WToken");
  const wToken = await WToken.deploy(
    SWETH,
    "Wagmi Zero-IL ETH",
    "wETH",
    leverageAMM.address,
    v3Vault.address
  );
  await wToken.deployed();
  console.log("   WToken:", wToken.address);

  // 4. Configure V3LPVault
  console.log("4. Configuring V3LPVault...");
  // Set LeverageAMM as operator
  await (await v3Vault.setOperator(leverageAMM.address, true)).wait();
  console.log("   LeverageAMM set as operator");

  // Set default layers
  await (await v3Vault.setDefaultLayers()).wait();
  console.log("   Default layers set");

  // 5. Configure LeverageAMM
  console.log("5. Configuring LeverageAMM...");
  await (await leverageAMM.setWToken(wToken.address)).wait();
  console.log("   WToken set");

  // 6. Authorize LeverageAMM as borrower in StakingVault
  console.log("6. Authorizing LeverageAMM as borrower...");
  const stakingVault = new ethers.Contract(STAKING_VAULT, [
    "function authorizeBorrower(address, bool) external",
    "function authorizedBorrowers(address) view returns (bool)"
  ], signer);
  
  await (await stakingVault.authorizeBorrower(leverageAMM.address, true)).wait();
  console.log("   LeverageAMM authorized");

  // 7. Verify configuration
  console.log("\n=== Verification ===");
  const ammWToken = await leverageAMM.wToken();
  const v3Operator = await v3Vault.isOperator(leverageAMM.address);
  const authorized = await stakingVault.authorizedBorrowers(leverageAMM.address);
  
  console.log("LeverageAMM.wToken:", ammWToken, ammWToken === wToken.address ? "✅" : "❌");
  console.log("V3LPVault.isOperator(AMM):", v3Operator ? "✅" : "❌");
  console.log("StakingVault.authorized(AMM):", authorized ? "✅" : "❌");

  // Print deployment summary
  console.log("\n=== Deployment Summary (v16) ===");
  console.log("V3LPVault:", v3Vault.address);
  console.log("LeverageAMM:", leverageAMM.address);
  console.log("WToken:", wToken.address);
  console.log("");
  console.log("Update frontend config.ts with:");
  console.log(`  v3LPVault: "${v3Vault.address}",`);
  console.log(`  leverageAMM: "${leverageAMM.address}",`);
  console.log(`  wETH: "${wToken.address}",`);
}

main().catch(console.error);


