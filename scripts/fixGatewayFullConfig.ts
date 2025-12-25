import { ethers } from "hardhat";

const ARB_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const LZ_ENDPOINT_ARB = "0x1a44076050125825900e736c501f859c50fE728c";
const SONIC_EID = 30332;

// Arbitrum executor and DVN from config file
const ARB_EXECUTOR = "0x31CAe3B7fB82d847621859fb1585353c5720660D";
const ARB_DVN = "0x2f55c492897526677c5b68fb199ea31e2c126416"; // LZ Labs DVN on Arbitrum

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=== FIXING GATEWAY FULL SEND CONFIG ===\n");
  console.log(`Deployer: ${deployer.address}`);
  
  const endpointAbi = [
    "function getSendLibrary(address _sender, uint32 _dstEid) view returns (address)",
    "function setConfig(address _oapp, address _lib, tuple(uint32 eid, uint32 configType, bytes config)[] _params) external",
  ];
  
  const ulnAbi = [
    "function getUlnConfig(address _oapp, uint32 _remoteEid) view returns (tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs))",
    "function getExecutorConfig(address _oapp, uint32 _remoteEid) view returns (tuple(uint32 maxMessageSize, address executor))",
  ];
  
  const endpoint = new ethers.Contract(LZ_ENDPOINT_ARB, endpointAbi, deployer);
  
  const sendLib = await endpoint.getSendLibrary(ARB_GATEWAY, SONIC_EID);
  console.log(`Send library: ${sendLib}`);
  
  const uln = new ethers.Contract(sendLib, ulnAbi, deployer);
  
  // Check current config
  const currentDvnConfig = await uln.getUlnConfig(ARB_GATEWAY, SONIC_EID);
  const currentExecConfig = await uln.getExecutorConfig(ARB_GATEWAY, SONIC_EID);
  
  console.log(`\nCurrent DVN config:`);
  console.log(`  Confirmations: ${currentDvnConfig.confirmations}`);
  console.log(`  Required DVNs: ${currentDvnConfig.requiredDVNs.join(", ")}`);
  
  console.log(`\nCurrent Executor config:`);
  console.log(`  Max message size: ${currentExecConfig.maxMessageSize}`);
  console.log(`  Executor: ${currentExecConfig.executor}`);
  
  // Set both DVN and Executor config
  console.log(`\n=== Setting DVN and Executor config ===`);
  
  // Config type 1 = Executor config
  const executorConfig = ethers.utils.defaultAbiCoder.encode(
    ["tuple(uint32, address)"],
    [[10000, ARB_EXECUTOR]] // maxMessageSize, executor
  );
  
  // Config type 2 = ULN config (DVN)
  const dvnConfig = ethers.utils.defaultAbiCoder.encode(
    ["tuple(uint64, uint8, uint8, uint8, address[], address[])"],
    [[
      20,  // confirmations
      1,   // requiredDVNCount
      0,   // optionalDVNCount
      0,   // optionalDVNThreshold
      [ARB_DVN], // requiredDVNs - LZ Labs DVN
      [], // optionalDVNs
    ]]
  );
  
  console.log(`Setting executor: ${ARB_EXECUTOR}`);
  console.log(`Setting DVN: ${ARB_DVN}`);
  
  const tx = await endpoint.setConfig(ARB_GATEWAY, sendLib, [
    { eid: SONIC_EID, configType: 1, config: executorConfig },
    { eid: SONIC_EID, configType: 2, config: dvnConfig },
  ], { gasLimit: 500000 });
  
  console.log(`TX: ${tx.hash}`);
  await tx.wait();
  console.log(`✅ Gateway send config updated!`);
  
  // Verify
  const newDvnConfig = await uln.getUlnConfig(ARB_GATEWAY, SONIC_EID);
  const newExecConfig = await uln.getExecutorConfig(ARB_GATEWAY, SONIC_EID);
  
  console.log(`\nNew DVN config:`);
  console.log(`  Required DVNs: ${newDvnConfig.requiredDVNs.join(", ")}`);
  
  console.log(`\nNew Executor config:`);
  console.log(`  Max message size: ${newExecConfig.maxMessageSize}`);
  console.log(`  Executor: ${newExecConfig.executor}`);
}

main().catch(console.error);


