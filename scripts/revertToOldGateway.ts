import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const OLD_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const ARB_EID = 30110;

async function main() {
  console.log("=== Revert Hub to Old Gateway ===");
  
  const hub = await ethers.getContractAt("SyntheticTokenHub", HUB_ADDRESS);
  const oldGatewayBytes32 = ethers.utils.hexZeroPad(OLD_GATEWAY, 32);
  
  console.log("Setting Hub peer back to OLD gateway:", OLD_GATEWAY);
  
  const tx = await hub.setPeer(ARB_EID, oldGatewayBytes32);
  console.log("TX:", tx.hash);
  await tx.wait();
  console.log("✓ Hub peer reverted to old gateway!");
  
  // Verify
  const peer = await hub.peers(ARB_EID);
  console.log("Verified peer:", peer);
}

main().catch(console.error);
