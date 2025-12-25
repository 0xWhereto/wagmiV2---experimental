import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

/**
 * Diagnose peer mismatch between Hub and Gateways
 */

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const SONIC_RPC = "https://rpc.soniclabs.com";
const SONIC_EID = 30332;

const CHAINS = {
  arbitrum: {
    name: "Arbitrum",
    eid: 30110,
    rpc: "https://arb1.arbitrum.io/rpc",
    actualGateway: "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e", // What we used to bridge
  },
  base: {
    name: "Base",
    eid: 30184,
    rpc: "https://mainnet.base.org",
    actualGateway: "0xB712543E7fB87C411AAbB10c6823cf39bbEBB4Bb", // What we used to bridge
  },
  ethereum: {
    name: "Ethereum",
    eid: 30101,
    rpc: "https://ethereum-rpc.publicnode.com",
    actualGateway: "0xba36FC6568B953f691dd20754607590C59b7646a", // What we used to bridge
  }
};

const HUB_ABI = [
  "function peers(uint32) view returns (bytes32)",
];

const GATEWAY_ABI = [
  "function peers(uint32) view returns (bytes32)",
  "function DST_EID() view returns (uint32)",
];

async function main() {
  console.log("=".repeat(60));
  console.log("PEER CONFIGURATION DIAGNOSTIC");
  console.log("=".repeat(60));

  const sonicProvider = new ethers.providers.JsonRpcProvider(SONIC_RPC);
  const hub = new ethers.Contract(HUB_ADDRESS, HUB_ABI, sonicProvider);

  for (const [chainName, chain] of Object.entries(CHAINS)) {
    console.log(`\n${"=".repeat(40)}`);
    console.log(`${chain.name} (EID ${chain.eid})`);
    console.log("=".repeat(40));

    // 1. What does Hub think is the peer for this chain?
    const hubPeerBytes = await hub.peers(chain.eid);
    const hubPeerAddress = "0x" + hubPeerBytes.slice(26); // Extract address from bytes32
    console.log(`\nHub's peer for ${chain.name}:`);
    console.log(`  ${hubPeerAddress}`);

    // 2. What gateway are we actually using?
    console.log(`\nActual gateway we're using:`);
    console.log(`  ${chain.actualGateway}`);

    // 3. Check if they match
    const matches = hubPeerAddress.toLowerCase() === chain.actualGateway.toLowerCase();
    console.log(`\nMatch: ${matches ? "✅ YES" : "❌ NO - MISMATCH!"}`);

    if (!matches) {
      console.log(`\n⚠️ PROBLEM: Hub expects messages from ${hubPeerAddress}`);
      console.log(`   But we're sending from ${chain.actualGateway}`);
      console.log(`   Messages sent from actual gateway will be REJECTED by Hub!`);
    }

    // 4. Check gateway's peer configuration
    const chainProvider = new ethers.providers.JsonRpcProvider(chain.rpc);
    const gateway = new ethers.Contract(chain.actualGateway, GATEWAY_ABI, chainProvider);
    
    try {
      const dstEid = await gateway.DST_EID();
      const gatewayPeerBytes = await gateway.peers(SONIC_EID);
      const gatewayPeerAddress = "0x" + gatewayPeerBytes.slice(26);
      
      console.log(`\nGateway's config:`);
      console.log(`  DST_EID: ${dstEid}`);
      console.log(`  Peer for Sonic Hub: ${gatewayPeerAddress}`);
      
      const gatewayPointsToHub = gatewayPeerAddress.toLowerCase() === HUB_ADDRESS.toLowerCase();
      console.log(`  Points to Hub: ${gatewayPointsToHub ? "✅ YES" : "❌ NO"}`);
    } catch (e: any) {
      console.log(`  Error checking gateway: ${e.message?.slice(0, 50)}`);
    }
  }

  console.log(`\n\n${"=".repeat(60)}`);
  console.log("DIAGNOSIS SUMMARY");
  console.log("=".repeat(60));
  
  console.log(`
The issue appears to be that the Hub has OLD gateway addresses configured as peers,
but you're using NEW gateway addresses. This means:

1. Deposits ARE being sent via LayerZero ✅
2. Tokens ARE locked in the new gateways ✅
3. But the Hub will REJECT the messages ❌

SOLUTION OPTIONS:

Option A: Update Hub peers to point to the new gateways
  - You own the Hub (${HUB_ADDRESS})
  - Call: hub.setPeer(30110, "0x000...${CHAINS.arbitrum.actualGateway.slice(2)}")
  - Call: hub.setPeer(30184, "0x000...${CHAINS.base.actualGateway.slice(2)}")
  - Call: hub.setPeer(30101, "0x000...${CHAINS.ethereum.actualGateway.slice(2)}")

Option B: Use the old gateways that Hub knows about
  - Arbitrum: 0x7d4877d3c814f09f71fb779402d94f7fb45ca50c
  - Base: 0x46102e4227f3ef07c08b19fc07a1ad79a427329d
  - Ethereum: 0x9cbc0a8e6ab21780498a6b2f9cde7d487b7e5095
  `);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


