import { ethers } from "hardhat";

const TX_HASH = "0x7ad307b40580482d27d3a2513a412028e3d8ab76b636d836706af97ee664f0c1";

async function main() {
  console.log("=== CHECKING BRIDGE TX STATUS ===\n");
  
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  const receipt = await provider.getTransactionReceipt(TX_HASH);
  console.log(`TX: ${TX_HASH}`);
  console.log(`Status: ${receipt.status === 1 ? "✅ SUCCESS" : "❌ FAILED"}`);
  console.log(`Block: ${receipt.blockNumber}`);
  console.log(`Gas used: ${receipt.gasUsed.toString()}`);
  console.log(`Logs: ${receipt.logs.length}`);
  
  if (receipt.status === 1) {
    console.log("\nTransaction was successful on Arbitrum.");
    console.log("USDC should have been transferred to Gateway.");
    console.log("LayerZero message should have been sent.");
    
    // Check if there's a LayerZero event
    for (const log of receipt.logs) {
      console.log(`  Log from ${log.address.slice(0, 10)}...`);
    }
  }
}

main().catch(console.error);
