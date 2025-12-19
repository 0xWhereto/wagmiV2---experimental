import hardhat, { ethers } from "hardhat";

/**
 * Update Hub peers on Sonic to accept messages from new Gateways
 */

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

// New Gateway addresses
const NEW_GATEWAYS: Record<string, { address: string; eid: number }> = {
  arbitrum: { address: "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e", eid: 30110 },
  base: { address: "0xB712543E7fB87C411AAbB10c6823cf39bbEBB4Bb", eid: 30184 },
  ethereum: { address: "0xba36FC6568B953f691dd20754607590C59b7646a", eid: 30101 },
};

function addressToBytes32(addr: string): string {
  return ethers.utils.hexZeroPad(addr, 32).toLowerCase();
}

async function main() {
  const network = hardhat.network.name;
  if (network !== "sonic") {
    console.log("This script should be run on Sonic network");
    return;
  }

  const [deployer] = await ethers.getSigners();
  console.log(`\n========================================`);
  console.log(`Updating Hub Peers on SONIC`);
  console.log(`========================================`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(await deployer.getBalance())} S`);

  const hub = await ethers.getContractAt("SyntheticTokenHub", HUB_ADDRESS);

  // Set peers for each new Gateway
  for (const [chainName, gateway] of Object.entries(NEW_GATEWAYS)) {
    if (!gateway.address || gateway.address === "TBD") continue;
    
    console.log(`\nSetting peer for ${chainName} (EID: ${gateway.eid})`);
    console.log(`  Gateway: ${gateway.address}`);
    
    try {
      // Check current peer
      const currentPeer = await hub.peers(gateway.eid);
      const newPeerBytes32 = addressToBytes32(gateway.address);
      
      console.log(`  Current peer: ${currentPeer}`);
      console.log(`  New peer:     ${newPeerBytes32}`);
      
      if (currentPeer.toLowerCase() === newPeerBytes32.toLowerCase()) {
        console.log(`  ✓ Already set correctly`);
        continue;
      }
      
      const tx = await hub.setPeer(gateway.eid, newPeerBytes32);
      console.log(`  TX: ${tx.hash}`);
      await tx.wait();
      console.log(`  ✓ Peer updated!`);
    } catch (e: any) {
      console.log(`  ✗ Failed: ${e.message?.slice(0, 100)}`);
    }
  }

  console.log("\n========================================");
  console.log("PEER UPDATE COMPLETE!");
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

