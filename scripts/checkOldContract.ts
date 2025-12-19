import { ethers } from "hardhat";

const OLD_CONTRACT = "0x4208D6E27538189bB48E603D6123A94b8Abe0A0b";
const CURRENT_HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=== CHECKING OLD CONTRACT ===\n");
  
  console.log(`OLD Contract: ${OLD_CONTRACT}`);
  console.log(`Current Hub: ${CURRENT_HUB}`);
  
  // Check if old contract has code
  const oldCode = await deployer.provider!.getCode(OLD_CONTRACT);
  console.log(`OLD contract has code: ${oldCode.length > 2}`);
  
  // Check current Hub
  const hubCode = await deployer.provider!.getCode(CURRENT_HUB);
  console.log(`Current Hub has code: ${hubCode.length > 2}`);
  
  // Check if they're the same
  if (OLD_CONTRACT.toLowerCase() !== CURRENT_HUB.toLowerCase()) {
    console.log("\n⚠️ OLD CONTRACT IS DIFFERENT FROM CURRENT HUB!");
    console.log("The old working setup was using a DIFFERENT Hub contract.");
    
    // Check the old Hub's endpoint config
    const hubAbi = [
      "function endpoint() view returns (address)",
      "function owner() view returns (address)",
    ];
    
    const oldHub = new ethers.Contract(OLD_CONTRACT, hubAbi, deployer);
    
    try {
      const oldEndpoint = await oldHub.endpoint();
      console.log(`\nOLD Hub endpoint: ${oldEndpoint}`);
      
      const oldOwner = await oldHub.owner();
      console.log(`OLD Hub owner: ${oldOwner}`);
    } catch (e) {
      console.log("Could not read old Hub properties");
    }
    
    const newHub = new ethers.Contract(CURRENT_HUB, hubAbi, deployer);
    
    try {
      const newEndpoint = await newHub.endpoint();
      console.log(`\nNEW Hub endpoint: ${newEndpoint}`);
      
      const newOwner = await newHub.owner();
      console.log(`NEW Hub owner: ${newOwner}`);
    } catch (e) {
      console.log("Could not read new Hub properties");
    }
  }
  
  // Check LZ endpoint for old Hub
  console.log("\n=== CHECKING LZ ENDPOINT CONFIG FOR OLD HUB ===");
  
  const LZ_ENDPOINT = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
  const ARB_EID = 30110;
  
  const endpointAbi = [
    "function delegates(address) view returns (address)",
    "function inboundNonce(address, uint32, bytes32) view returns (uint64)",
  ];
  
  const endpoint = new ethers.Contract(LZ_ENDPOINT, endpointAbi, deployer);
  
  // Check delegates
  try {
    const oldDelegate = await endpoint.delegates(OLD_CONTRACT);
    const newDelegate = await endpoint.delegates(CURRENT_HUB);
    console.log(`OLD Hub delegate: ${oldDelegate}`);
    console.log(`NEW Hub delegate: ${newDelegate}`);
  } catch (e: any) {
    console.log(`Error: ${e.message?.substring(0, 60)}`);
  }
}

main().catch(console.error);
