import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const LZ_ENDPOINT = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
const ARBITRUM_GATEWAY = "0x187ddd9a94236ba6d22376ee2e3c4c834e92f34e";
const ARBITRUM_EID = 30110;

async function main() {
  const provider = ethers.provider;
  
  console.log("=== Checking LayerZero Messages ===\n");
  
  const gatewayBytes32 = ethers.utils.hexZeroPad(ARBITRUM_GATEWAY, 32);

  // Check the endpoint for message status
  const lzEndpoint = await ethers.getContractAt(
    [
      "function inboundNonce(address _receiver, uint32 _srcEid, bytes32 _sender) view returns (uint64)",
      "function lazyInboundNonce(address _receiver, uint32 _srcEid, bytes32 _sender) view returns (uint64)",
      "function inboundPayloadHash(address _receiver, uint32 _srcEid, bytes32 _sender, uint64 _nonce) view returns (bytes32)"
    ],
    LZ_ENDPOINT
  );

  const inboundNonce = await lzEndpoint.inboundNonce(HUB_ADDRESS, ARBITRUM_EID, gatewayBytes32);
  const lazyNonce = await lzEndpoint.lazyInboundNonce(HUB_ADDRESS, ARBITRUM_EID, gatewayBytes32);
  
  console.log(`Inbound nonce (next expected): ${inboundNonce}`);
  console.log(`Lazy inbound nonce (highest verified): ${lazyNonce}`);

  // Check if there are any pending message payloads
  console.log("\n=== Checking Payload Hashes ===");
  
  // Check a few nonces around the current one
  for (let nonce = Math.max(1, Number(inboundNonce) - 3); nonce <= Number(inboundNonce) + 2; nonce++) {
    try {
      const hash = await lzEndpoint.inboundPayloadHash(HUB_ADDRESS, ARBITRUM_EID, gatewayBytes32, nonce);
      if (hash !== ethers.constants.HashZero) {
        console.log(`Nonce ${nonce}: ${hash}`);
        console.log(`  ⚠️ This message has a stored payload hash - might be failed/pending!`);
      } else {
        console.log(`Nonce ${nonce}: (empty - already executed or not received)`);
      }
    } catch (e: any) {
      console.log(`Nonce ${nonce}: Error - ${e.message?.slice(0, 50)}`);
    }
  }

  // Check if the Hub has any queued messages or execution failures
  console.log("\n=== Checking Hub for Execution Issues ===");
  
  // Look for recent events from the LZ endpoint related to the Hub
  const latestBlock = await provider.getBlockNumber();
  
  try {
    const logs = await provider.getLogs({
      address: LZ_ENDPOINT,
      fromBlock: latestBlock - 5000,
      toBlock: latestBlock
    });
    
    // Filter for logs that mention the Hub address
    const hubLogs = logs.filter(log => 
      log.topics.some(t => t.toLowerCase().includes(HUB_ADDRESS.slice(2).toLowerCase()))
    );
    
    console.log(`LZ Endpoint logs mentioning Hub: ${hubLogs.length}`);
    
    for (const log of hubLogs.slice(-3)) {
      console.log(`  Block ${log.blockNumber}: ${log.topics[0]?.slice(0, 30)}...`);
    }
  } catch (e: any) {
    console.log(`Error fetching logs: ${e.message?.slice(0, 100)}`);
  }

  // Provide guidance
  console.log("\n=== Diagnosis ===");
  console.log(`
To find the exact error:
1. Go to LayerZero Scan: https://layerzeroscan.com/
2. Search for the Arbitrum transaction hash
3. Look for "Status" - if it shows "Failed" or "Pending", click to see the error

Common causes of bridge failures:
- Gas limit too low in LZ options
- Minimum bridge amount not met (currently 0.001 ETH)
- The Hub's _lzReceive reverting for some reason

If the message shows "Pending" on LayerZero Scan:
- It means the DVNs haven't verified it yet, or
- The executor hasn't executed it yet (might need more gas)

If the message shows "Failed":
- Check the error message - it will tell you exactly what failed
`);

  // Check what the minimum bridge amount is
  console.log("=== Minimum Bridge Amounts ===");
  console.log("WETH from Arbitrum: 0.001 ETH minimum");
  console.log("\nMake sure you're bridging at least 0.001 ETH!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


