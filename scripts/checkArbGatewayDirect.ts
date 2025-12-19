import { ethers } from "hardhat";

const ARBITRUM_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const WETH_ARBITRUM = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

async function main() {
  console.log("=== Checking Arbitrum Gateway on Arbitrum Network ===\n");
  
  const provider = ethers.provider;
  
  // Check if Gateway has code
  const code = await provider.getCode(ARBITRUM_GATEWAY);
  console.log(`Gateway bytecode length: ${code.length / 2 - 1} bytes`);
  
  if (code === "0x") {
    console.log("❌ No contract at this address!");
    return;
  }

  const gateway = await ethers.getContractAt(
    [
      "function getTokenIndex(address _tokenAddress) view returns (uint256)",
      "function availableTokens(uint256) view returns (tuple(address tokenAddress, address syntheticTokenAddress, int8 decimalsDelta, uint256 minBridgeAmt, bool onPause))",
      "function getAllAvailableTokens() view returns (tuple(address tokenAddress, address syntheticTokenAddress, int8 decimalsDelta, uint256 minBridgeAmt, bool onPause, string tokenSymbol, uint256 tokenBalance)[])",
      "function owner() view returns (address)",
      "function DST_EID() view returns (uint32)"
    ],
    ARBITRUM_GATEWAY
  );

  // Check owner
  try {
    const owner = await gateway.owner();
    console.log(`Gateway owner: ${owner}`);
  } catch (e: any) {
    console.log(`Could not get owner: ${e.message?.slice(0, 50)}`);
  }

  // Check destination EID
  try {
    const dstEid = await gateway.DST_EID();
    console.log(`Destination EID: ${dstEid}`);
    if (dstEid === 30332) {
      console.log("✅ Points to Sonic!");
    }
  } catch (e: any) {
    console.log(`Could not get DST_EID: ${e.message?.slice(0, 50)}`);
  }

  // Check if WETH is linked
  console.log("\n=== Checking WETH Status ===");
  
  try {
    const index = await gateway.getTokenIndex(WETH_ARBITRUM);
    console.log(`WETH token index: ${index}`);
    console.log("✅ WETH is linked to the Gateway!");
    
    // Get token details
    try {
      const tokenInfo = await gateway.availableTokens(index);
      console.log("\nWETH Token Info:");
      console.log(`  Token Address: ${tokenInfo.tokenAddress}`);
      console.log(`  Synthetic Token: ${tokenInfo.syntheticTokenAddress}`);
      console.log(`  Decimals Delta: ${tokenInfo.decimalsDelta}`);
      console.log(`  Min Bridge Amount: ${ethers.utils.formatEther(tokenInfo.minBridgeAmt)} ETH`);
      console.log(`  On Pause: ${tokenInfo.onPause}`);
      
      if (tokenInfo.onPause) {
        console.log("\n⚠️ WETH IS PAUSED! This is why deposits fail!");
      }
      
      const minAmount = parseFloat(ethers.utils.formatEther(tokenInfo.minBridgeAmt));
      if (minAmount > 0.007) {
        console.log(`\n⚠️ Minimum bridge amount (${minAmount} ETH) is MORE than 0.007 ETH!`);
      }
    } catch (e: any) {
      console.log(`Could not get token info: ${e.message?.slice(0, 100)}`);
    }
  } catch (e: any) {
    console.log(`❌ getTokenIndex failed: ${e.reason || e.message?.slice(0, 100)}`);
    console.log("\nWETH is NOT LINKED to the Gateway!");
    console.log("This is why the deposit simulation fails.");
  }

  // Get all available tokens
  console.log("\n=== All Available Tokens ===");
  try {
    const tokens = await gateway.getAllAvailableTokens();
    console.log(`Total tokens: ${tokens.length}`);
    
    for (let i = 0; i < tokens.length; i++) {
      console.log(`\n[${i}] ${tokens[i].tokenSymbol}`);
      console.log(`    Address: ${tokens[i].tokenAddress}`);
      console.log(`    Synthetic: ${tokens[i].syntheticTokenAddress}`);
      console.log(`    Min Bridge: ${ethers.utils.formatEther(tokens[i].minBridgeAmt)} ETH`);
      console.log(`    Paused: ${tokens[i].onPause}`);
      console.log(`    Balance: ${ethers.utils.formatEther(tokens[i].tokenBalance)}`);
    }
  } catch (e: any) {
    console.log(`Could not get all tokens: ${e.message?.slice(0, 100)}`);
    
    // Try reading tokens one by one
    console.log("\nTrying to read tokens individually...");
    for (let i = 0; i < 5; i++) {
      try {
        const token = await gateway.availableTokens(i);
        console.log(`[${i}] ${token.tokenAddress} - Paused: ${token.onPause}`);
      } catch (e) {
        console.log(`[${i}] (no more tokens)`);
        break;
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

