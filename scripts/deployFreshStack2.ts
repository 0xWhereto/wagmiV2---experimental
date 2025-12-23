import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const ORACLE = "0xD8680463F66C7bF74C61A2660aF4d7094ee9F749";
const POOL = "0x4ed3B3e2AD7e19124D921fE2F6956e1C62Cbf190";
const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Deploying Fresh Stack v13 ===\n");

  // Use existing V3LPVault but empty it first
  const OLD_V3 = "0x1139d155D39b2520047178444C51D3D70204650F";
  
  console.log("Using existing (drained) V3LPVault:", OLD_V3);

  // Deploy new LeverageAMM pointing to old V3LPVault
  console.log("\nDeploying LeverageAMM...");
  const LeverageAMM = await ethers.getContractFactory("LeverageAMM");
  const amm = await LeverageAMM.deploy(SWETH, MIM, STAKING_VAULT, OLD_V3, ORACLE);
  await amm.deployed();
  console.log("LeverageAMM:", amm.address);

  // Deploy WToken
  console.log("\nDeploying WToken...");
  const WToken = await ethers.getContractFactory("WToken");
  const wToken = await WToken.deploy("wETH Zero-IL", "wETH", SWETH, amm.address, OLD_V3);
  await wToken.deployed();
  console.log("WToken:", wToken.address);

  // Configure
  console.log("\nConfiguring...");
  await (await amm.setWToken(wToken.address)).wait();
  
  const stakingVault = new ethers.Contract(STAKING_VAULT, [
    "function setBorrower(address, bool) external"
  ], signer);
  const v3Vault = new ethers.Contract(OLD_V3, [
    "function setOperator(address, bool) external"
  ], signer);

  // Revoke old
  const OLD_AMM = "0x7bFddcb8fD2A4A7621f4505Ba896a99B2DeD5a3E";
  try {
    await (await stakingVault.setBorrower(OLD_AMM, false)).wait();
    await (await v3Vault.setOperator(OLD_AMM, false)).wait();
  } catch {}

  // Set new
  await (await stakingVault.setBorrower(amm.address, true)).wait();
  await (await v3Vault.setOperator(amm.address, true)).wait();

  console.log("\n=== Done ===");
  console.log(`  v3LPVault: "${OLD_V3}",`);
  console.log(`  leverageAMM: "${amm.address}",`);
  console.log(`  wETH: "${wToken.address}",`);
}

main().catch(console.error);
