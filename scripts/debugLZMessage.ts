import { ethers } from "hardhat";

// Check Arbitrum gateway's outbound nonce
const NEW_GATEWAY = "0x2d603F7B0d06Bd5f6232Afe1991aF3D103d68071";
const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const SONIC_EID = 30332;
const ARB_EID = 30110;

const ARB_LZ_ENDPOINT = "0x1a44076050125825900e736c501f859c50fE728c";
const SONIC_LZ_ENDPOINT = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";

async function main() {
  const network = await ethers.provider.getNetwork();
  console.log("=== Debug LZ Message ===");
  console.log("Network:", network.name, "chainId:", network.chainId);
  
  const endpointABI = [
    "function outboundNonce(address sender, uint32 dstEid, bytes32 receiver) external view returns (uint64)",
    "function lazyInboundNonce(address receiver, uint32 srcEid, bytes32 sender) external view returns (uint64)",
    "function inboundNonce(address receiver, uint32 srcEid, bytes32 sender) external view returns (uint64)"
  ];
  
  const hubBytes = ethers.utils.hexZeroPad(HUB_ADDRESS, 32);
  const gatewayBytes = ethers.utils.hexZeroPad(NEW_GATEWAY, 32);
  
  if (network.chainId === 42161) {
    // Arbitrum
    console.log("\n--- Arbitrum Outbound Nonces ---");
    const endpoint = await ethers.getContractAt(endpointABI, ARB_LZ_ENDPOINT);
    
    const outboundNonce = await endpoint.outboundNonce(NEW_GATEWAY, SONIC_EID, hubBytes);
    console.log("Outbound nonce to Sonic:", outboundNonce.toString());
    console.log("(This is how many messages the gateway has SENT)");
  } else if (network.chainId === 146) {
    // Sonic
    console.log("\n--- Sonic Inbound Nonces ---");
    const endpoint = await ethers.getContractAt(endpointABI, SONIC_LZ_ENDPOINT);
    
    const lazyNonce = await endpoint.lazyInboundNonce(HUB_ADDRESS, ARB_EID, gatewayBytes);
    const inboundNonce = await endpoint.inboundNonce(HUB_ADDRESS, ARB_EID, gatewayBytes);
    console.log("Lazy inbound nonce:", lazyNonce.toString(), "(verified by DVN, not yet committed)");
    console.log("Inbound nonce:", inboundNonce.toString(), "(committed/executed)");
    
    if (lazyNonce.eq(0)) {
      console.log("\n⚠️  DVN has not yet verified any messages from the new gateway!");
      console.log("   This could mean:");
      console.log("   1. DVN mismatch between chains");
      console.log("   2. Messages still in flight (DVN processing)");
      console.log("   3. Executor hasn't run yet");
    }
  }
}

main().catch(console.error);
