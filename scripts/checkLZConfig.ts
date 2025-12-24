import { ethers } from "hardhat";

const NEW_GATEWAY = "0x2d603F7B0d06Bd5f6232Afe1991aF3D103d68071";
const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const ARB_EID = 30110;
const SONIC_EID = 30332;

// LZ Endpoints
const ARB_LZ_ENDPOINT = "0x1a44076050125825900e736c501f859c50fE728c";
const SONIC_LZ_ENDPOINT = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";

// DVNs
const ARB_LZ_DVN = "0x2f55C492897526677C5B68fb199ea31E2c126416";
const SONIC_LZ_DVN = "0x282b3386571f7f794450d5789911a9804fa346b4";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log("=== Check LZ Config ===");
  console.log("Network:", network.name, "chainId:", network.chainId);
  
  if (network.chainId === 42161) {
    // Arbitrum
    console.log("\n--- Arbitrum Gateway Config ---");
    const gateway = await ethers.getContractAt("GatewayVault", NEW_GATEWAY);
    
    // Check peer
    const peer = await gateway.peers(SONIC_EID);
    console.log("Peer for Sonic EID:", peer);
    console.log("Expected Hub:", ethers.utils.hexZeroPad(HUB_ADDRESS, 32).toLowerCase());
    console.log("Match:", peer.toLowerCase() === ethers.utils.hexZeroPad(HUB_ADDRESS, 32).toLowerCase());
    
    // Check tokens
    const tokens = await gateway.getAllAvailableTokens();
    console.log("\nLinked tokens:", tokens.length);
    
  } else if (network.chainId === 146) {
    // Sonic
    console.log("\n--- Sonic Hub Config ---");
    const hub = await ethers.getContractAt("SyntheticTokenHub", HUB_ADDRESS);
    
    // Check peer for Arbitrum
    const peer = await hub.peers(ARB_EID);
    console.log("Peer for Arbitrum EID:", peer);
    console.log("Expected Gateway:", ethers.utils.hexZeroPad(NEW_GATEWAY, 32).toLowerCase());
    console.log("Match:", peer.toLowerCase() === ethers.utils.hexZeroPad(NEW_GATEWAY, 32).toLowerCase());
    
    // Check DVN config - we need to check the endpoint
    const endpointABI = [
      "function getConfig(address oapp, address lib, uint32 eid, uint32 configType) external view returns (bytes memory config)"
    ];
    const endpoint = await ethers.getContractAt(endpointABI, SONIC_LZ_ENDPOINT);
    
    // Sonic libs
    const sendLib = "0xC1EC25A9e8a8DE5Aa346f635B33e5B74c4c081aF";  // Sonic SendLib302
    const receiveLib = "0x377530cdA84DFb2673bF4d145DCF0C4D7fdcB5b6"; // Sonic ReceiveLib302
    
    console.log("\nChecking Hub DVN config for receiving from Arbitrum...");
    try {
      const config = await endpoint.getConfig(HUB_ADDRESS, receiveLib, ARB_EID, 2);
      console.log("Receive ULN Config:", config);
    } catch (e: any) {
      console.log("Error getting receive config:", e.reason || e.message?.slice(0, 50));
    }
    
    try {
      const config = await endpoint.getConfig(HUB_ADDRESS, sendLib, ARB_EID, 2);
      console.log("Send ULN Config:", config);
    } catch (e: any) {
      console.log("Error getting send config:", e.reason || e.message?.slice(0, 50));
    }
  }
}

main().catch(console.error);
