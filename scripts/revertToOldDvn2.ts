import { ethers, network } from "hardhat";

const SONIC_EID = 30332;
const WORKING_DVN = "0x2f55C492897526677C5B68fb199ea31E2c126416";

const GATEWAYS: Record<string, { address: string, endpoint: string }> = {
  arbitrum: { 
    address: "0x527f843672C4CD7F45B126f3E1E82D60A741C609",
    endpoint: "0x1a44076050125825900e736c501f859c50fE728c",
  },
};

async function main() {
  const chainName = network.name;
  const [deployer] = await ethers.getSigners();
  
  const config = GATEWAYS[chainName];
  if (!config) throw new Error(`Unknown chain: ${chainName}`);
  
  console.log(`\n=== Reverting ${chainName.toUpperCase()} Gateway to Working DVN ===\n`);
  
  const endpointAbi = [
    "function getSendLibrary(address _sender, uint32 _dstEid) view returns (address)",
    "function setConfig(address _oapp, address _lib, tuple(uint32 eid, uint32 configType, bytes config)[] _params) external",
  ];
  
  const endpoint = new ethers.Contract(config.endpoint, endpointAbi, deployer);
  
  const sendLib = await endpoint.getSendLibrary(config.address, SONIC_EID);
  console.log(`Send library: ${sendLib}`);
  
  // Build DVN config
  const dvnConfigData = ethers.utils.defaultAbiCoder.encode(
    ["tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)"],
    [{
      confirmations: 20,
      requiredDVNCount: 1,
      optionalDVNCount: 0,
      optionalDVNThreshold: 0,
      requiredDVNs: [WORKING_DVN],
      optionalDVNs: [],
    }]
  );
  
  console.log(`Setting DVN to ${WORKING_DVN}...`);
  
  const params = [{
    eid: SONIC_EID,
    configType: 2,
    config: dvnConfigData
  }];
  
  const tx = await endpoint.setConfig(config.address, sendLib, params, { gasLimit: 300000 });
  console.log(`TX: ${tx.hash}`);
  await tx.wait();
  console.log(`✅ DVN config reverted!`);
  
  // Verify
  const verifyAbi = ["function getConfig(address, address, uint32, uint32) view returns (bytes)"];
  const endpointVerify = new ethers.Contract(config.endpoint, verifyAbi, deployer);
  const newConfig = await endpointVerify.getConfig(config.address, sendLib, SONIC_EID, 2);
  const decoded = ethers.utils.defaultAbiCoder.decode(
    ["tuple(uint64, uint8, uint8, uint8, address[], address[])"],
    newConfig
  );
  console.log(`\nVerified DVN: ${decoded[0][4].join(", ")}`);
}

main().catch(console.error);
