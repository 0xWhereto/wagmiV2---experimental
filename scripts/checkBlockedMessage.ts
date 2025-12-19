import { ethers } from "hardhat";

// The WETH bridge TX that's blocked
const WETH_TX = "0xad57521ddad7e6cf1023c066a6e4e6fc3f11d6d778c303265589e8cce99d15c6";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const ARB_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";

const LZ_ENDPOINT_SONIC = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
const LZ_ENDPOINT_ARB = "0x1a44076050125825900e736c501f859c50fE728c";

const SONIC_EID = 30332;
const ARB_EID = 30110;

async function main() {
  console.log("=== CHECKING BLOCKED WETH MESSAGE ===\n");
  
  const arbProvider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  const sonicProvider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");
  
  // Get the TX details from Arbitrum
  console.log("1. SOURCE TX ON ARBITRUM:");
  try {
    const tx = await arbProvider.getTransaction(WETH_TX);
    const receipt = await arbProvider.getTransactionReceipt(WETH_TX);
    console.log(`   Status: ${receipt?.status === 1 ? "✅ Success" : "❌ Failed"}`);
    console.log(`   Block: ${tx?.blockNumber}`);
    console.log(`   To: ${tx?.to}`);
    
    // Parse LZ packet sent event
    const lzEventTopic = ethers.utils.id("PacketSent(bytes,bytes,address)");
    const packetLog = receipt?.logs.find(l => l.topics[0] === lzEventTopic);
    if (packetLog) {
      console.log(`   LZ PacketSent found!`);
    }
  } catch (e: any) {
    console.log(`   Error: ${e.message?.slice(0, 100)}`);
  }
  
  // Check nonces on Sonic
  console.log("\n\n2. MESSAGE NONCES ON SONIC:");
  const endpointAbi = [
    "function inboundNonce(address _receiver, uint32 _srcEid, bytes32 _sender) view returns (uint64)",
    "function lazyInboundNonce(address _receiver, uint32 _srcEid, bytes32 _sender) view returns (uint64)",
  ];
  
  const sonicEndpoint = new ethers.Contract(LZ_ENDPOINT_SONIC, endpointAbi, sonicProvider);
  const senderBytes32 = ethers.utils.hexZeroPad(ARB_GATEWAY, 32);
  
  try {
    const inboundNonce = await sonicEndpoint.inboundNonce(HUB, ARB_EID, senderBytes32);
    const lazyNonce = await sonicEndpoint.lazyInboundNonce(HUB, ARB_EID, senderBytes32);
    console.log(`   Inbound nonce (executed): ${inboundNonce}`);
    console.log(`   Lazy nonce (verified): ${lazyNonce}`);
    
    if (lazyNonce.gt(inboundNonce)) {
      console.log(`   ⚠️ ${lazyNonce.sub(inboundNonce).toString()} messages verified but not executed`);
    } else {
      console.log(`   Messages are being executed normally`);
    }
  } catch (e: any) {
    console.log(`   Error: ${e.message?.slice(0, 100)}`);
  }
  
  // Check the receive ULN302 for verification status
  console.log("\n\n3. CHECKING RECEIVE ULN CONFIG:");
  
  const receiveUln = "0xe1844c5D63a9543023008D332Bd3d2e6f1FE1043";
  const ulnAbi = [
    "function getUlnConfig(address _oapp, uint32 _remoteEid) view returns (tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs))",
    "function verifiable(tuple(uint32 srcEid, bytes32 sender, address receiver, uint64 nonce) _header, bytes32 _payloadHash) view returns (bool)",
  ];
  
  const uln = new ethers.Contract(receiveUln, ulnAbi, sonicProvider);
  
  try {
    const config = await uln.getUlnConfig(HUB, ARB_EID);
    console.log(`   Confirmations required: ${config.confirmations}`);
    console.log(`   Required DVN count: ${config.requiredDVNCount}`);
    console.log(`   Required DVNs:`);
    for (const dvn of config.requiredDVNs) {
      console.log(`      ${dvn}`);
    }
  } catch (e: any) {
    console.log(`   Error: ${e.message?.slice(0, 100)}`);
  }
  
  // List all known DVN addresses
  console.log("\n\n4. KNOWN DVN ADDRESSES:");
  console.log(`
LayerZero Labs DVN addresses (from official docs):
- Arbitrum: 0x2f55c492897526677c5b68fb199ea31e2c126416
- Sonic: ? (need to verify)

The config file uses these DVN pairs:
- Arbitrum send: 0x2f55c492897526677c5b68fb199ea31e2c126416
- Sonic receive: 0x282b3386571f7f794450d5789911a9804fa346b4

If these are NOT corresponding DVN pairs from the same provider,
the message will be BLOCKED because the DVN that signed on Arbitrum
is not trusted by the Hub on Sonic.
  `);
  
  console.log("\n\n5. RECOMMENDED FIX:");
  console.log(`
Option 1: Use DEFAULT DVNs
- Update Gateway send config to use default DVN on Arbitrum
- Update Hub receive config to use default DVN on Sonic

Option 2: Verify DVN correspondence
- Find official LZ Labs DVN mapping for Arbitrum <-> Sonic
- Update configs to use matching pairs
  `);
}

main().catch(console.error);

