import { ethers } from "hardhat";

/**
 * The new Gateway already has all tokens registered via the deployment.
 * But the LZ message failed because WETH/USDT/USDC are already linked.
 * 
 * We need to link ONLY WBTC on the new Gateway.
 * But the Gateway's linkTokenToHub checks if token is already registered.
 * 
 * Since WBTC IS registered on the new Gateway (from deployment), we can't call
 * linkTokenToHub again. We need to use updateSyntheticTokenAddress to fix the
 * syntheticAddress on the Gateway, but the Gateway already has the correct one.
 * 
 * The issue is the Hub doesn't have the WBTC->sBTC mapping.
 * We need to somehow get the Hub to accept the link for just WBTC.
 * 
 * Actually - we need to deploy ANOTHER Gateway with only WBTC, or we need
 * the Hub to have the manualLinkRemoteToken function.
 * 
 * Let me think of alternatives:
 * 1. Redeploy Hub with manualLinkRemoteToken
 * 2. Deploy a second Gateway for just WBTC
 * 3. Use the existing Gateway but find a way to re-send just WBTC link
 * 
 * Option 3: The Gateway doesn't have a way to re-send links.
 * But wait - the LZ message is already sent. If it fails on the Hub, it might
 * end up in the blocked queue. Let me check if we can clear the queue and
 * have the Hub accept messages.
 * 
 * Actually the simplest solution is to just wait and see if the message fails,
 * then deploy a separate Gateway just for WBTC.
 */

async function main() {
  console.log("=== LINK WBTC STATUS ===\n");
  
  console.log("The linkTokenToHub message included all 4 tokens (WETH, USDT, USDC, WBTC).");
  console.log("Since WETH, USDT, USDC are already linked on the Hub, the message will fail.");
  console.log("\nOptions:");
  console.log("1. Wait for the message to fail, then deploy a separate WBTC-only Gateway");
  console.log("2. Redeploy the Hub with manualLinkRemoteToken function");
  console.log("\nLet's check the LayerZero message status...");
  console.log("https://layerzeroscan.com/tx/0xd1d18a70bd129071b7ac91eff917634d01057557b01f60c5863f9691619e5fe9");
}

main().catch(console.error);
