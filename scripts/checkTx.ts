import { ethers } from "hardhat";

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");
  const receipt = await provider.getTransactionReceipt("0x1faf5dc499ed6e53abba986eb5b618a46042a71a8fc79f6d77abb6d08b85613f");
  
  if (receipt) {
    console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
    console.log("Contract Address:", receipt.contractAddress);
    console.log("Gas Used:", receipt.gasUsed.toString());
  } else {
    console.log("Transaction not found or pending");
  }
}

main().catch(console.error);
