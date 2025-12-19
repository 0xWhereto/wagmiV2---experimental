import { ethers, network } from "hardhat";

/**
 * Configure LayerZero DVNs and Executor for Gateway
 * 
 * LayerZero V2 requires setting:
 * 1. Send Library
 * 2. Receive Library
 * 3. DVN (verifier) configuration
 * 4. Executor
 */

const GATEWAYS: Record<string, string> = {
  arbitrum: "0x527f843672C4CD7F45B126f3E1E82D60A741C609",
  ethereum: "0x5826e10B513C891910032F15292B2F1b3041C3Df",
};

const HUB_EID = 30332;

// LayerZero V2 Endpoint addresses
const LZ_ENDPOINTS: Record<string, string> = {
  arbitrum: "0x1a44076050125825900e736c501f859c50fE728c",
  ethereum: "0x1a44076050125825900e736c501f859c50fE728c",
};

// LayerZero default DVN addresses
// These are LayerZero's official DVNs for each chain
const LZ_DVNS: Record<string, string> = {
  arbitrum: "0x2f55C492897526677C5B68fb199ea31E2c126416", // LayerZero DVN on Arbitrum
  ethereum: "0x589dEDbD617e0CBcB916A9223F4d1300c294236b", // LayerZero DVN on Ethereum
};

// Default executor addresses
const LZ_EXECUTORS: Record<string, string> = {
  arbitrum: "0x31CAe3B7fB82d847621859fb1585353c5720660D",
  ethereum: "0x173272739Bd7Aa6e4e214714048a9fE699453059",
};

async function main() {
  const chainName = network.name;
  const [deployer] = await ethers.getSigners();
  
  const gatewayAddr = GATEWAYS[chainName];
  const endpointAddr = LZ_ENDPOINTS[chainName];
  const dvnAddr = LZ_DVNS[chainName];
  const executorAddr = LZ_EXECUTORS[chainName];
  
  if (!gatewayAddr) throw new Error(`No gateway for ${chainName}`);
  
  console.log(`\nConfiguring LZ for ${chainName.toUpperCase()} Gateway`);
  console.log(`Gateway: ${gatewayAddr}`);
  console.log(`Endpoint: ${endpointAddr}`);
  console.log(`DVN: ${dvnAddr}`);
  console.log(`Executor: ${executorAddr}`);
  
  // OApp configuration interface
  const oappAbi = [
    "function setDelegate(address _delegate) external",
    "function endpoint() view returns (address)",
    "function oAppVersion() view returns (uint64 senderVersion, uint64 receiverVersion)",
  ];
  
  // Endpoint interface for setting config
  const endpointAbi = [
    "function setConfig(address _oapp, address _lib, tuple(uint32 eid, uint32 configType, bytes config)[] _params) external",
    "function getConfig(address _oapp, address _lib, uint32 _eid, uint32 _configType) external view returns (bytes)",
    "function getSendLibrary(address _sender, uint32 _dstEid) external view returns (address)",
    "function getReceiveLibrary(address _receiver, uint32 _srcEid) external view returns (address, bool)",
    "function defaultSendLibrary(uint32 _dstEid) external view returns (address)",
    "function defaultReceiveLibrary(uint32 _srcEid) external view returns (address)",
  ];
  
  const endpoint = new ethers.Contract(endpointAddr, endpointAbi, deployer);
  
  // Check current config
  console.log("\nChecking current configuration...");
  
  try {
    const sendLib = await endpoint.getSendLibrary(gatewayAddr, HUB_EID);
    console.log(`Send library: ${sendLib}`);
    
    const [receiveLib, isDefault] = await endpoint.getReceiveLibrary(gatewayAddr, HUB_EID);
    console.log(`Receive library: ${receiveLib} (default: ${isDefault})`);
    
    // Get default libraries
    const defaultSend = await endpoint.defaultSendLibrary(HUB_EID);
    console.log(`Default send library for Sonic: ${defaultSend}`);
    
    const defaultReceive = await endpoint.defaultReceiveLibrary(HUB_EID);
    console.log(`Default receive library for Sonic: ${defaultReceive}`);
    
    // Config types:
    // 1 = Executor
    // 2 = DVN for send
    // 3 = DVN for receive
    
    // Try to get current DVN config
    try {
      const dvnConfig = await endpoint.getConfig(gatewayAddr, sendLib, HUB_EID, 2);
      console.log(`Current DVN config: ${dvnConfig}`);
    } catch (e) {
      console.log("No DVN config found");
    }
    
  } catch (e: any) {
    console.log(`Config check error: ${e.message?.substring(0, 100)}`);
  }

  // Set DVN configuration
  console.log("\nSetting DVN configuration...");
  
  // The config format for DVN (type 2) is:
  // struct UlnConfig {
  //   uint64 confirmations;
  //   uint8 requiredDVNCount;
  //   uint8 optionalDVNCount;
  //   uint8 optionalDVNThreshold;
  //   address[] requiredDVNs;
  //   address[] optionalDVNs;
  // }
  
  const ulnConfig = ethers.utils.defaultAbiCoder.encode(
    ["tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)"],
    [{
      confirmations: 1,
      requiredDVNCount: 1,
      optionalDVNCount: 0,
      optionalDVNThreshold: 0,
      requiredDVNs: [dvnAddr],
      optionalDVNs: [],
    }]
  );
  
  // Executor config (type 1)
  const executorConfig = ethers.utils.defaultAbiCoder.encode(
    ["tuple(uint32 maxMessageSize, address executor)"],
    [{
      maxMessageSize: 10000,
      executor: executorAddr,
    }]
  );
  
  try {
    // Get the send library
    const sendLib = await endpoint.defaultSendLibrary(HUB_EID);
    
    console.log(`Using send library: ${sendLib}`);
    
    // Set config
    const configs = [
      { eid: HUB_EID, configType: 1, config: executorConfig }, // Executor
      { eid: HUB_EID, configType: 2, config: ulnConfig },      // DVN for send
    ];
    
    const tx = await endpoint.setConfig(gatewayAddr, sendLib, configs, { gasLimit: 500000 });
    console.log(`TX: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Status: ${receipt.status === 1 ? "✅ SUCCESS" : "❌ FAILED"}`);
  } catch (e: any) {
    console.log(`Error: ${e.message?.substring(0, 200)}`);
  }
}

main().catch(console.error);
