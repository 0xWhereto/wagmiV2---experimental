import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

// New gateway addresses deployed today
const GATEWAYS = {
  arbitrum: "0x7d4877d3c814f09f71fB779402D94f7fB45CA50c",
  base: "0x46102e4227f3ef07c08b19fC07A1ad79a427329D",
  ethereum: "0x9cbc0a8E6AB21780498A6B2f9cdE7D487B7E5095",
};

// LayerZero Endpoint IDs
const EIDS = {
  arbitrum: 30110,
  base: 30184,
  ethereum: 30101,
};

// Existing synthetic token ADDRESSES on Hub
const SYNTHETIC_ADDRESSES = {
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  sUSDT: "0x72dFC771E515423E5B0CD2acf703d0F7eb30bdEa",
  sUSDC: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B",
  sBTC: "0x2F0324268031E6413280F3B5ddBc4A97639A284a",
};

// Token addresses on each chain
const TOKENS = {
  arbitrum: {
    WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    WBTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  },
  base: {
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    // Base doesn't have WBTC or USDT widely, skip them
  },
  ethereum: {
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  },
};

// Decimals delta: Hub token decimals - remote token decimals
// Hub synthetic tokens are 18 decimals
const DECIMAL_DELTAS = {
  WETH: 0,  // 18 - 18
  WBTC: 10, // 18 - 8
  USDC: 12, // 18 - 6
  USDT: 12, // 18 - 6
};

const MIN_BRIDGE_AMOUNTS = {
  WETH: ethers.utils.parseEther("0.001"),    // 0.001 ETH
  WBTC: ethers.utils.parseUnits("0.00001", 8), // 0.00001 BTC
  USDC: ethers.utils.parseUnits("1", 6),      // 1 USDC
  USDT: ethers.utils.parseUnits("1", 6),      // 1 USDT
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Linking tokens with account:", deployer.address);
  console.log("Hub address:", HUB_ADDRESS);

  const hubAbi = [
    "function manualLinkRemoteToken(address _syntheticTokenAddress, uint32 _srcEid, address _remoteTokenAddress, address _gatewayVault, int8 _decimalsDelta, uint256 _minBridgeAmt) external",
    "function owner() view returns (address)",
    "function getSyntheticToken(uint256 _id) view returns (address)",
  ];

  const hub = new ethers.Contract(HUB_ADDRESS, hubAbi, deployer);

  // Verify ownership
  const owner = await hub.owner();
  console.log(`Hub owner: ${owner}`);
  console.log(`Is deployer owner: ${owner.toLowerCase() === deployer.address.toLowerCase()}\n`);

  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error("Deployer is not the owner of the Hub!");
  }

  // Token mapping
  const tokenMapping = [
    { synthetic: "sWETH", address: SYNTHETIC_ADDRESSES.sWETH, remote: "WETH" },
    { synthetic: "sUSDT", address: SYNTHETIC_ADDRESSES.sUSDT, remote: "USDT" },
    { synthetic: "sUSDC", address: SYNTHETIC_ADDRESSES.sUSDC, remote: "USDC" },
    { synthetic: "sBTC", address: SYNTHETIC_ADDRESSES.sBTC, remote: "WBTC" },
  ];

  for (const chain of ["arbitrum", "ethereum", "base"] as const) {
    console.log(`\n=== Linking tokens for ${chain.toUpperCase()} ===`);
    const gateway = GATEWAYS[chain];
    const eid = EIDS[chain];
    const chainTokens = TOKENS[chain];

    for (const mapping of tokenMapping) {
      const remoteTokenKey = mapping.remote as keyof typeof chainTokens;
      const remoteToken = chainTokens[remoteTokenKey];

      if (!remoteToken) {
        console.log(`  ⏭️  Skipping ${mapping.synthetic} - ${mapping.remote} not available on ${chain}`);
        continue;
      }

      const decimalsDelta = DECIMAL_DELTAS[mapping.remote as keyof typeof DECIMAL_DELTAS];
      const minBridgeAmt = MIN_BRIDGE_AMOUNTS[mapping.remote as keyof typeof MIN_BRIDGE_AMOUNTS];

      console.log(`\n  Linking ${mapping.synthetic} (${mapping.address}) to ${mapping.remote} on ${chain}`);
      console.log(`    Remote token: ${remoteToken}`);
      console.log(`    Gateway: ${gateway}`);
      console.log(`    EID: ${eid}`);
      console.log(`    Decimals delta: ${decimalsDelta}`);
      console.log(`    Min bridge amount: ${minBridgeAmt.toString()}`);

      try {
        const tx = await hub.manualLinkRemoteToken(
          mapping.address,
          eid,
          remoteToken,
          gateway,
          decimalsDelta,
          minBridgeAmt,
          { gasLimit: 500000 }
        );
        console.log(`    TX: ${tx.hash}`);
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
          console.log(`    ✅ Successfully linked ${mapping.synthetic} to ${mapping.remote} on ${chain}`);
        } else {
          console.log(`    ❌ Transaction failed`);
        }
      } catch (e: any) {
        console.log(`    ❌ Error: ${e.reason || e.message?.substring(0, 150)}`);
      }
    }
  }

  console.log("\n\n=== Link Summary ===");
  console.log("Manual verification required on Sonic Explorer for the new gateways.");
}


main().catch(console.error);

