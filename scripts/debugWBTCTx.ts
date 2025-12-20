import { ethers } from "hardhat";

const TX_HASH = "0x06b5fb26c8c35c1517840e0d4720959e8155eeabfadc50de64e19c4e189111db";

async function main() {
  console.log("=== DEBUGGING WBTC TX ===\n");
  
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  // Get transaction
  const tx = await provider.getTransaction(TX_HASH);
  console.log("Transaction:");
  console.log(`  To: ${tx.to}`);
  console.log(`  From: ${tx.from}`);
  console.log(`  Value: ${ethers.utils.formatEther(tx.value)} ETH`);
  console.log(`  Data: ${tx.data?.slice(0, 50)}...`);
  
  // Get receipt
  const receipt = await provider.getTransactionReceipt(TX_HASH);
  console.log(`\nReceipt:`);
  console.log(`  Status: ${receipt.status === 1 ? "SUCCESS" : "FAILED"}`);
  console.log(`  Gas used: ${receipt.gasUsed.toString()}`);
  console.log(`  Logs: ${receipt.logs.length}`);
  
  if (receipt.status === 0) {
    console.log("\n❌ Transaction FAILED");
    
    // Try to get revert reason
    try {
      const code = await provider.call({
        to: tx.to,
        from: tx.from,
        data: tx.data,
        value: tx.value,
      }, tx.blockNumber);
      console.log("Call result:", code);
    } catch (e: any) {
      console.log("Revert reason:", e.reason || e.message?.slice(0, 200));
    }
  } else {
    console.log("\n✅ Transaction succeeded on Arbitrum");
    console.log("Check LayerZero scan for delivery status:");
    console.log(`https://layerzeroscan.com/tx/${TX_HASH}`);
  }
  
  // Decode the function call
  const gatewayAbi = [
    "function deposit(address _recipient, tuple(address tokenAddress, uint256 tokenAmount)[] _assets, bytes _options) payable",
  ];
  const iface = new ethers.utils.Interface(gatewayAbi);
  
  try {
    const decoded = iface.parseTransaction({ data: tx.data!, value: tx.value });
    console.log("\nDecoded call:");
    console.log(`  Function: ${decoded.name}`);
    console.log(`  Recipient: ${decoded.args._recipient}`);
    console.log(`  Assets:`);
    for (const asset of decoded.args._assets) {
      console.log(`    Token: ${asset.tokenAddress}`);
      console.log(`    Amount: ${asset.tokenAmount}`);
    }
  } catch (e) {
    console.log("Could not decode transaction data");
  }
}

main().catch(console.error);
