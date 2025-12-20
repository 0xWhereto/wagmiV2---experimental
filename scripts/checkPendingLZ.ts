import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const OLD_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const HUB_ENDPOINT = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
const ARB_EID = 30110;

async function main() {
  console.log("=== CHECKING PENDING LZ MESSAGES ===\n");
  
  const sonicProvider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");
  
  const senderBytes32 = ethers.utils.hexZeroPad(OLD_GATEWAY.toLowerCase(), 32);
  
  const endpointAbi = [
    "function lazyInboundNonce(address _receiver, uint32 _srcEid, bytes32 _sender) external view returns (uint64)",
    "function inboundNonce(address _receiver, uint32 _srcEid, bytes32 _sender) external view returns (uint64)",
    "function inboundPayloadHash(address _receiver, uint32 _srcEid, bytes32 _sender, uint64 _nonce) external view returns (bytes32)",
  ];
  
  const endpoint = new ethers.Contract(HUB_ENDPOINT, endpointAbi, sonicProvider);
  
  console.log(`Gateway (sender): ${OLD_GATEWAY}`);
  console.log(`Hub (receiver): ${HUB}`);
  console.log(`Sender bytes32: ${senderBytes32}`);
  
  const lazyNonce = await endpoint.lazyInboundNonce(HUB, ARB_EID, senderBytes32);
  const inboundNonce = await endpoint.inboundNonce(HUB, ARB_EID, senderBytes32);
  
  console.log(`\nLazy nonce: ${lazyNonce.toString()}`);
  console.log(`Inbound nonce: ${inboundNonce.toString()}`);
  console.log(`Pending messages: ${lazyNonce.sub(inboundNonce).toString()}`);
  
  if (lazyNonce.gt(inboundNonce)) {
    console.log("\n⚠️ There are pending messages! Checking payloads...");
    for (let n = inboundNonce.toNumber() + 1; n <= lazyNonce.toNumber(); n++) {
      const hash = await endpoint.inboundPayloadHash(HUB, ARB_EID, senderBytes32, n);
      console.log(`  Nonce ${n}: ${hash}`);
    }
  } else {
    console.log("\n✅ All messages delivered - no pending");
  }
}

main().catch(console.error);
