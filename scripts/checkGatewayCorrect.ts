import { ethers } from "hardhat";

const ARBITRUM_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const WETH_ARBITRUM = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Checking Arbitrum Gateway (Correct ABI) ===\n");
  
  // CORRECT struct order: bool onPause, address tokenAddress, address syntheticTokenAddress, int8 decimalsDelta, uint256 minBridgeAmt
  const gateway = await ethers.getContractAt(
    [
      "function availableTokens(uint256) view returns (bool onPause, address tokenAddress, address syntheticTokenAddress, int8 decimalsDelta, uint256 minBridgeAmt)",
      "function getTokenIndex(address _tokenAddress) view returns (uint256)",
      "function getAllAvailableTokens() view returns (tuple(bool onPause, int8 decimalsDelta, address syntheticTokenAddress, address tokenAddress, uint8 tokenDecimals, string tokenSymbol, uint256 tokenBalance)[])"
    ],
    ARBITRUM_GATEWAY,
    signer
  );

  // Read first 4 tokens with correct ABI
  console.log("=== Available Tokens (Correct ABI) ===");
  for (let i = 0; i < 4; i++) {
    try {
      const tokenInfo = await gateway.availableTokens(i);
      console.log(`\nToken ${i}:`);
      console.log(`  onPause: ${tokenInfo.onPause}`);
      console.log(`  tokenAddress: ${tokenInfo.tokenAddress}`);
      console.log(`  syntheticTokenAddress: ${tokenInfo.syntheticTokenAddress}`);
      console.log(`  decimalsDelta: ${tokenInfo.decimalsDelta}`);
      console.log(`  minBridgeAmt: ${ethers.utils.formatUnits(tokenInfo.minBridgeAmt, 18)}`);
    } catch (e: any) {
      console.log(`Token ${i}: Error - ${e.reason || e.message?.slice(0, 80)}`);
      break;
    }
  }

  // Check WETH specifically
  console.log("\n=== WETH Lookup ===");
  try {
    const wethIndex = await gateway.getTokenIndex(WETH_ARBITRUM);
    console.log(`WETH index: ${wethIndex}`);
    
    const wethInfo = await gateway.availableTokens(wethIndex);
    console.log(`WETH onPause: ${wethInfo.onPause}`);
    console.log(`WETH tokenAddress: ${wethInfo.tokenAddress}`);
    console.log(`WETH syntheticTokenAddress: ${wethInfo.syntheticTokenAddress}`);
  } catch (e: any) {
    console.log(`WETH lookup error: ${e.reason || e.message?.slice(0, 80)}`);
  }

  // Use getAllAvailableTokens for detailed view
  console.log("\n=== All Available Tokens (Detailed) ===");
  try {
    const allTokens = await gateway.getAllAvailableTokens();
    for (let i = 0; i < allTokens.length; i++) {
      const t = allTokens[i];
      console.log(`\n[${i}] ${t.tokenSymbol}:`);
      console.log(`  Token: ${t.tokenAddress}`);
      console.log(`  Synthetic: ${t.syntheticTokenAddress}`);
      console.log(`  Paused: ${t.onPause}`);
      console.log(`  Balance: ${ethers.utils.formatUnits(t.tokenBalance, t.tokenDecimals)}`);
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


