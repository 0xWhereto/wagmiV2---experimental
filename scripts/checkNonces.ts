import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const ARB_EID = 30110;
const NEW_GATEWAY = "0x2d603F7B0d06Bd5f6232Afe1991aF3D103d68071";
const SONIC_LZ_ENDPOINT = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";

async function main() {
  console.log("=== Check LZ Nonces ===");
  
  const gatewayBytes = ethers.utils.hexZeroPad(NEW_GATEWAY, 32);
  
  const endpointABI = [
    "function lazyInboundNonce(address receiver, uint32 srcEid, bytes32 sender) external view returns (uint64)",
    "function inboundNonce(address receiver, uint32 srcEid, bytes32 sender) external view returns (uint64)"
  ];
  
  const endpoint = await ethers.getContractAt(endpointABI, SONIC_LZ_ENDPOINT);
  
  const lazyNonce = await endpoint.lazyInboundNonce(HUB_ADDRESS, ARB_EID, gatewayBytes);
  const inboundNonce = await endpoint.inboundNonce(HUB_ADDRESS, ARB_EID, gatewayBytes);
  
  console.log("Lazy inbound nonce:", lazyNonce.toString());
  console.log("Inbound nonce (committed):", inboundNonce.toString());
  
  if (lazyNonce.gt(inboundNonce)) {
    console.log("\n⚠️  There are", lazyNonce.sub(inboundNonce).toString(), "pending messages to commit!");
  } else if (lazyNonce.eq(0)) {
    console.log("\n⚠️  No messages received yet from new gateway.");
  } else {
    console.log("\n✓ All messages committed!");
  }
  
  // Check sUSDC balance
  const sUSDC = "0xA1b52eBc6e37d057e4Df26b72Ed89B05d60e9bD4";
  try {
    const token = await ethers.getContractAt("IERC20", sUSDC);
    const balance = await token.balanceOf("0x4151E05ABe56192e2A6775612C2020509Fd50637");
    console.log("\nsUSDC balance:", ethers.utils.formatUnits(balance, 6));
  } catch (e) {
    console.log("\nsUSDC contract not callable - tokens may not exist yet");
  }
}

main().catch(console.error);
