import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const ARB_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";

const LZ_ENDPOINT_SONIC = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
const LZ_ENDPOINT_ARB = "0x1a44076050125825900e736c501f859c50fE728c";

const SONIC_EID = 30332;
const ARB_EID = 30110;

async function main() {
  console.log("=== INVESTIGATING DVN CONFIGURATION ===\n");
  
  const sonicProvider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");
  const arbProvider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  const endpointAbi = [
    "function getSendLibrary(address _sender, uint32 _dstEid) view returns (address)",
    "function getReceiveLibrary(address _receiver, uint32 _srcEid) view returns (address, bool)",
    "function defaultSendLibrary(uint32 _dstEid) view returns (address)",
    "function defaultReceiveLibrary(uint32 _srcEid) view returns (address)",
  ];
  
  const ulnAbi = [
    "function getUlnConfig(address _oapp, uint32 _remoteEid) view returns (tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs))",
  ];
  
  // 1. Check Gateway's SEND config (Arbitrum -> Sonic)
  console.log("1. ARBITRUM GATEWAY SEND CONFIG:");
  const arbEndpoint = new ethers.Contract(LZ_ENDPOINT_ARB, endpointAbi, arbProvider);
  
  try {
    const sendLib = await arbEndpoint.getSendLibrary(ARB_GATEWAY, SONIC_EID);
    console.log(`   Send Library: ${sendLib}`);
    
    const sendUln = new ethers.Contract(sendLib, ulnAbi, arbProvider);
    const sendConfig = await sendUln.getUlnConfig(ARB_GATEWAY, SONIC_EID);
    console.log(`   Confirmations: ${sendConfig.confirmations}`);
    console.log(`   Required DVNs on ARBITRUM:`);
    for (const dvn of sendConfig.requiredDVNs) {
      console.log(`      ${dvn}`);
    }
  } catch (e: any) {
    console.log(`   Error: ${e.message?.slice(0, 100)}`);
  }
  
  // 2. Check Hub's RECEIVE config (from Arbitrum)
  console.log("\n\n2. SONIC HUB RECEIVE CONFIG:");
  const sonicEndpoint = new ethers.Contract(LZ_ENDPOINT_SONIC, endpointAbi, sonicProvider);
  
  try {
    const [receiveLib, isDefault] = await sonicEndpoint.getReceiveLibrary(HUB, ARB_EID);
    console.log(`   Receive Library: ${receiveLib} (default: ${isDefault})`);
    
    const receiveUln = new ethers.Contract(receiveLib, ulnAbi, sonicProvider);
    const receiveConfig = await receiveUln.getUlnConfig(HUB, ARB_EID);
    console.log(`   Confirmations: ${receiveConfig.confirmations}`);
    console.log(`   Required DVNs on SONIC:`);
    for (const dvn of receiveConfig.requiredDVNs) {
      console.log(`      ${dvn}`);
    }
  } catch (e: any) {
    console.log(`   Error: ${e.message?.slice(0, 100)}`);
  }
  
  // 3. Check DEFAULT configs
  console.log("\n\n3. DEFAULT LIBRARY CONFIGS:");
  
  try {
    const defaultSendLib = await arbEndpoint.defaultSendLibrary(SONIC_EID);
    console.log(`   Arbitrum default send lib to Sonic: ${defaultSendLib}`);
    
    const defaultSendUln = new ethers.Contract(defaultSendLib, ulnAbi, arbProvider);
    const defaultSendConfig = await defaultSendUln.getUlnConfig(ethers.constants.AddressZero, SONIC_EID);
    console.log(`   Default send DVNs on Arbitrum:`);
    for (const dvn of defaultSendConfig.requiredDVNs) {
      console.log(`      ${dvn}`);
    }
  } catch (e: any) {
    console.log(`   Error getting default send: ${e.message?.slice(0, 100)}`);
  }
  
  try {
    const defaultReceiveLib = await sonicEndpoint.defaultReceiveLibrary(ARB_EID);
    console.log(`\n   Sonic default receive lib from Arbitrum: ${defaultReceiveLib}`);
    
    const defaultReceiveUln = new ethers.Contract(defaultReceiveLib, ulnAbi, sonicProvider);
    const defaultReceiveConfig = await defaultReceiveUln.getUlnConfig(ethers.constants.AddressZero, ARB_EID);
    console.log(`   Default receive DVNs on Sonic:`);
    for (const dvn of defaultReceiveConfig.requiredDVNs) {
      console.log(`      ${dvn}`);
    }
  } catch (e: any) {
    console.log(`   Error getting default receive: ${e.message?.slice(0, 100)}`);
  }
  
  console.log("\n\n=== ANALYSIS ===");
  console.log(`
The Gateway's send config specifies which DVNs will SIGN the message on Arbitrum.
The Hub's receive config specifies which DVNs it TRUSTS to verify on Sonic.

These must be CORRESPONDING DVN pairs:
- If Gateway uses LZ Labs DVN on Arbitrum, Hub must trust LZ Labs DVN on Sonic
- The DVN addresses are different per chain but from the same provider

If they don't match, the message will be BLOCKED.
  `);
}

main().catch(console.error);

