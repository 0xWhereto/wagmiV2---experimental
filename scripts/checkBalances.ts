import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Wallet: ${deployer.address}\n`);

  const sUSDC = await ethers.getContractAt("IERC20", "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B");
  const mim = await ethers.getContractAt("MIM", "0xBeE5b0106d4DFc1AFcc9d105bd8dbeE3c4E53FA9");

  console.log("Your sUSDC balance:", ethers.utils.formatUnits(await sUSDC.balanceOf(deployer.address), 6));
  console.log("Your MIM balance:", ethers.utils.formatUnits(await mim.balanceOf(deployer.address), 6));
  console.log("sUSDC in MIM contract:", ethers.utils.formatUnits(await sUSDC.balanceOf(mim.address), 6));
  console.log("MIM total supply:", ethers.utils.formatUnits(await mim.totalSupply(), 6));
  console.log("MIM totalBacking:", ethers.utils.formatUnits(await mim.totalBacking(), 6));
}

main().catch(console.error);
