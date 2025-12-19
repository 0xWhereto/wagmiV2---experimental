import { ethers } from "hardhat";

const TX_HASH = "0x149fd13ad40089d2f39aa13d5703450cb158c58b91c18f66e09de57deb8b2f81";

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  console.log("=== Debugging Failed TX ===\n");
  
  const tx = await provider.getTransaction(TX_HASH);
  const receipt = await provider.getTransactionReceipt(TX_HASH);
  
  console.log(`From: ${tx.from}`);
  console.log(`To: ${tx.to}`);
  console.log(`Value: ${ethers.utils.formatEther(tx.value)} ETH`);
  console.log(`Status: ${receipt.status === 1 ? "✅ Success" : "❌ Failed"}`);
  console.log(`Gas Used: ${receipt.gasUsed.toString()}`);
  console.log(`Gas Limit: ${tx.gasLimit.toString()}`);
  
  // Decode the function call
  const selector = tx.data.slice(0, 10);
  console.log(`\nFunction selector: ${selector}`);
  
  // Check known selectors
  const selectors: Record<string, string> = {
    "0xca588d8b": "linkTokenToHub",
    "0x47e7ef24": "deposit(address,uint256)",
    "0xb6b55f25": "deposit(uint256)",
  };
  
  console.log(`Function: ${selectors[selector] || "unknown"}`);
  
  // Try to simulate to get error
  console.log("\nSimulating call to get error...");
  try {
    await provider.call({
      from: tx.from,
      to: tx.to,
      data: tx.data,
      value: tx.value,
    }, tx.blockNumber! - 1);
    console.log("Simulation passed (strange...)");
  } catch (e: any) {
    console.log(`Error: ${e.reason || e.message?.substring(0, 200)}`);
  }
}

main().catch(console.error);
