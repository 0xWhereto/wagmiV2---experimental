import { ethers } from "hardhat";

/**
 * Manually link WBTC from Ethereum and Arbitrum to sBTC
 */

const CONFIG = {
  hub: "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd",
  sBTC: "0x2F0324268031E6413280F3B5ddBc4A97639A284a",
  
  // Remote WBTC addresses
  ethereum: {
    eid: 30101,
    wbtc: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    gateway: "0xba36FC6568B953f691dd20754607590C59b7646a",
  },
  arbitrum: {
    eid: 30110,
    wbtc: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
    gateway: "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e",
  },
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║       MANUALLY LINKING WBTC TO sBTC                          ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("\nDeployer:", deployer.address);

  const hub = await ethers.getContractAt("SyntheticTokenHub", CONFIG.hub);
  
  // Check if we're the owner
  const owner = await hub.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("❌ You are not the Hub owner.");
    return;
  }

  // Link Ethereum WBTC
  console.log("\n┌─────────────────────────────────────────────────────────────┐");
  console.log("│ Linking Ethereum WBTC to sBTC                               │");
  console.log("└─────────────────────────────────────────────────────────────┘");
  console.log(`   sBTC: ${CONFIG.sBTC}`);
  console.log(`   Ethereum WBTC: ${CONFIG.ethereum.wbtc}`);
  console.log(`   EID: ${CONFIG.ethereum.eid}`);

  try {
    // WBTC has 8 decimals, sBTC has 8 decimals, so decimalsDelta = 0
    // minBridgeAmt: 0.0001 BTC = 10000 satoshi
    console.log(`   Calling manualLinkRemoteToken...`);
    const tx1 = await hub.manualLinkRemoteToken(
      CONFIG.sBTC,           // synthetic token address
      CONFIG.ethereum.eid,   // source chain EID
      CONFIG.ethereum.wbtc,  // remote token address
      CONFIG.ethereum.gateway, // gateway vault address
      0,                     // decimals delta (both 8 decimals)
      10000,                 // min bridge amount (0.0001 BTC in satoshi)
      { gasLimit: 500000 }
    );
    console.log(`   Tx: ${tx1.hash}`);
    await tx1.wait();
    console.log(`   ✓ Ethereum WBTC linked!`);
  } catch (e: any) {
    console.log(`   ✗ Failed: ${e.reason || e.message?.slice(0, 200)}`);
    if (e.error?.data) {
      console.log(`   Error data: ${e.error.data}`);
    }
  }

  // Link Arbitrum WBTC
  console.log("\n┌─────────────────────────────────────────────────────────────┐");
  console.log("│ Linking Arbitrum WBTC to sBTC                               │");
  console.log("└─────────────────────────────────────────────────────────────┘");
  console.log(`   Arbitrum WBTC: ${CONFIG.arbitrum.wbtc}`);
  console.log(`   EID: ${CONFIG.arbitrum.eid}`);

  try {
    const tx2 = await hub.manualLinkRemoteToken(
      CONFIG.sBTC,
      CONFIG.arbitrum.eid,
      CONFIG.arbitrum.wbtc,
      CONFIG.arbitrum.gateway,
      0,                     // decimals delta
      10000                  // min bridge amount
    );
    console.log(`   Tx: ${tx2.hash}`);
    await tx2.wait();
    console.log(`   ✓ Arbitrum WBTC linked!`);
  } catch (e: any) {
    console.log(`   ✗ Failed: ${e.reason || e.message?.slice(0, 100)}`);
  }

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                    SUMMARY                                   ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log(`
   sBTC Address: ${CONFIG.sBTC}
   
   Now users can bridge WBTC from:
   - Ethereum → Sonic (sBTC)
   - Arbitrum → Sonic (sBTC)
   
   Note: The failed LZ messages from gateway linking are still pending.
   New bridge transactions will work, but you may want to clear those.
  `);
}

main();

