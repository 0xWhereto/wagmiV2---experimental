import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const ORACLE = "0xD8680463F66C7bF74C61A2660aF4d7094ee9F749";
const V3LP_VAULT = "0x1139d155D39b2520047178444C51D3D70204650F";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== v15 (fix double-counting) ===\n");

  // Drain existing
  const v3 = new ethers.Contract(V3LP_VAULT, [
    "function removeLiquidity(uint256, uint256, uint256) returns (uint256, uint256)",
    "function setOperator(address, bool) external"
  ], signer);
  try {
    await (await v3.removeLiquidity(10000, 0, 0, { gasLimit: 1000000 })).wait();
  } catch {}

  // Deploy
  const LeverageAMM = await ethers.getContractFactory("LeverageAMM");
  const amm = await LeverageAMM.deploy(SWETH, MIM, STAKING_VAULT, V3LP_VAULT, ORACLE);
  await amm.deployed();
  console.log("LeverageAMM:", amm.address);

  const WToken = await ethers.getContractFactory("WToken");
  const wToken = await WToken.deploy("wETH Zero-IL", "wETH", SWETH, amm.address, V3LP_VAULT);
  await wToken.deployed();
  console.log("WToken:", wToken.address);

  await (await amm.setWToken(wToken.address)).wait();

  const stakingVault = new ethers.Contract(STAKING_VAULT, ["function setBorrower(address, bool) external"], signer);
  const OLD = "0xbA9C438EFE27112A82291BA816cF15CE6aF3DccE";
  try { await (await stakingVault.setBorrower(OLD, false)).wait(); } catch {}
  try { await (await v3.setOperator(OLD, false)).wait(); } catch {}

  await (await stakingVault.setBorrower(amm.address, true)).wait();
  await (await v3.setOperator(amm.address, true)).wait();

  console.log(`\n  leverageAMM: "${amm.address}",\n  wETH: "${wToken.address}",`);
}
main().catch(console.error);
