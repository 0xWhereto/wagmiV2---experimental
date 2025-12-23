import { ethers } from "hardhat";

const MIM_ADDRESS = "0x0462c2926DCb2e80891Bf31d28383C9b63bEcF8D";
const SUSDC_ADDRESS = "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`\n========================================`);
  console.log(`Testing MIM v2 (18 decimals)`);
  console.log(`========================================\n`);
  console.log(`Wallet: ${deployer.address}`);

  const mim = await ethers.getContractAt("MIM", MIM_ADDRESS);
  const sUSDC = await ethers.getContractAt("IERC20", SUSDC_ADDRESS);

  // Check balances before
  const sUSDCBefore = await sUSDC.balanceOf(deployer.address);
  const mimBefore = await mim.balanceOf(deployer.address);
  console.log(`\nBalances before:`);
  console.log(`  sUSDC: ${ethers.utils.formatUnits(sUSDCBefore, 6)}`);
  console.log(`  MIM:   ${ethers.utils.formatUnits(mimBefore, 18)}`);

  // Mint 10 MIM (requires 10 sUSDC)
  const mintAmount = ethers.utils.parseUnits("10", 6); // 10 sUSDC
  
  if (sUSDCBefore.lt(mintAmount)) {
    console.log(`\n❌ Insufficient sUSDC balance`);
    return;
  }

  // Approve MIM contract to spend sUSDC
  console.log(`\n1. Approving sUSDC for MIM contract...`);
  const approveTx = await sUSDC.approve(MIM_ADDRESS, mintAmount);
  await approveTx.wait();
  console.log(`   ✅ Approved`);

  // Mint MIM with sUSDC
  console.log(`\n2. Minting MIM with ${ethers.utils.formatUnits(mintAmount, 6)} sUSDC...`);
  try {
    const mintTx = await mim.mintWithUSDC(mintAmount, { gasLimit: 1000000 });
    await mintTx.wait();
    console.log(`   ✅ Minted successfully!`);
  } catch (e: any) {
    console.log(`   ❌ Mint failed: ${e.message}`);
    return;
  }

  // Check balances after
  const sUSDCAfter = await sUSDC.balanceOf(deployer.address);
  const mimAfter = await mim.balanceOf(deployer.address);
  console.log(`\nBalances after:`);
  console.log(`  sUSDC: ${ethers.utils.formatUnits(sUSDCAfter, 6)} (used ${ethers.utils.formatUnits(sUSDCBefore.sub(sUSDCAfter), 6)})`);
  console.log(`  MIM:   ${ethers.utils.formatUnits(mimAfter, 18)} (minted ${ethers.utils.formatUnits(mimAfter.sub(mimBefore), 18)})`);

  // Check MIM total supply
  const totalSupply = await mim.totalSupply();
  console.log(`\nMIM Total Supply: ${ethers.utils.formatUnits(totalSupply, 18)}`);

  // Check pool info
  try {
    const poolInfo = await mim.getLiquidityInfo();
    console.log(`\nLP Position Info:`);
    console.log(`  Position ID: ${poolInfo.positionId}`);
    console.log(`  Liquidity: ${poolInfo.liquidity}`);
    console.log(`  USDC in Pool: ${ethers.utils.formatUnits(poolInfo.usdcInPool, 6)}`);
    console.log(`  MIM in Pool: ${ethers.utils.formatUnits(poolInfo.mimInPool, 18)}`);
  } catch (e: any) {
    console.log(`\n⚠️ Could not get LP info: ${e.message?.slice(0, 50)}`);
  }

  console.log(`\n========================================`);
  console.log(`TEST COMPLETE`);
  console.log(`========================================\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

