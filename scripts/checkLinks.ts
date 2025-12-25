import hardhat, { ethers } from "hardhat";

/**
 * Check if remote tokens are properly linked on Hub
 */

const HUB_GETTERS_ADDRESS = "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e";

// Chain EIDs
const CHAIN_EIDS = {
  arbitrum: 30110,
  base: 30184,
  ethereum: 30101,
};

// Remote token addresses
const REMOTE_TOKENS = {
  arbitrum: {
    WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  },
  base: {
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
  ethereum: {
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  },
};

async function main() {
  const network = hardhat.network.name;
  if (network !== "sonic") {
    console.log("This script should be run on Sonic network");
    return;
  }

  const hubGetters = await ethers.getContractAt("SyntheticTokenHubGetters", HUB_GETTERS_ADDRESS);

  console.log(`\n========================================`);
  console.log(`Checking Token Links on SONIC Hub`);
  console.log(`========================================`);

  for (const [chainName, tokens] of Object.entries(REMOTE_TOKENS)) {
    const eid = CHAIN_EIDS[chainName as keyof typeof CHAIN_EIDS];
    console.log(`\n--- ${chainName.toUpperCase()} (EID: ${eid}) ---`);
    
    for (const [tokenSymbol, remoteAddress] of Object.entries(tokens)) {
      try {
        const syntheticAddress = await hubGetters.getSyntheticAddressByRemoteAddress(eid, remoteAddress);
        if (syntheticAddress === ethers.constants.AddressZero) {
          console.log(`  ${tokenSymbol}: NOT LINKED`);
        } else {
          console.log(`  ${tokenSymbol}: ✓ Linked to ${syntheticAddress}`);
          
          // Get remote token info
          const remoteInfo = await hubGetters.getRemoteTokenInfo(syntheticAddress, eid);
          console.log(`    Remote: ${remoteInfo.remoteAddress}`);
          console.log(`    Balance: ${remoteInfo.totalBalance.toString()}`);
          console.log(`    MinBridge: ${remoteInfo.minBridgeAmt.toString()}`);
        }
      } catch (e: any) {
        console.log(`  ${tokenSymbol}: Error - ${e.message?.slice(0, 50)}`);
      }
    }
  }

  // Check gateway vaults
  console.log(`\n--- Gateway Vaults ---`);
  for (const [chainName, eid] of Object.entries(CHAIN_EIDS)) {
    try {
      const gateway = await hubGetters.getGatewayVaultByEid(eid);
      console.log(`  ${chainName}: ${gateway}`);
    } catch (e: any) {
      console.log(`  ${chainName}: Error - ${e.message?.slice(0, 50)}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });



