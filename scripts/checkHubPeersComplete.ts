import { ethers } from "hardhat";

const CURRENT_HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const NEW_ARB_GATEWAY = "0x527f843672C4CD7F45B126f3E1E82D60A741C609";
const NEW_ETH_GATEWAY = "0x5826e10B513C891910032F15292B2F1b3041C3Df";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=== CHECKING HUB PEERS ===\n");
  
  const hubAbi = [
    "function peers(uint32) view returns (bytes32)",
  ];
  
  const hub = new ethers.Contract(CURRENT_HUB, hubAbi, deployer);
  
  const checks = [
    { name: "Arbitrum", eid: 30110, expected: NEW_ARB_GATEWAY },
    { name: "Ethereum", eid: 30101, expected: NEW_ETH_GATEWAY },
  ];
  
  for (const check of checks) {
    const peer = await hub.peers(check.eid);
    const expectedBytes = ethers.utils.hexZeroPad(check.expected, 32).toLowerCase();
    
    console.log(`${check.name} (EID ${check.eid}):`);
    console.log(`  Hub peer: ${peer}`);
    console.log(`  Expected: ${expectedBytes}`);
    console.log(`  Match: ${peer.toLowerCase() === expectedBytes ? "✅ YES" : "❌ NO"}`);
    console.log();
  }
  
  // Also verify the gateways point to this Hub
  console.log("=== CHECKING GATEWAYS POINT TO HUB ===\n");
  
  const gatewayAbi = [
    "function peers(uint32) view returns (bytes32)",
    "function DST_EID() view returns (uint32)",
  ];
  
  const SONIC_EID = 30332;
  const expectedHubBytes = ethers.utils.hexZeroPad(CURRENT_HUB, 32).toLowerCase();
  
  const gateways = [
    { name: "Arbitrum Gateway", address: NEW_ARB_GATEWAY, rpc: "https://arb1.arbitrum.io/rpc" },
    { name: "Ethereum Gateway", address: NEW_ETH_GATEWAY, rpc: "https://ethereum-rpc.publicnode.com" },
  ];
  
  for (const gw of gateways) {
    const provider = new ethers.providers.JsonRpcProvider(gw.rpc);
    const gateway = new ethers.Contract(gw.address, gatewayAbi, provider);
    
    const peer = await gateway.peers(SONIC_EID);
    console.log(`${gw.name}:`);
    console.log(`  Gateway peer: ${peer}`);
    console.log(`  Expected Hub: ${expectedHubBytes}`);
    console.log(`  Match: ${peer.toLowerCase() === expectedHubBytes ? "✅ YES" : "❌ NO"}`);
    console.log();
  }
}

main().catch(console.error);
