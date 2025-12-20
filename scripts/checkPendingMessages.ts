import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const LZ_ENDPOINT_SONIC = "0xe1844c5D63a9543023008D332Bd3d2e6f1FE1043";
const ARB_EID = 30110;

async function main() {
  console.log("=== CHECKING LZ MESSAGE STATUS ===\n");
  
  const provider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");
  
  // Check the LZ Endpoint for pending inbound messages
  const endpointAbi = [
    "function inboundNonce(address _receiver, uint32 _srcEid, bytes32 _sender) view returns (uint64)",
    "function lazyInboundNonce(address _receiver, uint32 _srcEid, bytes32 _sender) view returns (uint64)",
  ];
  
  const endpoint = new ethers.Contract(LZ_ENDPOINT_SONIC, endpointAbi, provider);
  
  // The sender is the Gateway on Arbitrum
  const GATEWAY_ARB = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
  const senderBytes32 = ethers.utils.hexZeroPad(GATEWAY_ARB, 32);
  
  console.log(`Checking messages from Arbitrum Gateway to Hub...`);
  console.log(`Sender: ${senderBytes32}`);
  
  try {
    const inboundNonce = await endpoint.inboundNonce(HUB, ARB_EID, senderBytes32);
    console.log(`Inbound nonce (delivered): ${inboundNonce.toString()}`);
    
    const lazyNonce = await endpoint.lazyInboundNonce(HUB, ARB_EID, senderBytes32);
    console.log(`Lazy inbound nonce (pending): ${lazyNonce.toString()}`);
    
    if (lazyNonce.gt(inboundNonce)) {
      console.log(`\n⚠️ There are ${lazyNonce.sub(inboundNonce).toString()} pending messages!`);
    } else {
      console.log("\n✅ No pending messages - all delivered");
    }
  } catch (e: any) {
    console.log(`Error: ${e.message?.slice(0, 100)}`);
  }
  
  // Also check recent events on Hub
  console.log("\n=== RECENT DEPOSITS ON HUB ===");
  const hubAbi = [
    "event Deposited(address indexed user, address indexed syntheticToken, uint256 amount)"
  ];
  const hub = new ethers.Contract(HUB, hubAbi, provider);
  
  const latestBlock = await provider.getBlockNumber();
  const filter = hub.filters.Deposited();
  
  try {
    const events = await hub.queryFilter(filter, latestBlock - 10000, latestBlock);
    console.log(`Found ${events.length} deposit events in last 10000 blocks`);
    
    for (const e of events.slice(-5)) {
      console.log(`  Block ${e.blockNumber}: ${ethers.utils.formatUnits(e.args?.amount || 0, 6)} to ${e.args?.user?.slice(0, 10)}...`);
    }
  } catch (e: any) {
    console.log(`Error fetching events: ${e.message?.slice(0, 100)}`);
  }
}

main().catch(console.error);
