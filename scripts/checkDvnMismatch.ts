import { ethers } from "hardhat";

// Contracts
const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const NEW_ARB_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";

// LayerZero Endpoints
const LZ_ENDPOINT_SONIC = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
const LZ_ENDPOINT_ARB = "0x1a44076050125825900e736c501f859c50fE728c";

// EIDs
const SONIC_EID = 30332;
const ARB_EID = 30110;

// Send/Receive Libraries
const SONIC_RECEIVE_LIB = "0xe1844c5D63a9543023008D332Bd3d2e6f1FE1043";
const ARB_SEND_LIB = "0x975bcD720be66659e3EB3C0e4F1866a3020E493A";

const ULN_ABI = [
  "function getUlnConfig(address _oapp, uint32 _remoteEid) view returns (tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs))",
];

const ENDPOINT_ABI = [
  "function getSendLibrary(address _sender, uint32 _dstEid) view returns (address)",
  "function getReceiveLibrary(address _receiver, uint32 _srcEid) view returns (address, bool)",
];

async function main() {
  console.log("=== CHECKING DVN CONFIGURATION MISMATCH ===\n");
  
  const sonicProvider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");
  const arbProvider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  // 1. Check Gateway's send config on Arbitrum
  console.log("1. GATEWAY SEND CONFIG (Arbitrum -> Sonic):");
  
  const arbEndpoint = new ethers.Contract(LZ_ENDPOINT_ARB, ENDPOINT_ABI, arbProvider);
  
  try {
    const sendLib = await arbEndpoint.getSendLibrary(NEW_ARB_GATEWAY, SONIC_EID);
    console.log(`   Send Library: ${sendLib}`);
    
    const arbUln = new ethers.Contract(sendLib, ULN_ABI, arbProvider);
    const sendConfig = await arbUln.getUlnConfig(NEW_ARB_GATEWAY, SONIC_EID);
    
    console.log(`   Confirmations: ${sendConfig.confirmations}`);
    console.log(`   Required DVNs (${sendConfig.requiredDVNCount}):`);
    for (const dvn of sendConfig.requiredDVNs) {
      console.log(`      - ${dvn}`);
    }
    console.log(`   Optional DVNs (threshold ${sendConfig.optionalDVNThreshold}/${sendConfig.optionalDVNCount}):`);
    for (const dvn of sendConfig.optionalDVNs) {
      console.log(`      - ${dvn}`);
    }
  } catch (e: any) {
    console.log(`   Error: ${e.message?.slice(0, 150)}`);
  }
  
  // 2. Check Hub's receive config on Sonic
  console.log("\n\n2. HUB RECEIVE CONFIG (Arbitrum -> Sonic):");
  
  const sonicEndpoint = new ethers.Contract(LZ_ENDPOINT_SONIC, ENDPOINT_ABI, sonicProvider);
  
  try {
    const [receiveLib, isDefault] = await sonicEndpoint.getReceiveLibrary(HUB, ARB_EID);
    console.log(`   Receive Library: ${receiveLib} ${isDefault ? "(default)" : ""}`);
    
    const sonicUln = new ethers.Contract(receiveLib, ULN_ABI, sonicProvider);
    const receiveConfig = await sonicUln.getUlnConfig(HUB, ARB_EID);
    
    console.log(`   Confirmations: ${receiveConfig.confirmations}`);
    console.log(`   Required DVNs (${receiveConfig.requiredDVNCount}):`);
    for (const dvn of receiveConfig.requiredDVNs) {
      console.log(`      - ${dvn}`);
    }
    console.log(`   Optional DVNs (threshold ${receiveConfig.optionalDVNThreshold}/${receiveConfig.optionalDVNCount}):`);
    for (const dvn of receiveConfig.optionalDVNs) {
      console.log(`      - ${dvn}`);
    }
  } catch (e: any) {
    console.log(`   Error: ${e.message?.slice(0, 150)}`);
  }
  
  console.log("\n\n=== ANALYSIS ===");
  console.log(`
For a LayerZero message to be verified and delivered:
1. The sender's Send DVNs must sign/verify the message
2. The receiver's Receive config must trust those SAME DVNs

If the DVN addresses don't match between send and receive configs,
the message will be stuck in "Verifying" state indefinitely.

KEY: DVN addresses are DIFFERENT per chain! 
The Arbitrum DVN address and Sonic DVN address for the SAME DVN provider
are different, but they must be the corresponding pair.

LayerZero DVN addresses:
- Arbitrum LZ Labs DVN: 0x2f55c492897526677c5b68fb199ea31e2c126416
- Sonic LZ Labs DVN: 0x282b3386571f7f794450d5789911a9804fa346b4
  `);
}

main().catch(console.error);


