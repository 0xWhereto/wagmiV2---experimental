import { ethers } from "hardhat";

const ARBITRUM_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const WETH_ARBITRUM = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Debugging Arbitrum Gateway Token Configuration ===\n");
  
  const gateway = await ethers.getContractAt(
    [
      "function owner() view returns (address)",
      "function availableTokensCount() view returns (uint256)",
      "function availableTokens(uint256) view returns (tuple(address tokenAddress, address syntheticTokenAddress, int8 decimalsDelta, uint256 minBridgeAmt, bool onPause))",
      "function getTokenIndex(address _tokenAddress) view returns (uint256)",
      "function pauseToken(address _tokenAddress, bool _onPause) external"
    ],
    ARBITRUM_GATEWAY,
    signer
  );

  // Check total token count
  const count = await gateway.availableTokensCount();
  console.log(`Total tokens in gateway: ${count}\n`);

  // List ALL tokens
  console.log("=== All Tokens in Gateway ===");
  for (let i = 0; i < count.toNumber(); i++) {
    const tokenInfo = await gateway.availableTokens(i);
    console.log(`\nIndex ${i}:`);
    console.log(`  Token Address: ${tokenInfo.tokenAddress}`);
    console.log(`  Synthetic Token: ${tokenInfo.syntheticTokenAddress}`);
    console.log(`  Decimals Delta: ${tokenInfo.decimalsDelta}`);
    console.log(`  Min Bridge Amount: ${ethers.utils.formatUnits(tokenInfo.minBridgeAmt, 18)}`);
    console.log(`  On Pause: ${tokenInfo.onPause}`);
  }

  // Check WETH specifically by address
  console.log("\n=== Checking WETH by Address ===");
  try {
    const wethIndex = await gateway.getTokenIndex(WETH_ARBITRUM);
    console.log(`WETH (${WETH_ARBITRUM}) Index: ${wethIndex}`);
  } catch (e: any) {
    console.log(`getTokenIndex for WETH failed: ${e.reason || e.message?.slice(0, 100)}`);
  }

  // Check what address 0x0 returns
  console.log("\n=== Checking Address(0) ===");
  try {
    const zeroIndex = await gateway.getTokenIndex(ethers.constants.AddressZero);
    console.log(`Address(0) Index: ${zeroIndex}`);
  } catch (e: any) {
    console.log(`getTokenIndex for Address(0) failed: ${e.reason || e.message?.slice(0, 100)}`);
  }

  // Try a working old transaction's pattern
  // The working tx 0xbe2b65ec... was using the deposit function
  // Let me check if WETH is perhaps under a different structure
  
  console.log("\n=== Storage Analysis ===");
  // The Gateway might have swapped tokenAddress and syntheticTokenAddress in an update
  // Let's verify what the actual WETH deposit should use

  // Check for linked token info
  const gatewayFull = await ethers.getContractAt(
    [
      "function linkedTokens(address) view returns (address)",
      "function getLinkedToken(address _tokenAddress) view returns (address)"
    ],
    ARBITRUM_GATEWAY,
    signer
  );

  try {
    const linked = await gatewayFull.getLinkedToken(WETH_ARBITRUM);
    console.log(`WETH linked to: ${linked}`);
  } catch (e: any) {
    console.log(`getLinkedToken failed: ${e.reason || "function doesn't exist"}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


