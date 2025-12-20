import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const USER = "0x4151E05ABe56192e2A6775612C2020509Fd50637";
const ARB_EID = 30110;
const USDC_ARB = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // USDC on Arbitrum

async function main() {
  console.log("=== RESCUING 30 USDC FROM ARBITRUM GATEWAY ===\n");
  
  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);
  
  const hub = await ethers.getContractAt("SyntheticTokenHub", HUB);
  
  const owner = await hub.owner();
  console.log(`Hub owner: ${owner}`);
  console.log(`Is signer owner: ${owner.toLowerCase() === signer.address.toLowerCase()}`);
  
  // Build LZ options
  const lzOptions = ethers.utils.solidityPack(
    ["uint16", "uint8", "uint16", "uint8", "uint128"],
    [3, 1, 17, 1, 500000]
  );
  
  const amountToRescue = ethers.utils.parseUnits("30", 6); // 30 USDC
  
  const assets = [{
    tokenAddress: USDC_ARB, // The token address on Arbitrum
    tokenAmount: amountToRescue
  }];
  
  console.log(`\nRescuing ${ethers.utils.formatUnits(amountToRescue, 6)} USDC to ${USER}`);
  
  // Quote the rescue
  console.log("\nQuoting rescue...");
  const quote = await hub.quoteAdminRescue(ARB_EID, USER, assets, lzOptions);
  console.log(`LZ fee: ${ethers.utils.formatEther(quote)} S`);
  
  // Add 10% buffer
  const fee = quote.mul(110).div(100);
  
  // Execute rescue
  console.log("\nExecuting rescue...");
  const tx = await hub.adminRescueFromGateway(ARB_EID, USER, assets, lzOptions, { value: fee });
  console.log(`TX: ${tx.hash}`);
  console.log(`https://sonicscan.org/tx/${tx.hash}`);
  
  await tx.wait();
  console.log("✅ Rescue message sent!");
  console.log("\nWait ~2-5 minutes for LayerZero to deliver to Arbitrum.");
  console.log(`Check LZ: https://layerzeroscan.com/tx/${tx.hash}`);
}

main().catch(console.error);
