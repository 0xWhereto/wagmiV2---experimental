import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

/**
 * Fix Hub peers to point to the correct (new) gateways
 */

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const SONIC_RPC = "https://rpc.soniclabs.com";

// New gateway addresses that we're actually using
const NEW_GATEWAYS = {
  arbitrum: {
    eid: 30110,
    address: "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e",
  },
  base: {
    eid: 30184,
    address: "0xB712543E7fB87C411AAbB10c6823cf39bbEBB4Bb",
  },
  ethereum: {
    eid: 30101,
    address: "0xba36FC6568B953f691dd20754607590C59b7646a",
  },
};

const HUB_ABI = [
  "function owner() view returns (address)",
  "function peers(uint32) view returns (bytes32)",
  "function setPeer(uint32 _eid, bytes32 _peer) external",
];

async function main() {
  console.log("=".repeat(60));
  console.log("FIX HUB PEERS");
  console.log("=".repeat(60));

  if (!process.env.PRIVATE_KEY) {
    console.log("❌ PRIVATE_KEY not found");
    return;
  }

  const provider = new ethers.providers.JsonRpcProvider(SONIC_RPC);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  console.log(`Wallet: ${wallet.address}`);

  const hub = new ethers.Contract(HUB_ADDRESS, HUB_ABI, wallet);

  // Verify ownership
  const owner = await hub.owner();
  console.log(`Hub owner: ${owner}`);
  
  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.log(`❌ You are not the Hub owner!`);
    return;
  }
  console.log(`✅ You are the Hub owner\n`);

  // Check current peers vs new gateways
  console.log("--- Current vs New Peers ---");
  for (const [chain, config] of Object.entries(NEW_GATEWAYS)) {
    const currentPeer = await hub.peers(config.eid);
    const currentAddr = "0x" + currentPeer.slice(26);
    const newPeerBytes = ethers.utils.hexZeroPad(config.address, 32);
    
    console.log(`\n${chain.toUpperCase()} (EID ${config.eid}):`);
    console.log(`  Current: ${currentAddr}`);
    console.log(`  New:     ${config.address}`);
    console.log(`  Match:   ${currentAddr.toLowerCase() === config.address.toLowerCase() ? "✅" : "❌"}`);
  }

  // Update peers
  console.log("\n--- Updating Peers ---");
  for (const [chain, config] of Object.entries(NEW_GATEWAYS)) {
    const currentPeer = await hub.peers(config.eid);
    const currentAddr = "0x" + currentPeer.slice(26);
    
    if (currentAddr.toLowerCase() === config.address.toLowerCase()) {
      console.log(`${chain}: Already correct, skipping`);
      continue;
    }

    console.log(`\n${chain}: Updating peer...`);
    const newPeerBytes = ethers.utils.hexZeroPad(config.address, 32);
    
    try {
      const tx = await hub.setPeer(config.eid, newPeerBytes, { gasLimit: 200000 });
      console.log(`  TX: ${tx.hash}`);
      await tx.wait();
      console.log(`  ✅ Updated!`);
    } catch (e: any) {
      console.log(`  ❌ Failed: ${e.reason || e.message?.slice(0, 100)}`);
    }
  }

  // Verify updates
  console.log("\n--- Verification ---");
  for (const [chain, config] of Object.entries(NEW_GATEWAYS)) {
    const newPeer = await hub.peers(config.eid);
    const newAddr = "0x" + newPeer.slice(26);
    const matches = newAddr.toLowerCase() === config.address.toLowerCase();
    console.log(`${chain}: ${matches ? "✅ Correct" : "❌ Still wrong"} (${newAddr})`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("DONE!");
  console.log("=".repeat(60));
  console.log("\nHub peers have been updated to point to the new gateways.");
  console.log("The pending LayerZero messages should now be delivered.");
  console.log("\nCheck your synthetic token balances on Sonic in a few minutes.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

