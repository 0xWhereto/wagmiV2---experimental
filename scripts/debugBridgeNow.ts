import { ethers } from "hardhat";

const LZ_ENDPOINT_SONIC = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const ARB_EID = 30110;

// Both gateway addresses
const OLD_ARB_GATEWAY = "0x527f843672C4CD7F45B126f3E1E82D60A741C609";
const NEW_ARB_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";

// The bridge TX we just did
const BRIDGE_TX = "0x691cc2115ecf8aa5ca64d4ee35ec5bea31f43563f92e9feddd832a6be2e9fd45";

async function main() {
  console.log("=== DEBUGGING BRIDGE TX ===\n");
  
  const sonicProvider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");
  const arbProvider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  // 1. Check the bridge transaction on Arbitrum
  console.log("1. BRIDGE TRANSACTION ON ARBITRUM:");
  try {
    const tx = await arbProvider.getTransaction(BRIDGE_TX);
    const receipt = await arbProvider.getTransactionReceipt(BRIDGE_TX);
    console.log(`   Status: ${receipt?.status === 1 ? "✅ Success" : "❌ Failed"}`);
    console.log(`   Block: ${tx?.blockNumber}`);
    console.log(`   To: ${tx?.to}`);
    console.log(`   Logs: ${receipt?.logs.length}`);
    
    // Parse events
    const gatewayAbi = [
      "event MessageSent(uint8 messageType, bytes32 guid, address from, address to, tuple(address tokenAddress, uint256 tokenAmount)[] assets)"
    ];
    const iface = new ethers.utils.Interface(gatewayAbi);
    
    for (const log of receipt?.logs || []) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed.name === "MessageSent") {
          console.log(`\n   📤 MessageSent Event:`);
          console.log(`      GUID: ${parsed.args.guid}`);
          console.log(`      From: ${parsed.args.from}`);
          console.log(`      To: ${parsed.args.to}`);
        }
      } catch (e) {
        // Not a MessageSent event
      }
    }
  } catch (e: any) {
    console.log(`   Error: ${e.message?.slice(0, 100)}`);
  }
  
  // 2. Check message nonces on Sonic endpoint
  console.log("\n\n2. LAYERZERO MESSAGE NONCES ON SONIC:");
  
  const endpointAbi = [
    "function inboundNonce(address _receiver, uint32 _srcEid, bytes32 _sender) view returns (uint64)",
    "function lazyInboundNonce(address _receiver, uint32 _srcEid, bytes32 _sender) view returns (uint64)",
  ];
  
  const endpoint = new ethers.Contract(LZ_ENDPOINT_SONIC, endpointAbi, sonicProvider);
  
  // Check OLD gateway
  console.log("\n   OLD Gateway (0x527f...):");
  const oldSenderBytes = ethers.utils.hexZeroPad(OLD_ARB_GATEWAY, 32);
  try {
    const oldInbound = await endpoint.inboundNonce(HUB, ARB_EID, oldSenderBytes);
    const oldLazy = await endpoint.lazyInboundNonce(HUB, ARB_EID, oldSenderBytes);
    console.log(`      Inbound nonce: ${oldInbound}`);
    console.log(`      Lazy nonce: ${oldLazy}`);
    if (oldLazy > oldInbound) {
      console.log(`      ⚠️ ${Number(oldLazy) - Number(oldInbound)} pending messages from OLD gateway`);
    }
  } catch (e: any) {
    console.log(`      Error: ${e.message?.slice(0, 50)}`);
  }
  
  // Check NEW gateway
  console.log("\n   NEW Gateway (0x187d...):");
  const newSenderBytes = ethers.utils.hexZeroPad(NEW_ARB_GATEWAY, 32);
  try {
    const newInbound = await endpoint.inboundNonce(HUB, ARB_EID, newSenderBytes);
    const newLazy = await endpoint.lazyInboundNonce(HUB, ARB_EID, newSenderBytes);
    console.log(`      Inbound nonce: ${newInbound}`);
    console.log(`      Lazy nonce: ${newLazy}`);
    if (newLazy > newInbound) {
      console.log(`      ⚠️ ${Number(newLazy) - Number(newInbound)} pending messages from NEW gateway`);
    }
  } catch (e: any) {
    console.log(`      Error: ${e.message?.slice(0, 50)}`);
  }
  
  // 3. Check Hub's current peer for Arbitrum
  console.log("\n\n3. HUB PEER CONFIGURATION:");
  const hubAbi = ["function peers(uint32) view returns (bytes32)"];
  const hub = new ethers.Contract(HUB, hubAbi, sonicProvider);
  
  try {
    const peer = await hub.peers(ARB_EID);
    const peerAddress = "0x" + peer.slice(26);
    console.log(`   Arbitrum peer: ${peerAddress}`);
    
    if (peerAddress.toLowerCase() === NEW_ARB_GATEWAY.toLowerCase()) {
      console.log(`   ✅ Peer is correctly set to NEW gateway`);
    } else if (peerAddress.toLowerCase() === OLD_ARB_GATEWAY.toLowerCase()) {
      console.log(`   ❌ Peer is still set to OLD gateway!`);
    } else {
      console.log(`   ❓ Peer is set to unknown address`);
    }
  } catch (e: any) {
    console.log(`   Error: ${e.message?.slice(0, 50)}`);
  }
  
  // 4. Check DVN configuration
  console.log("\n\n4. DVN CONFIGURATION:");
  console.log("   Checking if the message can be verified...");
  
  // Check the receive ULN config
  const receiveLibAbi = [
    "function getUlnConfig(address _oapp, uint32 _remoteEid) view returns (tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs))",
  ];
  
  const receiveLib = "0xe1844c5D63a9543023008D332Bd3d2e6f1FE1043";
  const lib = new ethers.Contract(receiveLib, receiveLibAbi, sonicProvider);
  
  try {
    const ulnConfig = await lib.getUlnConfig(HUB, ARB_EID);
    console.log(`   Required confirmations: ${ulnConfig.confirmations}`);
    console.log(`   Required DVNs: ${ulnConfig.requiredDVNs.length}`);
    for (const dvn of ulnConfig.requiredDVNs) {
      console.log(`      - ${dvn}`);
    }
  } catch (e: any) {
    console.log(`   Error getting ULN config: ${e.message?.slice(0, 100)}`);
  }
  
  console.log("\n\n=== NEXT STEPS ===");
  console.log(`1. Check LayerZero Scan: https://layerzeroscan.com/tx/${BRIDGE_TX}`);
  console.log("2. If message is 'Inflight', wait for DVN verification");
  console.log("3. If message is 'Failed', check the error on LayerZero Scan");
  console.log("4. If message is 'Delivered' but no tokens received, check Hub _lzReceive logic");
}

main().catch(console.error);


