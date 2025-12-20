import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const NEW_GATEWAY = "0x6896e0B5C67555bDd0889861C143eE0a7637d233";
const ARBITRUM_EID = 30110;

async function main() {
  console.log("=== UPDATING HUB PEER TO NEW GATEWAY ===\n");
  
  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);
  
  const hub = await ethers.getContractAt("SyntheticTokenHub", HUB);
  
  // Check current peer
  const currentPeer = await hub.peers(ARBITRUM_EID);
  console.log(`Current Arbitrum peer: ${currentPeer}`);
  
  // Set new peer
  const newPeerBytes32 = ethers.utils.hexZeroPad(NEW_GATEWAY, 32);
  console.log(`\nSetting new peer: ${NEW_GATEWAY}`);
  console.log(`As bytes32: ${newPeerBytes32}`);
  
  const tx = await hub.setPeer(ARBITRUM_EID, newPeerBytes32);
  console.log(`TX: ${tx.hash}`);
  await tx.wait();
  console.log("✅ Hub peer updated!");
  
  // Verify
  const updatedPeer = await hub.peers(ARBITRUM_EID);
  console.log(`\nVerified new peer: ${updatedPeer}`);
}

main().catch(console.error);
