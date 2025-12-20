import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const NEW_WBTC_GATEWAY = "0xbA69c4938BE6bB8204415689d72af1324Cc5c3bA";
const ARBITRUM_EID = 30110;

async function main() {
  console.log("=== UPDATING HUB PEER TO FINAL WBTC GATEWAY ===\n");
  
  const [signer] = await ethers.getSigners();
  const hub = await ethers.getContractAt("SyntheticTokenHub", HUB);
  
  const currentPeer = await hub.peers(ARBITRUM_EID);
  console.log(`Current peer: ${currentPeer}`);
  
  const newPeer = ethers.utils.hexZeroPad(NEW_WBTC_GATEWAY, 32);
  const tx = await hub.setPeer(ARBITRUM_EID, newPeer);
  await tx.wait();
  
  const updatedPeer = await hub.peers(ARBITRUM_EID);
  console.log(`New peer: ${updatedPeer}`);
  console.log("✅ Done!");
}

main().catch(console.error);
