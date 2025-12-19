import { ethers, network } from "hardhat";

const SONIC_EID = 30332;

const GATEWAYS: Record<string, { address: string, endpoint: string, executor: string }> = {
  arbitrum: { 
    address: "0x527f843672C4CD7F45B126f3E1E82D60A741C609",
    endpoint: "0x1a44076050125825900e736c501f859c50fE728c",
    executor: "0x31CAe3B7fB82d847621859fb1585353c5720660D",
  },
  ethereum: { 
    address: "0x5826e10B513C891910032F15292B2F1b3041C3Df",
    endpoint: "0x1a44076050125825900e736c501f859c50fE728c",
    executor: "0x173272739Bd7Aa6e4e214714048a9fE699453059",
  },
};

async function main() {
  const chainName = network.name;
  const [deployer] = await ethers.getSigners();
  
  const config = GATEWAYS[chainName];
  if (!config) throw new Error(`Unknown chain: ${chainName}`);
  
  console.log(`\n=== Fixing Executor Config on ${chainName.toUpperCase()} Gateway ===\n`);
  
  const endpointAbi = [
    "function getSendLibrary(address, uint32) view returns (address)",
    "function setConfig(address, address, tuple(uint32, uint32, bytes)[]) external",
    "function getConfig(address, address, uint32, uint32) view returns (bytes)",
    "function defaultSendLibrary(uint32) view returns (address)",
  ];
  
  const endpoint = new ethers.Contract(config.endpoint, endpointAbi, deployer);
  
  // Get send library
  const sendLib = await endpoint.getSendLibrary(config.address, SONIC_EID);
  console.log(`Send library: ${sendLib}`);
  
  // Get default executor config
  const defaultLib = await endpoint.defaultSendLibrary(SONIC_EID);
  
  try {
    const defaultExecConfig = await endpoint.getConfig(ethers.constants.AddressZero, defaultLib, SONIC_EID, 1);
    console.log(`Default executor config: ${defaultExecConfig}`);
    
    // Decode it
    const decoded = ethers.utils.defaultAbiCoder.decode(
      ["tuple(uint32 maxMessageSize, address executor)"],
      defaultExecConfig
    );
    console.log(`Default executor: ${decoded[0].executor}`);
    console.log(`Default max message size: ${decoded[0].maxMessageSize}`);
    
    // Check current gateway config
    try {
      const currentConfig = await endpoint.getConfig(config.address, sendLib, SONIC_EID, 1);
      console.log(`\nGateway current executor config: ${currentConfig}`);
    } catch (e) {
      console.log(`\nGateway has no executor config - setting default...`);
    }
    
    // Set the executor config using defaults
    const execConfig = ethers.utils.defaultAbiCoder.encode(
      ["tuple(uint32 maxMessageSize, address executor)"],
      [{
        maxMessageSize: decoded[0].maxMessageSize,
        executor: decoded[0].executor,
      }]
    );
    
    console.log(`\nSetting executor config...`);
    const tx = await endpoint.setConfig(config.address, sendLib, [
      { eid: SONIC_EID, configType: 1, config: execConfig }
    ], { gasLimit: 300000 });
    console.log(`TX: ${tx.hash}`);
    await tx.wait();
    console.log(`✅ Executor config set!`);
    
  } catch (e: any) {
    console.log(`Error: ${e.message?.substring(0, 150)}`);
  }
}

main().catch(console.error);
