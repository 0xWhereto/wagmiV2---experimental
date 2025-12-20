import { ethers } from "hardhat";

/**
 * Deploy the FINAL Gateway with ALL tokens and proper synthetic addresses.
 * This replaces the old Gateway.
 * 
 * Key insight: WBTC is now linked on the Hub to sBTC.
 * We need a new Gateway that has ALL tokens including WBTC with correct syntheticAddress.
 * 
 * For WETH/USDC/USDT - they're already linked on Hub. When we call linkTokenToHub again,
 * it will fail with "Already linked" on the Hub.
 * 
 * SOLUTION: Only link WBTC on the new Gateway, but also register the other tokens
 * without sending link messages (so deposits work).
 * 
 * Actually the Gateway's linkTokenToHub registers tokens AND sends link message.
 * We need a different approach - use the existing Gateway for WETH/USDC/USDT
 * and the WBTC Gateway for WBTC only.
 * 
 * BUT the Hub can only have ONE peer per EID!
 * 
 * FINAL SOLUTION:
 * Keep the old Gateway as the main one. Set Hub peer to old Gateway.
 * For WBTC: the Hub already has the WBTC->sBTC link. Deposits just need to go through.
 * The old Gateway has WBTC registered (index 3) with syntheticAddress=0x0.
 * 
 * When user deposits WBTC through old Gateway:
 * 1. Gateway accepts deposit (WBTC is registered, not paused)
 * 2. Gateway sends deposit message to Hub
 * 3. Hub receives message, looks up syntheticAddressByRemoteAddress[WBTC] = sBTC
 * 4. Hub mints sBTC to user
 * 
 * The Gateway's syntheticTokenAddress is only used during linkTokenToHub!
 * So WBTC deposits through the OLD Gateway should work now!
 */

async function main() {
  console.log("=== TESTING WBTC DEPOSIT VIA OLD GATEWAY ===\n");
  console.log("The Hub now has WBTC->sBTC link.");
  console.log("The old Gateway has WBTC registered (index 3).");
  console.log("Deposits should work because Hub looks up synthetic by remote address.\n");
  
  console.log("Setting Hub peer back to OLD Gateway...");
  
  const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
  const OLD_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
  const ARBITRUM_EID = 30110;
  
  // This needs to run on Sonic
  console.log("\nRun on Sonic:");
  console.log(`hub.setPeer(${ARBITRUM_EID}, ${ethers.utils.hexZeroPad(OLD_GATEWAY, 32)})`);
}

main().catch(console.error);
