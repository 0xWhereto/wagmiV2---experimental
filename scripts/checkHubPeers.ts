import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

const CHAINS = {
  arbitrum: { eid: 30110, newGateway: "0x527f843672C4CD7F45B126f3E1E82D60A741C609" },
  ethereum: { eid: 30101, newGateway: "0x5826e10B513C891910032F15292B2F1b3041C3Df" },
};

async function main() {
  const [deployer] = await ethers.getSigners();
  
  const hubAbi = [
    "function peers(uint32 _eid) view returns (bytes32)",
    "function setPeer(uint32 _eid, bytes32 _peer) external",
  ];
  
  const hub = new ethers.Contract(HUB, hubAbi, deployer);
  
  console.log("=== Hub Peers ===\n");
  
  for (const [chain, info] of Object.entries(CHAINS)) {
    const currentPeer = await hub.peers(info.eid);
    const expectedPeer = ethers.utils.hexZeroPad(info.newGateway, 32);
    
    console.log(`${chain.toUpperCase()} (EID ${info.eid}):`);
    console.log(`  Current peer: ${currentPeer}`);
    console.log(`  Expected:     ${expectedPeer}`);
    
    if (currentPeer.toLowerCase() !== expectedPeer.toLowerCase()) {
      console.log(`  ⚠️ MISMATCH - Setting new peer...`);
      try {
        const tx = await hub.setPeer(info.eid, expectedPeer, { gasLimit: 200000 });
        await tx.wait();
        console.log(`  ✅ Peer updated!`);
      } catch (e: any) {
        console.log(`  ❌ Error: ${e.message?.substring(0, 50)}`);
      }
    } else {
      console.log(`  ✅ Already set correctly`);
    }
    console.log();
  }
}

main().catch(console.error);
