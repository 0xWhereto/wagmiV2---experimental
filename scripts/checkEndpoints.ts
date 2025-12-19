import { ethers } from "hardhat";

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  console.log("=== Comparing Gateway Endpoints ===\n");
  
  const oappAbi = [
    "function endpoint() view returns (address)",
    "function DST_EID() view returns (uint32)",
    "function peers(uint32) view returns (bytes32)",
  ];
  
  const gateways = [
    { name: "NEW", address: "0x527f843672C4CD7F45B126f3E1E82D60A741C609" },
    { name: "OLD", address: "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e" },
  ];
  
  for (const gw of gateways) {
    console.log(`${gw.name} Gateway: ${gw.address}`);
    const gateway = new ethers.Contract(gw.address, oappAbi, provider);
    
    const endpoint = await gateway.endpoint();
    const dstEid = await gateway.DST_EID();
    const peer = await gateway.peers(dstEid);
    
    console.log(`  Endpoint: ${endpoint}`);
    console.log(`  DST_EID: ${dstEid}`);
    console.log(`  Peer: ${peer}`);
    console.log();
  }
}

main().catch(console.error);
