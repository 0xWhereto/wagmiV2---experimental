import { ethers, network } from "hardhat";

const SONIC_EID = 30332;

// DVN that OLD gateway uses (and was working)
const WORKING_DVN = "0x2f55C492897526677C5B68fb199ea31E2c126416";

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
  
  console.log(`\n=== Reverting ${chainName.toUpperCase()} Gateway to Working DVN ===\n`);
  console.log(`Gateway: ${config.address}`);
  console.log(`DVN to use: ${WORKING_DVN}`);
  
  const endpointAbi = [
    "function getSendLibrary(address, uint32) view returns (address)",
    "function setConfig(address, address, tuple(uint32, uint32, bytes)[]) external",
  ];
  
  const endpoint = new ethers.Contract(config.endpoint, endpointAbi, deployer);
  
  const sendLib = await endpoint.getSendLibrary(config.address, SONIC_EID);
  console.log(`Send library: ${sendLib}`);
  
  // Build DVN config with the working DVN
  const dvnConfig = ethers.utils.defaultAbiCoder.encode(
    ["tuple(uint64, uint8, uint8, uint8, address[], address[])"],
    [[
      20, // confirmations
      1,  // requiredDVNCount
      0,  // optionalDVNCount
      0,  // optionalDVNThreshold
      [WORKING_DVN], // requiredDVNs
      [], // optionalDVNs
    ]]
  );
  
  console.log(`\nSetting DVN to ${WORKING_DVN}...`);
  const tx = await endpoint.setConfig(config.address, sendLib, [
    { eid: SONIC_EID, configType: 2, config: dvnConfig }
  ], { gasLimit: 300000 });
  console.log(`TX: ${tx.hash}`);
  await tx.wait();
  console.log(`✅ DVN config reverted!`);
}

main().catch(console.error);
