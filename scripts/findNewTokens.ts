import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

// Transaction hashes from the creation
const TX_HASHES = [
  "0xa9d5e54500b36fb2478c3f42db484c5eadea08d946c3ae86a3eaf4fd38b74544", // sUSDC_new
  "0xc7360fbf6eb83f73b367794eab9fa2e49e2a63d90ad1bc8c5852823bec01902d", // sWETH_new
  "0x7d44caa64d1a483ea69fa3e906c6c6dc38968deb231dd72ade24c8742c36102c", // sWBTC_new
];

async function main() {
  console.log("=== Find New Token Addresses ===");
  
  for (const txHash of TX_HASHES) {
    console.log(`\nProcessing ${txHash}...`);
    const receipt = await ethers.provider.getTransactionReceipt(txHash);
    
    // Look for any log that might contain the token address
    for (const log of receipt.logs) {
      if (log.address !== HUB_ADDRESS) {
        // This is likely the synthetic token being deployed
        console.log("  Synthetic token address:", log.address);
        break;
      }
    }
  }
}

main().catch(console.error);
