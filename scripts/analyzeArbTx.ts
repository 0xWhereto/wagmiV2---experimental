import { ethers } from "hardhat";

const TX_HASH = "0xe97f55509a966a2787189e74fbe093b060a8b0e5582408fd8b67d3fbe6ad53a5";
const GATEWAY_ADDRESS = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  console.log("Fetching Arbitrum transaction...");
  const tx = await provider.getTransaction(TX_HASH);
  const receipt = await provider.getTransactionReceipt(TX_HASH);
  
  console.log("\n=== Transaction Details ===");
  console.log(`From: ${tx.from}`);
  console.log(`To: ${tx.to}`);
  console.log(`Value: ${ethers.utils.formatEther(tx.value)} ETH`);
  console.log(`Gas Limit: ${tx.gasLimit.toString()}`);
  console.log(`Gas Used: ${receipt.gasUsed.toString()}`);
  console.log(`Status: ${receipt.status === 1 ? "SUCCESS" : "FAILED"}`);
  
  console.log(`\nFunction selector: ${tx.data.substring(0, 10)}`);
  console.log(`Full data length: ${tx.data.length} chars`);
  
  // Check if it was sent to the gateway
  console.log(`\nSent to Gateway: ${tx.to?.toLowerCase() === GATEWAY_ADDRESS.toLowerCase()}`);
  
  // Try to decode as deposit function
  const gatewayAbi = [
    "function deposit(address _recepient, tuple(address tokenAddress, uint256 tokenAmount)[] _assets, bytes _options)",
    "function quoteDeposit(address _recepient, tuple(address tokenAddress, uint256 tokenAmount)[] _assets, bytes _options) view returns (uint256)",
  ];
  
  const iface = new ethers.utils.Interface(gatewayAbi);
  const depositSelector = iface.getSighash("deposit");
  console.log(`\nExpected deposit selector: ${depositSelector}`);
  console.log(`Actual selector: ${tx.data.substring(0, 10)}`);
  console.log(`Match: ${depositSelector === tx.data.substring(0, 10)}`);
  
  if (depositSelector === tx.data.substring(0, 10)) {
    try {
      const decoded = iface.decodeFunctionData("deposit", tx.data);
      console.log("\n=== Decoded Parameters ===");
      console.log(`Recipient: ${decoded._recepient}`);
      console.log(`Assets: ${JSON.stringify(decoded._assets.map((a: any) => ({
        tokenAddress: a.tokenAddress,
        tokenAmount: a.tokenAmount.toString()
      })), null, 2)}`);
      console.log(`Options (hex): ${decoded._options}`);
      console.log(`Options length: ${decoded._options.length} chars`);
      
      // Decode LZ options
      const opts = decoded._options;
      console.log(`\nLayerZero Options Analysis:`);
      console.log(`  Raw: ${opts}`);
      if (opts.length >= 10) {
        const optType = parseInt(opts.substring(2, 6), 16);
        console.log(`  Option type: ${optType}`);
      }
    } catch (e: any) {
      console.log(`\nFailed to decode: ${e.message}`);
    }
  }
  
  // Check logs for any events
  console.log(`\n=== Transaction Logs ===`);
  console.log(`Number of logs: ${receipt.logs.length}`);
  for (const log of receipt.logs) {
    console.log(`  Log from: ${log.address}`);
    console.log(`  Topics: ${log.topics.length}`);
  }
}

main().catch(console.error);
