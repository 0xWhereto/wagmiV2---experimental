import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const OLD_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const ARBITRUM_EID = 30110;

async function main() {
  console.log("=== SETTING HUB PEER TO OLD GATEWAY ===\n");
  
  const hub = await ethers.getContractAt("SyntheticTokenHub", HUB);
  
  const tx = await hub.setPeer(ARBITRUM_EID, ethers.utils.hexZeroPad(OLD_GATEWAY, 32));
  await tx.wait();
  
  const peer = await hub.peers(ARBITRUM_EID);
  console.log(`Hub peer: ${peer}`);
  console.log("✅ Done!");
}

main().catch(console.error);
