import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const ARB_EID = 30110;

async function main() {
  console.log("=== Check Hub Linked Tokens ===");
  
  const hub = await ethers.getContractAt("SyntheticTokenHub", HUB_ADDRESS);
  
  // Try different ways to check linked tokens
  console.log("\n1. Check syntheticTokens mapping...");
  try {
    // Check if there's any synthetic tokens array
    const numTokens = await hub.syntheticTokensLength();
    console.log("Number of synthetic tokens:", numTokens.toString());
    
    for (let i = 0; i < numTokens.toNumber(); i++) {
      const token = await hub.syntheticTokens(i);
      console.log(`  [${i}]:`, token);
    }
  } catch (e: any) {
    console.log("Error:", e.message?.slice(0, 80));
  }
  
  console.log("\n2. Check remoteTokens directly...");
  try {
    // The Hub should have remote tokens registered from the gateway's linkTokenToHub call
    const remoteTokensLength = await hub.remoteTokensLength();
    console.log("Number of remote tokens:", remoteTokensLength.toString());
  } catch (e: any) {
    console.log("Error:", e.message?.slice(0, 80));
  }
  
  console.log("\n3. Looking at LZ message queue...");
  // Check if there's a pending message
  const SONIC_LZ_ENDPOINT = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
  const endpointABI = [
    "function lazyInboundNonce(address receiver, uint32 srcEid, bytes32 sender) external view returns (uint64)",
    "function inboundNonce(address receiver, uint32 srcEid, bytes32 sender) external view returns (uint64)"
  ];
  
  const endpoint = await ethers.getContractAt(endpointABI, SONIC_LZ_ENDPOINT);
  
  // New gateway bytes32
  const gatewayBytes = ethers.utils.hexZeroPad("0x2d603F7B0d06Bd5f6232Afe1991aF3D103d68071", 32);
  
  try {
    const lazyNonce = await endpoint.lazyInboundNonce(HUB_ADDRESS, ARB_EID, gatewayBytes);
    console.log("Lazy inbound nonce from new gateway:", lazyNonce.toString());
  } catch (e: any) {
    console.log("Error:", e.message?.slice(0, 80));
  }
  
  try {
    const inboundNonce = await endpoint.inboundNonce(HUB_ADDRESS, ARB_EID, gatewayBytes);
    console.log("Inbound nonce from new gateway:", inboundNonce.toString());
  } catch (e: any) {
    console.log("Error:", e.message?.slice(0, 80));
  }
}

main().catch(console.error);
