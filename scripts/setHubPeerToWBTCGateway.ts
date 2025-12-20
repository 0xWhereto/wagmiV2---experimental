import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const WBTC_GATEWAY = "0x420eA5C5ED48056bD262dB4694953dC0C9DA9662";
const ARBITRUM_EID = 30110;

async function main() {
  console.log("=== SETTING HUB PEER TO WBTC GATEWAY ===\n");
  
  const [signer] = await ethers.getSigners();
  const hub = await ethers.getContractAt("SyntheticTokenHub", HUB);
  
  const currentPeer = await hub.peers(ARBITRUM_EID);
  console.log(`Current peer: ${currentPeer}`);
  
  const newPeer = ethers.utils.hexZeroPad(WBTC_GATEWAY, 32);
  console.log(`Setting to: ${WBTC_GATEWAY}`);
  
  const tx = await hub.setPeer(ARBITRUM_EID, newPeer);
  await tx.wait();
  console.log("✅ Done!");
  
  const updatedPeer = await hub.peers(ARBITRUM_EID);
  console.log(`New peer: ${updatedPeer}`);
}

main().catch(console.error);
