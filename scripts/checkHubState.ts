import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const ARB_EID = 30110;
const NEW_GATEWAY = "0x2d603F7B0d06Bd5f6232Afe1991aF3D103d68071";
const OLD_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";

async function main() {
  console.log("=== Check Hub State ===");
  
  const hub = await ethers.getContractAt("SyntheticTokenHub", HUB_ADDRESS);
  
  // Check peers
  console.log("\n1. Check peers:");
  const arbPeer = await hub.peers(ARB_EID);
  console.log("Arbitrum peer:", arbPeer);
  console.log("Is new gateway:", arbPeer.toLowerCase().includes(NEW_GATEWAY.toLowerCase().slice(2)));
  console.log("Is old gateway:", arbPeer.toLowerCase().includes(OLD_GATEWAY.toLowerCase().slice(2)));
  
  // Check what function we have to list tokens
  console.log("\n2. Trying to find token info...");
  
  // Try various function names
  const hubInterface = hub.interface;
  const functions = Object.keys(hubInterface.functions);
  console.log("Available functions:", functions.filter(f => 
    f.includes('token') || f.includes('Token') || 
    f.includes('remote') || f.includes('Remote') ||
    f.includes('synth') || f.includes('Synth') ||
    f.includes('gateway') || f.includes('Gateway')
  ));
  
  // Check USDC token specifically
  const USDC_ARB = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  console.log("\n3. Looking for USDC mapping...");
  try {
    // Try to find if there's a token registered
    const tokenId = await hub.getTokenId(ARB_EID, USDC_ARB);
    console.log("Token ID for USDC:", tokenId.toString());
  } catch (e: any) {
    console.log("getTokenId error:", e.reason || e.message?.slice(0, 50));
  }
}

main().catch(console.error);
