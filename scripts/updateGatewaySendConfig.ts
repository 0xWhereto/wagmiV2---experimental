import { ethers, network } from "hardhat";

const SONIC_EID = 30332;

const GATEWAYS: Record<string, { address: string, endpoint: string }> = {
  arbitrum: { 
    address: "0x527f843672C4CD7F45B126f3E1E82D60A741C609",
    endpoint: "0x1a44076050125825900e736c501f859c50fE728c",
  },
  ethereum: { 
    address: "0x5826e10B513C891910032F15292B2F1b3041C3Df",
    endpoint: "0x1a44076050125825900e736c501f859c50fE728c",
  },
};

async function main() {
  const chainName = network.name;
  const [deployer] = await ethers.getSigners();
  
  const config = GATEWAYS[chainName];
  if (!config) throw new Error(`Unknown chain: ${chainName}`);
  
  console.log(`\n=== Updating ${chainName.toUpperCase()} Gateway Send Config ===\n`);
  
  const endpointAbi = [
    "function getSendLibrary(address _sender, uint32 _dstEid) external view returns (address)",
    "function setConfig(address _oapp, address _lib, tuple(uint32 eid, uint32 configType, bytes config)[] _params) external",
    "function getConfig(address _oapp, address _lib, uint32 _eid, uint32 _configType) external view returns (bytes)",
    "function defaultSendLibrary(uint32 _dstEid) external view returns (address)",
  ];
  
  const endpoint = new ethers.Contract(config.endpoint, endpointAbi, deployer);
  
  // Get send library
  const sendLib = await endpoint.getSendLibrary(config.address, SONIC_EID);
  console.log(`Send library: ${sendLib}`);
  
  // Get default send library
  const defaultLib = await endpoint.defaultSendLibrary(SONIC_EID);
  console.log(`Default send library: ${defaultLib}`);
  
  // Get default DVN config
  try {
    const defaultConfig = await endpoint.getConfig(ethers.constants.AddressZero, defaultLib, SONIC_EID, 2);
    const defaultDecoded = ethers.utils.defaultAbiCoder.decode(
      ["tuple(uint64, uint8, uint8, uint8, address[], address[])"],
      defaultConfig
    );
    console.log(`Default DVNs for Sonic: ${defaultDecoded[0][4].join(", ")}`);
    
    // Get current config
    const currentConfig = await endpoint.getConfig(config.address, sendLib, SONIC_EID, 2);
    const currentDecoded = ethers.utils.defaultAbiCoder.decode(
      ["tuple(uint64, uint8, uint8, uint8, address[], address[])"],
      currentConfig
    );
    console.log(`Gateway uses DVNs: ${currentDecoded[0][4].join(", ")}`);
    
    // Update to use default DVN
    console.log(`\nUpdating to use default DVN...`);
    
    const newConfig = ethers.utils.defaultAbiCoder.encode(
      ["tuple(uint64, uint8, uint8, uint8, address[], address[])"],
      [[
        defaultDecoded[0][0], // confirmations
        defaultDecoded[0][1], // requiredDVNCount
        defaultDecoded[0][2], // optionalDVNCount
        defaultDecoded[0][3], // optionalDVNThreshold
        defaultDecoded[0][4], // requiredDVNs
        defaultDecoded[0][5], // optionalDVNs
      ]]
    );
    
    const tx = await endpoint.setConfig(config.address, sendLib, [
      { eid: SONIC_EID, configType: 2, config: newConfig }
    ], { gasLimit: 300000 });
    console.log(`TX: ${tx.hash}`);
    await tx.wait();
    console.log(`✅ Updated!`);
    
  } catch (e: any) {
    console.log(`Error: ${e.message?.substring(0, 150)}`);
  }
}

main().catch(console.error);
