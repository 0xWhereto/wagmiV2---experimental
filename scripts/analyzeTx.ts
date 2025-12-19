import { ethers } from "hardhat";

const TX_HASH = "0x584343341a342acec28312b9738165dc27aee77d59baaf305021f01fde6740a5";
const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");
  
  console.log("Fetching transaction...");
  const tx = await provider.getTransaction(TX_HASH);
  
  console.log("\n=== Transaction Details ===");
  console.log(`From: ${tx.from}`);
  console.log(`To: ${tx.to}`);
  console.log(`Value: ${ethers.utils.formatEther(tx.value)} S`);
  console.log(`Gas Limit: ${tx.gasLimit.toString()}`);
  
  console.log(`\nData (first 200 chars): ${tx.data.substring(0, 200)}`);
  console.log(`Function selector: ${tx.data.substring(0, 10)}`);
  
  // Get receipt
  const receipt = await provider.getTransactionReceipt(TX_HASH);
  console.log(`\nStatus: ${receipt.status === 1 ? "SUCCESS" : "FAILED"}`);
  console.log(`Gas Used: ${receipt.gasUsed.toString()}`);
  
  // Calculate function selectors for Hub functions
  const iface = new ethers.utils.Interface([
    "function bridgeTokens(address recipient, uint256 assets, uint32 dstEid, bytes options)",
    "function withdrawTo(address recipient, address token, uint256 amount, uint32 dstEid, bytes options)",
    "function quoteBridgeTokens(address syntheticToken, uint256 assets, uint32 dstEid, bytes options)",
  ]);
  
  console.log("\n=== Expected Function Selectors ===");
  console.log(`bridgeTokens: ${iface.getSighash("bridgeTokens")}`);
  console.log(`withdrawTo: 0x8ee9713b (from previous analysis)`);
  console.log(`quoteBridgeTokens: ${iface.getSighash("quoteBridgeTokens")}`);
  
  // Check if tx.to is Hub
  console.log(`\nTransaction sent to Hub: ${tx.to?.toLowerCase() === HUB_ADDRESS.toLowerCase()}`);
  
  // Try to decode the data
  const selector = tx.data.substring(0, 10);
  console.log(`\nActual selector: ${selector}`);
  
  // Check what functions exist in Hub
  const code = await provider.getCode(HUB_ADDRESS);
  console.log(`\nHub contains selector ${selector.substring(2)}: ${code.toLowerCase().includes(selector.substring(2).toLowerCase())}`);
}

main().catch(console.error);
