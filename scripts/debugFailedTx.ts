import { ethers } from "hardhat";

const TX_HASH = "0x8c95f8908997ec957b0ea6cb73df0f5b11e9646754b98f35654b502178816489";
const ARBITRUM_RPC = "https://arb1.arbitrum.io/rpc";

// Expected Gateway address
const EXPECTED_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";

async function main() {
  console.log("=== DEBUGGING FAILED TX ===\n");
  
  const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
  
  try {
    // Get transaction
    const tx = await provider.getTransaction(TX_HASH);
    console.log("1. TRANSACTION DETAILS:");
    console.log(`   Hash: ${tx.hash}`);
    console.log(`   Block: ${tx.blockNumber}`);
    console.log(`   From: ${tx.from}`);
    console.log(`   To: ${tx.to}`);
    console.log(`   Value: ${ethers.utils.formatEther(tx.value)} ETH`);
    console.log(`   Data length: ${tx.data.length} chars`);
    
    // Check if it went to the right gateway
    console.log(`\n   Expected Gateway: ${EXPECTED_GATEWAY}`);
    console.log(`   TX Target: ${tx.to}`);
    console.log(`   Match: ${tx.to?.toLowerCase() === EXPECTED_GATEWAY.toLowerCase()}`);
    
    // Get receipt
    const receipt = await provider.getTransactionReceipt(TX_HASH);
    console.log(`\n2. RECEIPT:`);
    console.log(`   Status: ${receipt.status === 1 ? "✅ Success" : "❌ Failed"}`);
    console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
    console.log(`   Logs: ${receipt.logs.length}`);
    
    if (receipt.status === 0) {
      console.log("\n3. ATTEMPTING TO GET REVERT REASON...");
      try {
        // Try to simulate the transaction to get the revert reason
        const code = await provider.call({
          to: tx.to,
          from: tx.from,
          data: tx.data,
          value: tx.value,
          gasLimit: tx.gasLimit,
        }, tx.blockNumber);
        console.log("   Call succeeded (unexpected):", code);
      } catch (error: any) {
        console.log("   Revert reason:", error.reason || error.message);
        if (error.data) {
          console.log("   Error data:", error.data);
        }
      }
    }
    
    // Decode the function call
    console.log("\n4. DECODING FUNCTION CALL...");
    const gatewayAbi = [
      "function deposit(address _recepient, tuple(address tokenAddress, uint256 tokenAmount)[] _assets, bytes _options) payable",
    ];
    const iface = new ethers.utils.Interface(gatewayAbi);
    
    try {
      const decoded = iface.parseTransaction({ data: tx.data, value: tx.value });
      console.log(`   Function: ${decoded.name}`);
      console.log(`   Recipient: ${decoded.args._recepient}`);
      console.log(`   Assets: ${JSON.stringify(decoded.args._assets.map((a: any) => ({
        token: a.tokenAddress,
        amount: a.tokenAmount.toString()
      })))}`);
      console.log(`   Options: ${decoded.args._options}`);
    } catch (e: any) {
      console.log("   Could not decode as deposit:", e.message);
      // Try to get the function selector
      const selector = tx.data.slice(0, 10);
      console.log(`   Function selector: ${selector}`);
    }
    
    // Check logs for events
    if (receipt.logs.length > 0) {
      console.log("\n5. EVENT LOGS:");
      for (const log of receipt.logs) {
        console.log(`   Contract: ${log.address}`);
        console.log(`   Topics: ${log.topics.join(", ")}`);
        console.log(`   Data: ${log.data.slice(0, 100)}...`);
        console.log("   ---");
      }
    }
    
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

main().catch(console.error);
