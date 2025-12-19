import { ethers } from "hardhat";

// Hub on Sonic
const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const HUB_GETTERS = "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Checking sBTC on Sonic Hub ===\n");
  console.log(`Signer: ${signer.address}`);
  
  const hubGetters = await ethers.getContractAt(
    [
      "function getSyntheticTokenCount() view returns (uint256)",
      "function getSyntheticTokenInfo(uint256 index) view returns (tuple(address tokenAddress, string name, string symbol, uint8 decimals, uint256 totalSupply))"
    ],
    HUB_GETTERS,
    signer
  );

  // Get all synthetic tokens on the Hub
  console.log("=== Synthetic Tokens on Hub ===");
  try {
    const count = await hubGetters.getSyntheticTokenCount();
    console.log(`Total synthetic tokens: ${count}\n`);
    
    let sbtcAddress: string | null = null;
    
    for (let i = 0; i < count.toNumber(); i++) {
      try {
        const tokenInfo = await hubGetters.getSyntheticTokenInfo(i);
        console.log(`[${i}] ${tokenInfo.symbol}:`);
        console.log(`    Address: ${tokenInfo.tokenAddress}`);
        console.log(`    Decimals: ${tokenInfo.decimals}`);
        console.log(`    Total Supply: ${ethers.utils.formatUnits(tokenInfo.totalSupply, tokenInfo.decimals)}`);
        
        if (tokenInfo.symbol === "sBTC" || tokenInfo.symbol === "sWBTC") {
          sbtcAddress = tokenInfo.tokenAddress;
          console.log(`    *** This is the BTC synthetic! ***`);
        }
      } catch (e: any) {
        console.log(`[${i}] Error: ${e.reason || e.message?.slice(0, 50)}`);
      }
    }
    
    if (sbtcAddress) {
      console.log(`\n✅ Found sBTC at: ${sbtcAddress}`);
      console.log("\nNow we need to update the Arbitrum Gateway to use this address.");
    } else {
      console.log("\n❌ No sBTC found on Hub. Need to create it first.");
    }
  } catch (e: any) {
    console.log(`Error: ${e.reason || e.message}`);
  }

  // Check the Hub for any BTC-related linked tokens
  console.log("\n=== Checking Hub for WBTC Links ===");
  const hub = await ethers.getContractAt(
    [
      "function getRemoteToken(uint32 srcEid, address syntheticToken) view returns (address)",
      "function getSyntheticToken(uint32 srcEid, address remoteToken) view returns (address)"
    ],
    HUB_ADDRESS,
    signer
  );

  const ARBITRUM_EID = 30110;
  const WBTC_ARB = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";

  try {
    const syntheticForWbtc = await hub.getSyntheticToken(ARBITRUM_EID, WBTC_ARB);
    console.log(`WBTC (Arbitrum) -> Synthetic on Hub: ${syntheticForWbtc}`);
    
    if (syntheticForWbtc !== ethers.constants.AddressZero) {
      console.log(`\n✅ Hub knows about WBTC! Synthetic is: ${syntheticForWbtc}`);
      console.log("\nThe problem is the Gateway doesn't have this address stored.");
      console.log("Need to update Gateway's WBTC entry with this synthetic address.");
    } else {
      console.log("\n❌ Hub doesn't have WBTC linked from Arbitrum");
    }
  } catch (e: any) {
    console.log(`Error checking Hub links: ${e.reason || e.message?.slice(0, 80)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

