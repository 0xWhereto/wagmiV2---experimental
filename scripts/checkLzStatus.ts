import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const GATEWAY_ARB = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const LZ_ENDPOINT_SONIC = "0xe1844c5D63a9543023008D332Bd3d2e6f1FE1043";
const ARB_EID = 30110;

async function main() {
  console.log("=== CHECKING LZ ENDPOINT STATUS ===\n");
  
  const sonicProvider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");
  
  // Get the sender bytes32
  const senderBytes32 = ethers.utils.hexZeroPad(GATEWAY_ARB.toLowerCase(), 32);
  console.log(`Sender (Gateway): ${senderBytes32}`);
  console.log(`Receiver (Hub): ${HUB}`);
  
  // Check endpoint for nonces
  const endpointAbi = [
    "function nextGuid(address _sender, uint32 _dstEid, bytes32 _receiver) external view returns (bytes32)",
    "function lazyInboundNonce(address _receiver, uint32 _srcEid, bytes32 _sender) external view returns (uint64)",
    "function inboundNonce(address _receiver, uint32 _srcEid, bytes32 _sender) external view returns (uint64)",
  ];
  
  const endpoint = new ethers.Contract(LZ_ENDPOINT_SONIC, endpointAbi, sonicProvider);
  
  try {
    const lazyNonce = await endpoint.lazyInboundNonce(HUB, ARB_EID, senderBytes32);
    console.log(`\nLazy inbound nonce: ${lazyNonce.toString()}`);
    
    const inboundNonce = await endpoint.inboundNonce(HUB, ARB_EID, senderBytes32);
    console.log(`Inbound nonce (delivered): ${inboundNonce.toString()}`);
    
    const pending = lazyNonce.sub(inboundNonce);
    console.log(`Pending messages: ${pending.toString()}`);
    
    if (pending.gt(0)) {
      console.log(`\n⚠️ There are ${pending.toString()} messages waiting to be delivered!`);
      console.log("These messages have been sent but not yet received by the Hub.");
    }
  } catch (e: any) {
    console.log(`Error: ${e.message?.slice(0, 200)}`);
  }
  
  // Check if Hub has the peer set correctly
  console.log("\n=== HUB PEER CONFIG ===");
  const hubAbi = [
    "function peers(uint32) view returns (bytes32)",
  ];
  const hub = new ethers.Contract(HUB, hubAbi, sonicProvider);
  
  const peer = await hub.peers(ARB_EID);
  console.log(`Hub peer for Arbitrum: ${peer}`);
  console.log(`Expected (Gateway):    ${senderBytes32}`);
  console.log(`Match: ${peer.toLowerCase() === senderBytes32.toLowerCase() ? "✅ YES" : "❌ NO"}`);
}

main().catch(console.error);
