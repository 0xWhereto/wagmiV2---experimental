import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const ORACLE = "0xD8680463F66C7bF74C61A2660aF4d7094ee9F749";
const V3LP_VAULT = "0x1139d155D39b2520047178444C51D3D70204650F";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Deploying v14 (dust threshold fix) ===\n");

  // First drain existing liquidity
  const v3 = new ethers.Contract(V3LP_VAULT, [
    "function removeLiquidity(uint256, uint256, uint256) returns (uint256, uint256)",
    "function setOperator(address, bool) external"
  ], signer);

  console.log("Draining existing liquidity...");
  try {
    await (await v3.removeLiquidity(10000, 0, 0, { gasLimit: 1000000 })).wait();
    console.log("Drained");
  } catch (e: any) {
    console.log("Drain failed or nothing to drain:", e.message?.slice(0, 50));
  }

  // Deploy new LeverageAMM
  console.log("\nDeploying LeverageAMM v14...");
  const LeverageAMM = await ethers.getContractFactory("LeverageAMM");
  const amm = await LeverageAMM.deploy(SWETH, MIM, STAKING_VAULT, V3LP_VAULT, ORACLE);
  await amm.deployed();
  console.log("LeverageAMM:", amm.address);

  // Deploy WToken
  console.log("Deploying WToken...");
  const WToken = await ethers.getContractFactory("WToken");
  const wToken = await WToken.deploy("wETH Zero-IL", "wETH", SWETH, amm.address, V3LP_VAULT);
  await wToken.deployed();
  console.log("WToken:", wToken.address);

  // Configure
  await (await amm.setWToken(wToken.address)).wait();

  const stakingVault = new ethers.Contract(STAKING_VAULT, [
    "function setBorrower(address, bool) external"
  ], signer);

  // Revoke old
  const OLD_AMM = "0x2E711256BaEa3A127C9E903898AD77C8ce5Ed9A9";
  try {
    await (await stakingVault.setBorrower(OLD_AMM, false)).wait();
    await (await v3.setOperator(OLD_AMM, false)).wait();
  } catch {}

  // Set new
  await (await stakingVault.setBorrower(amm.address, true)).wait();
  await (await v3.setOperator(amm.address, true)).wait();

  console.log("\n=== v14 Deployed ===");
  console.log(`  leverageAMM: "${amm.address}",`);
  console.log(`  wETH: "${wToken.address}",`);
}

main().catch(console.error);
