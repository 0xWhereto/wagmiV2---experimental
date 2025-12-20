import { ethers } from "hardhat";

const CONFIG = {
  hub: "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd",
  hubGetters: "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e",
  
  sbtc: "0x2F0324268031E6413280F3B5ddBc4A97639A284a", // Found unlinked sBTC
  
  arbitrumEid: 30110,
  arbitrumGateway: "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e",
  wbtcArbitrum: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
  
  // sBTC has 8 decimals, WBTC has 8 decimals -> decimalsDelta = 0
  decimalsDelta: 0,
  minBridgeAmt: ethers.utils.parseUnits("0.00001", 8), // 0.00001 BTC min
};

async function main() {
  console.log("=== LINKING WBTC TO sBTC ===\n");
  
  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);
  
  const hub = await ethers.getContractAt("SyntheticTokenHub", CONFIG.hub);
  
  console.log("\nParameters:");
  console.log(`  sBTC: ${CONFIG.sbtc}`);
  console.log(`  Arbitrum EID: ${CONFIG.arbitrumEid}`);
  console.log(`  WBTC: ${CONFIG.wbtcArbitrum}`);
  console.log(`  Gateway: ${CONFIG.arbitrumGateway}`);
  console.log(`  Decimals delta: ${CONFIG.decimalsDelta}`);
  console.log(`  Min bridge: ${CONFIG.minBridgeAmt}`);
  
  console.log("\nLinking...");
  const tx = await hub.manualLinkRemoteToken(
    CONFIG.sbtc,
    CONFIG.arbitrumEid,
    CONFIG.wbtcArbitrum,
    CONFIG.arbitrumGateway,
    CONFIG.decimalsDelta,
    CONFIG.minBridgeAmt
  );
  console.log(`TX: ${tx.hash}`);
  await tx.wait();
  console.log("✅ DONE!");
  
  // Verify
  const hubGetters = await ethers.getContractAt("SyntheticTokenHubGetters", CONFIG.hubGetters);
  const remoteInfo = await hubGetters.getRemoteTokenInfo(CONFIG.sbtc, CONFIG.arbitrumEid);
  console.log("\nVerification:");
  console.log(`  Remote address: ${remoteInfo.remoteAddress}`);
  console.log(`  Decimals delta: ${remoteInfo.decimalsDelta}`);
  console.log(`  Min bridge: ${remoteInfo.minBridgeAmt}`);
  
  if (remoteInfo.remoteAddress.toLowerCase() === CONFIG.wbtcArbitrum.toLowerCase()) {
    console.log("\n✅ SUCCESS! WBTC is now linked to sBTC");
  }
}

main().catch(console.error);
