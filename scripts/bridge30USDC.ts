import { ethers } from "hardhat";

const GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const USER = "0x4151E05ABe56192e2A6775612C2020509Fd50637";

async function main() {
  console.log("=== BRIDGING 30 USDC FROM ARBITRUM TO SONIC ===\n");
  
  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);
  
  // Check USDC balance
  const usdc = await ethers.getContractAt("IERC20", USDC);
  const balance = await usdc.balanceOf(signer.address);
  console.log(`USDC balance: ${ethers.utils.formatUnits(balance, 6)} USDC`);
  
  const amountToBridge = ethers.utils.parseUnits("30", 6);
  console.log(`Amount to bridge: 30 USDC`);
  
  if (balance.lt(amountToBridge)) {
    console.log("❌ Insufficient USDC balance");
    return;
  }
  
  // Build LZ options
  const lzOptions = ethers.utils.solidityPack(
    ["uint16", "uint8", "uint16", "uint8", "uint128"],
    [3, 1, 17, 1, 500000]
  );
  
  const assets = [{
    tokenAddress: USDC,
    tokenAmount: amountToBridge
  }];
  
  // Use hardcoded fee (typical LZ fee is ~0.001 ETH, using 0.002 for safety)
  const fee = ethers.utils.parseEther("0.002");
  console.log(`Using fee: ${ethers.utils.formatEther(fee)} ETH`);
  
  const gatewayAbi = [
    "function deposit(address _recipient, tuple(address tokenAddress, uint256 tokenAmount)[] _assets, bytes _options) payable"
  ];
  
  const gateway = new ethers.Contract(GATEWAY, gatewayAbi, signer);
  
  console.log("\nExecuting deposit...");
  const tx = await gateway.deposit(USER, assets, lzOptions, { value: fee });
  console.log(`TX: ${tx.hash}`);
  console.log(`https://arbiscan.io/tx/${tx.hash}`);
  
  await tx.wait();
  console.log("✅ Deposit transaction confirmed on Arbitrum!");
  console.log("\nWait ~2-5 minutes for LayerZero to deliver the message to Sonic.");
  console.log(`Check LZ: https://layerzeroscan.com/tx/${tx.hash}`);
}

main().catch(console.error);
