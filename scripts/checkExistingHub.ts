import { ethers } from "hardhat";

const EXISTING_HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  const hubAbi = [
    "function owner() view returns (address)",
    "function endpoint() view returns (address)",
    "function peers(uint32) view returns (bytes32)",
    "function balancer() view returns (address)",
    "function isPaused() view returns (bool)"
  ];
  
  const hub = new ethers.Contract(EXISTING_HUB, hubAbi, deployer);
  
  try {
    const owner = await hub.owner();
    console.log("Owner:", owner);
    
    const endpoint = await hub.endpoint();
    console.log("Endpoint:", endpoint);
    
    const balancer = await hub.balancer();
    console.log("Balancer:", balancer);
    
    // Check peer for Arbitrum (EID 30110)
    const arbPeer = await hub.peers(30110);
    console.log("Arbitrum peer:", arbPeer);
    
    // Check peer for Ethereum (EID 30101)
    const ethPeer = await hub.peers(30101);
    console.log("Ethereum peer:", ethPeer);
    
    console.log("\nHub contract is working! We can reuse it.");
  } catch (e: any) {
    console.log("Error:", e.message);
  }
}

main().catch(console.error);
