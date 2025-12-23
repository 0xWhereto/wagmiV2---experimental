import { ethers } from "hardhat";

async function main() {
  const provider = ethers.provider;
  
  const txHash = "0x969137c70d51116f7694be4edb7b3da4023e082b39ca6f7e8fae3450ff746446";
  
  console.log("Fetching transaction:", txHash);
  
  const tx = await provider.getTransaction(txHash);
  const receipt = await provider.getTransactionReceipt(txHash);
  
  console.log("\n=== Transaction Details ===");
  console.log("From:", tx?.from);
  console.log("To:", tx?.to);
  console.log("Value:", tx?.value?.toString());
  console.log("Status:", receipt?.status === 1 ? "SUCCESS" : "FAILED");
  console.log("Gas Used:", receipt?.gasUsed?.toString());
  
  if (receipt?.logs) {
    console.log("\n=== Logs ===");
    for (const log of receipt.logs) {
      console.log("Address:", log.address);
      console.log("Topics:", log.topics);
      console.log("Data:", log.data.slice(0, 100) + "...");
      console.log();
    }
  }
}

main().catch(console.error);
