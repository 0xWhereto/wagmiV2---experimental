import { ethers } from "hardhat";

const MIM_ADDRESS = "0xBeE5b0106d4DFc1AFcc9d105bd8dbeE3c4E53FA9";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`\nRedeeming MIM for sUSDC...`);
  console.log(`Wallet: ${deployer.address}\n`);

  const mim = await ethers.getContractAt("MIM", MIM_ADDRESS);
  
  // Check MIM balance
  const mimBalance = await mim.balanceOf(deployer.address);
  console.log(`Your MIM Balance: ${ethers.utils.formatUnits(mimBalance, 6)} MIM`);
  
  if (mimBalance.eq(0)) {
    console.log("No MIM to redeem.");
    return;
  }

  // Check sUSDC address
  const sUSDCAddress = await mim.sUSDC();
  const sUSDC = await ethers.getContractAt("IERC20", sUSDCAddress);
  
  // Check sUSDC balance before
  const sUSDCBefore = await sUSDC.balanceOf(deployer.address);
  console.log(`sUSDC Balance Before: ${ethers.utils.formatUnits(sUSDCBefore, 6)} sUSDC`);

  // Redeem all MIM for sUSDC
  console.log(`\nRedeeming ${ethers.utils.formatUnits(mimBalance, 6)} MIM for sUSDC...`);
  const tx = await mim.redeemForSUSDC(mimBalance);
  console.log(`Transaction: ${tx.hash}`);
  await tx.wait();
  console.log("✅ Redeemed successfully!");

  // Check sUSDC balance after
  const sUSDCAfter = await sUSDC.balanceOf(deployer.address);
  console.log(`\nsUSDC Balance After: ${ethers.utils.formatUnits(sUSDCAfter, 6)} sUSDC`);
  console.log(`MIM Balance After: ${ethers.utils.formatUnits(await mim.balanceOf(deployer.address), 6)} MIM`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

