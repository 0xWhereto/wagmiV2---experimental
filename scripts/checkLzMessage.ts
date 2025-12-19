import { ethers } from "hardhat";

// Check the transaction from LayerZero scan
const TX_HASH = "0x04c5e609b43b43e899b0640882bce2bf31b17777c615d2616b67843241f2ecd6";

async function main() {
  // Check which chain this tx is from based on the gateway used
  const arbProvider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  const ethProvider = new ethers.providers.JsonRpcProvider("https://ethereum-rpc.publicnode.com");
  
  console.log("=== Checking Transaction ===\n");
  
  // Try Arbitrum first
  try {
    const tx = await arbProvider.getTransaction(TX_HASH);
    if (tx) {
      console.log("Found on Arbitrum!");
      console.log(`From: ${tx.from}`);
      console.log(`To: ${tx.to}`);
      console.log(`Value: ${ethers.utils.formatEther(tx.value)} ETH`);
      console.log(`Block: ${tx.blockNumber}`);
      
      const receipt = await arbProvider.getTransactionReceipt(TX_HASH);
      console.log(`Status: ${receipt?.status === 1 ? "✅ Success" : "❌ Failed"}`);
      console.log(`Logs: ${receipt?.logs.length}`);
      return;
    }
  } catch (e) {
    console.log("Not on Arbitrum");
  }
  
  // Try Ethereum
  try {
    const tx = await ethProvider.getTransaction(TX_HASH);
    if (tx) {
      console.log("Found on Ethereum!");
      console.log(`From: ${tx.from}`);
      console.log(`To: ${tx.to}`);
      console.log(`Value: ${ethers.utils.formatEther(tx.value)} ETH`);
      console.log(`Block: ${tx.blockNumber}`);
      
      const receipt = await ethProvider.getTransactionReceipt(TX_HASH);
      console.log(`Status: ${receipt?.status === 1 ? "✅ Success" : "❌ Failed"}`);
      return;
    }
  } catch (e) {
    console.log("Not on Ethereum");
  }
  
  console.log("Transaction not found on Arbitrum or Ethereum");
}

main().catch(console.error);
