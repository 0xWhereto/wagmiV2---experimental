import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const GETTERS_ADDRESS = "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  // Try reading from the Hub directly using storage slots or getters
  const gettersAbi = [
    "function getAllSyntheticTokens() view returns (address[] memory)",
    "function getSyntheticToken(uint256 id) view returns (address)",
  ];
  
  const hubAbi = [
    "function tokenIdCounter() view returns (uint256)",
    "function syntheticTokens(uint256) view returns (address)",
  ];

  // Try the getters contract
  try {
    const getters = new ethers.Contract(GETTERS_ADDRESS, gettersAbi, deployer);
    const tokens = await getters.getAllSyntheticTokens();
    console.log("Synthetic tokens from getters:");
    tokens.forEach((t: string, i: number) => console.log(`  ${i+1}: ${t}`));
  } catch (e: any) {
    console.log("Getters getAllSyntheticTokens failed:", e.reason || "N/A");
  }

  // Try reading tokenIdCounter
  try {
    const hub = new ethers.Contract(HUB_ADDRESS, hubAbi, deployer);
    const counter = await hub.tokenIdCounter();
    console.log(`\nToken ID counter: ${counter.toString()}`);
    
    for (let i = 1; i <= counter.toNumber(); i++) {
      const token = await hub.syntheticTokens(i);
      console.log(`Token ${i}: ${token}`);
    }
  } catch (e: any) {
    console.log("Hub tokenIdCounter failed:", e.reason || "N/A");
  }

  // Try with different function name
  const hubAbi2 = [
    "function nextTokenId() view returns (uint256)",
    "function getSyntheticTokenById(uint256) view returns (address)",
  ];

  try {
    const hub2 = new ethers.Contract(HUB_ADDRESS, hubAbi2, deployer);
    const nextId = await hub2.nextTokenId();
    console.log(`\nNext token ID: ${nextId.toString()}`);
  } catch (e) {
    console.log("nextTokenId failed");
  }
}

main().catch(console.error);
