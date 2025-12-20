import { ethers } from "hardhat";

const GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const USER = "0x4151E05ABe56192e2A6775612C2020509Fd50637";

async function main() {
  console.log("=== RESCUING 30 USDC FROM ARBITRUM GATEWAY ===\n");
  
  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);
  
  // Check gateway balance
  const usdc = await ethers.getContractAt("IERC20", USDC);
  const gatewayBalance = await usdc.balanceOf(GATEWAY);
  console.log(`Gateway USDC balance: ${ethers.utils.formatUnits(gatewayBalance, 6)} USDC`);
  
  // Check user balance before
  const userBalanceBefore = await usdc.balanceOf(USER);
  console.log(`User USDC balance before: ${ethers.utils.formatUnits(userBalanceBefore, 6)} USDC`);
  
  const gatewayAbi = [
    "function rescueTokens(address _tokenAddress, address _to, uint256 _amount) external",
    "function owner() view returns (address)",
  ];
  
  const gateway = new ethers.Contract(GATEWAY, gatewayAbi, signer);
  
  const owner = await gateway.owner();
  console.log(`\nGateway owner: ${owner}`);
  console.log(`Is signer owner: ${owner.toLowerCase() === signer.address.toLowerCase()}`);
  
  const amountToRescue = ethers.utils.parseUnits("30", 6);
  
  console.log(`\nRescuing ${ethers.utils.formatUnits(amountToRescue, 6)} USDC to ${USER}...`);
  const tx = await gateway.rescueTokens(USDC, USER, amountToRescue);
  console.log(`TX: ${tx.hash}`);
  await tx.wait();
  console.log("✅ Rescued!");
  
  // Check user balance after
  const userBalanceAfter = await usdc.balanceOf(USER);
  console.log(`\nUser USDC balance after: ${ethers.utils.formatUnits(userBalanceAfter, 6)} USDC`);
}

main().catch(console.error);
