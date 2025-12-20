import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const GATEWAY_ARB = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const ARB_EID = 30110;

async function main() {
  console.log("=== CHECKING CORRECT LZ ENDPOINT ===\n");
  
  const sonicProvider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");
  const arbProvider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  // Get Hub's endpoint
  const hubAbi = ["function endpoint() view returns (address)"];
  const hub = new ethers.Contract(HUB, hubAbi, sonicProvider);
  const hubEndpoint = await hub.endpoint();
  console.log(`Hub's LZ Endpoint: ${hubEndpoint}`);
  
  // Get Gateway's endpoint
  const gatewayAbi = ["function endpoint() view returns (address)"];
  const gateway = new ethers.Contract(GATEWAY_ARB, gatewayAbi, arbProvider);
  const gatewayEndpoint = await gateway.endpoint();
  console.log(`Gateway's LZ Endpoint: ${gatewayEndpoint}`);
  
  // Check receive config on Hub's actual endpoint
  console.log("\n=== HUB RECEIVE CONFIG (CORRECT ENDPOINT) ===");
  
  const senderBytes32 = ethers.utils.hexZeroPad(GATEWAY_ARB.toLowerCase(), 32);
  
  const endpointAbi = [
    "function getReceiveLibrary(address _receiver, uint32 _srcEid) external view returns (address lib, bool isDefault)",
    "function lazyInboundNonce(address _receiver, uint32 _srcEid, bytes32 _sender) external view returns (uint64)",
    "function inboundNonce(address _receiver, uint32 _srcEid, bytes32 _sender) external view returns (uint64)",
  ];
  
  const endpoint = new ethers.Contract(hubEndpoint, endpointAbi, sonicProvider);
  
  try {
    const [lib, isDefault] = await endpoint.getReceiveLibrary(HUB, ARB_EID);
    console.log(`Receive library: ${lib} (default: ${isDefault})`);
    
    // Get ULN config
    const ulnAbi = [
      "function getUlnConfig(address _oapp, uint32 _remoteEid) external view returns (tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs))",
    ];
    const uln = new ethers.Contract(lib, ulnAbi, sonicProvider);
    const config = await uln.getUlnConfig(HUB, ARB_EID);
    console.log(`Receive DVNs: ${config.requiredDVNs.join(', ')}`);
  } catch (e: any) {
    console.log(`Error: ${e.message?.slice(0, 200)}`);
  }
  
  // Check nonces
  console.log("\n=== MESSAGE NONCES ===");
  try {
    const lazyNonce = await endpoint.lazyInboundNonce(HUB, ARB_EID, senderBytes32);
    const inboundNonce = await endpoint.inboundNonce(HUB, ARB_EID, senderBytes32);
    console.log(`Lazy nonce (pending): ${lazyNonce.toString()}`);
    console.log(`Inbound nonce (delivered): ${inboundNonce.toString()}`);
    console.log(`Pending messages: ${lazyNonce.sub(inboundNonce).toString()}`);
  } catch (e: any) {
    console.log(`Error: ${e.message?.slice(0, 200)}`);
  }
}

main().catch(console.error);
