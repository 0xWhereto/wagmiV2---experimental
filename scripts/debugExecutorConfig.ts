import { ethers } from "hardhat";

const GATEWAY = "0x527f843672C4CD7F45B126f3E1E82D60A741C609";
const ENDPOINT = "0x1a44076050125825900e736c501f859c50fE728c";
const SONIC_EID = 30332;

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  const endpointAbi = [
    "function getSendLibrary(address, uint32) view returns (address)",
    "function getConfig(address, address, uint32, uint32) view returns (bytes)",
  ];
  
  const endpoint = new ethers.Contract(ENDPOINT, endpointAbi, provider);
  
  console.log("=== Detailed Executor Config ===\n");
  
  const sendLib = await endpoint.getSendLibrary(GATEWAY, SONIC_EID);
  console.log(`Send library: ${sendLib}`);
  
  // Get Executor config (type 1)
  const execConfig = await endpoint.getConfig(GATEWAY, sendLib, SONIC_EID, 1);
  console.log(`\nExecutor config (raw): ${execConfig}`);
  
  // Decode
  const decoded = ethers.utils.defaultAbiCoder.decode(
    ["tuple(uint32 maxMessageSize, address executor)"],
    execConfig
  );
  
  console.log(`\nDecoded:`);
  console.log(`  maxMessageSize: ${decoded[0].maxMessageSize}`);
  console.log(`  executor: ${decoded[0].executor}`);
  
  // Check if executor is zero
  if (decoded[0].executor === ethers.constants.AddressZero) {
    console.log(`\n❌ PROBLEM: Executor is zero address!`);
  } else {
    console.log(`\n✅ Executor config looks valid`);
  }
  
  // Also check the send library directly to see if it's initialized
  const sendLibAbi = [
    "function getUlnConfig(address _oapp, uint32 _remoteEid) view returns (tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs))",
    "function getExecutorConfig(address _oapp, uint32 _remoteEid) view returns (tuple(uint32 maxMessageSize, address executor))",
  ];
  
  const sendLibContract = new ethers.Contract(sendLib, sendLibAbi, provider);
  
  try {
    const ulnConfig = await sendLibContract.getUlnConfig(GATEWAY, SONIC_EID);
    console.log(`\nDirect ULN config from library:`);
    console.log(`  confirmations: ${ulnConfig.confirmations}`);
    console.log(`  requiredDVNs: ${ulnConfig.requiredDVNs}`);
    
    const execConfigDirect = await sendLibContract.getExecutorConfig(GATEWAY, SONIC_EID);
    console.log(`\nDirect Executor config from library:`);
    console.log(`  maxMessageSize: ${execConfigDirect.maxMessageSize}`);
    console.log(`  executor: ${execConfigDirect.executor}`);
  } catch (e: any) {
    console.log(`\nError getting config from library: ${e.message?.substring(0, 100)}`);
  }
}

main().catch(console.error);
