import { ethers } from "hardhat";

const ARBITRUM_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const WBTC_ARBITRUM = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Checking WBTC Status on Arbitrum Gateway ===\n");
  
  const gateway = await ethers.getContractAt(
    [
      "function availableTokens(uint256) view returns (bool onPause, address tokenAddress, address syntheticTokenAddress, int8 decimalsDelta, uint256 minBridgeAmt)",
      "function getTokenIndex(address _tokenAddress) view returns (uint256)",
      "function getAllAvailableTokens() view returns (tuple(bool onPause, int8 decimalsDelta, address syntheticTokenAddress, address tokenAddress, uint8 tokenDecimals, string tokenSymbol, uint256 tokenBalance)[])"
    ],
    ARBITRUM_GATEWAY,
    signer
  );

  // Check WBTC
  console.log("=== WBTC Configuration ===");
  try {
    const wbtcIndex = await gateway.getTokenIndex(WBTC_ARBITRUM);
    console.log(`WBTC index: ${wbtcIndex}`);
    
    const wbtcInfo = await gateway.availableTokens(wbtcIndex);
    console.log(`onPause: ${wbtcInfo.onPause}`);
    console.log(`tokenAddress: ${wbtcInfo.tokenAddress}`);
    console.log(`syntheticTokenAddress: ${wbtcInfo.syntheticTokenAddress}`);
    console.log(`decimalsDelta: ${wbtcInfo.decimalsDelta}`);
    console.log(`minBridgeAmt: ${wbtcInfo.minBridgeAmt.toString()}`);
    
    if (wbtcInfo.syntheticTokenAddress === ethers.constants.AddressZero) {
      console.log("\n❌ PROBLEM: WBTC has NO synthetic token linked!");
      console.log("The syntheticTokenAddress is 0x0 - WBTC bridge will fail.");
      console.log("\nSolution: Need to update the WBTC token configuration with the correct sBTC address on Sonic.");
    }
  } catch (e: any) {
    console.log(`WBTC lookup error: ${e.reason || e.message?.slice(0, 80)}`);
  }

  // Also check all tokens for completeness
  console.log("\n=== All Available Tokens ===");
  try {
    const allTokens = await gateway.getAllAvailableTokens();
    for (let i = 0; i < allTokens.length; i++) {
      const t = allTokens[i];
      const hasValidSynthetic = t.syntheticTokenAddress !== ethers.constants.AddressZero;
      const status = hasValidSynthetic ? "✅" : "❌ NO SYNTHETIC";
      console.log(`\n[${i}] ${t.tokenSymbol}: ${status}`);
      console.log(`  Token: ${t.tokenAddress}`);
      console.log(`  Synthetic: ${t.syntheticTokenAddress}`);
      console.log(`  Paused: ${t.onPause}`);
    }
  } catch (e: any) {
    console.log(`getAllAvailableTokens error: ${e.reason || e.message?.slice(0, 100)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
