import { ethers } from "hardhat";

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");
  const receipt = await provider.getTransactionReceipt("0xc258ff33cc6ffb44d360aa19136457c9751118c2278812d7e586d0a79a64d005");
  
  if (receipt) {
    console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
    console.log("Contract Address:", receipt.contractAddress);
    console.log("Gas Used:", receipt.gasUsed.toString());
    console.log("Block:", receipt.blockNumber);
  } else {
    console.log("Transaction not found or pending");
  }
}

main().catch(console.error);
