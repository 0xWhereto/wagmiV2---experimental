import hardhat, { ethers } from "hardhat";

/**
 * Check tokens registered on Sonic Hub
 */

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const GETTERS_ADDRESS = "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e";
const ARBITRUM_EID = 30110;
const BASE_EID = 30184;
const ETHEREUM_EID = 30101;

// Token addresses on Arbitrum
const ARB_WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const ARB_USDT = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9";
const ARB_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

async function main() {
  const network = hardhat.network.name;
  if (network !== "sonic") {
    console.log("This script should be run on Sonic network");
    return;
  }

  const [deployer] = await ethers.getSigners();
  console.log(`\n========================================`);
  console.log(`Checking Hub Tokens on SONIC`);
  console.log(`========================================`);

  const hub = await ethers.getContractAt("SyntheticTokenHub", HUB_ADDRESS);

  // Use Getters contract to check synthetic token addresses
  console.log("\n--- Checking Remote Token Mappings via Getters ---");
  
  const getters = await ethers.getContractAt("SyntheticTokenHubGetters", GETTERS_ADDRESS);
  
  // For each Arbitrum token, check if there's a synthetic token address
  const tokenAddresses = [
    { name: "WETH", remote: ARB_WETH },
    { name: "USDT", remote: ARB_USDT },
    { name: "USDC", remote: ARB_USDC },
  ];

  for (const token of tokenAddresses) {
    console.log(`\n${token.name} from Arbitrum:`);
    console.log(`  Remote address: ${token.remote}`);
    
    try {
      // Get synthetic token address for this remote token
      const syntheticAddress = await getters.getSyntheticAddressByRemoteAddress(ARBITRUM_EID, token.remote);
      console.log(`  Synthetic address: ${syntheticAddress}`);
      
      if (syntheticAddress === ethers.constants.AddressZero) {
        console.log(`  ⚠️ NO SYNTHETIC TOKEN CREATED! The LinkToken message may not have been processed.`);
      } else {
        // Get more info about the remote token
        try {
          const remoteInfo = await getters.getRemoteTokenInfo(syntheticAddress, ARBITRUM_EID);
          console.log(`  Remote token: ${remoteInfo.remoteTokenAddress}`);
          console.log(`  Decimals delta: ${remoteInfo.decimalsDelta}`);
          console.log(`  Total balance: ${remoteInfo.totalBalance.toString()}`);
        } catch (e: any) {
          console.log(`  Could not get remote info: ${e.message?.slice(0, 50)}`);
        }
        
        // Check synthetic token details
        const syntheticToken = await ethers.getContractAt("IERC20Metadata", syntheticAddress);
        const symbol = await syntheticToken.symbol();
        const decimals = await syntheticToken.decimals();
        const totalSupply = await syntheticToken.totalSupply();
        console.log(`  Synthetic symbol: ${symbol}`);
        console.log(`  Synthetic decimals: ${decimals}`);
        console.log(`  Total supply: ${ethers.utils.formatUnits(totalSupply, decimals)}`);
      }
    } catch (e: any) {
      console.log(`  Error: ${e.message?.slice(0, 100)}`);
    }
  }

  // Check if there are any synthetic tokens at all
  console.log("\n--- All Synthetic Tokens ---");
  try {
    // Try to enumerate synthetic tokens
    const syntheticTokenCount = await hub.getSyntheticTokenCount?.();
    console.log(`Total synthetic tokens: ${syntheticTokenCount || 'Unknown'}`);
  } catch (e) {
    console.log("Could not get synthetic token count");
  }

  // Check LayerZero message status
  console.log("\n--- LayerZero Message Status ---");
  console.log("Check https://layerzeroscan.com for message delivery status");
  console.log("If message shows 'Failed', it means the _lzReceive execution reverted");
  
  // Try to read any events from the Hub
  console.log("\n--- Recent Events ---");
  try {
    const filter = hub.filters.SyntheticTokenCreated?.();
    if (filter) {
      const events = await hub.queryFilter(filter, -10000);
      console.log(`SyntheticTokenCreated events: ${events.length}`);
      for (const event of events) {
        console.log(`  Block ${event.blockNumber}: ${event.args}`);
      }
    }
  } catch (e: any) {
    console.log(`Could not query events: ${e.message?.slice(0, 100)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

