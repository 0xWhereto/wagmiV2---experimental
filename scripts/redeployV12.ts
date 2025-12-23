import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const V3LP_VAULT = "0x1139d155D39b2520047178444C51D3D70204650F";
const ORACLE = "0xD8680463F66C7bF74C61A2660aF4d7094ee9F749";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Deploying LeverageAMM v12 (callback swap) ===\n");

  // Deploy LeverageAMM
  const LeverageAMM = await ethers.getContractFactory("LeverageAMM");
  const amm = await LeverageAMM.deploy(SWETH, MIM, STAKING_VAULT, V3LP_VAULT, ORACLE);
  await amm.deployed();
  console.log("LeverageAMM:", amm.address);

  // Deploy WToken
  const WToken = await ethers.getContractFactory("WToken");
  const wToken = await WToken.deploy("wETH Zero-IL", "wETH", SWETH, amm.address, V3LP_VAULT);
  await wToken.deployed();
  console.log("WToken:", wToken.address);

  // Configure
  await (await amm.setWToken(wToken.address)).wait();

  // Permissions
  const stakingVault = new ethers.Contract(STAKING_VAULT, [
    "function setBorrower(address, bool) external"
  ], signer);
  const v3Vault = new ethers.Contract(V3LP_VAULT, [
    "function setOperator(address, bool) external"
  ], signer);

  // Revoke old
  const OLD = "0xd9bFC26be5FC0cD2eae8264736423099640aDc5a";
  await (await stakingVault.setBorrower(OLD, false)).wait();
  await (await v3Vault.setOperator(OLD, false)).wait();

  // Set new
  await (await stakingVault.setBorrower(amm.address, true)).wait();
  await (await v3Vault.setOperator(amm.address, true)).wait();

  console.log("\nNew addresses:");
  console.log(`  leverageAMM: "${amm.address}",`);
  console.log(`  wETH: "${wToken.address}",`);
}

main().catch(console.error);
