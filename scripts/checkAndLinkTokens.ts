import { ethers } from "hardhat";
import { EndpointId } from "@layerzerolabs/lz-definitions";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

// Known synthetic token addresses from previous deployment
const SYNTHETIC_TOKENS = {
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  sBTC: "0x1DeFDa524B2B5edB94299775B23d7E3dde1Fbb6C",
  sUSDC: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B",
  sUSDT: "0x72dFC771E515423E5B0CD2acf703d0F7eb30bdEa",
};

const GATEWAYS = {
  arbitrum: { address: "0x7d4877d3c814f09f71fB779402D94f7fB45CA50c", eid: EndpointId.ARBITRUM_V2_MAINNET },
  ethereum: { address: "0x9cbc0a8E6AB21780498A6B2f9cdE7D487B7E5095", eid: EndpointId.ETHEREUM_V2_MAINNET },
  base: { address: "0x46102e4227f3ef07c08b19fC07A1ad79a427329D", eid: EndpointId.BASE_V2_MAINNET },
};

// Remote token addresses
const REMOTE_TOKENS: Record<string, Record<string, { address: string; decimals: number }>> = {
  arbitrum: {
    WETH: { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", decimals: 18 },
    WBTC: { address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", decimals: 8 },
    USDC: { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
    USDT: { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
  },
  ethereum: {
    WETH: { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18 },
    WBTC: { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8 },
    USDC: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
    USDT: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
  },
  base: {
    WETH: { address: "0x4200000000000000000000000000000000000006", decimals: 18 },
    USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
  },
};

// Map synthetic to remote
const SYNTHETIC_TO_REMOTE: Record<string, string> = {
  sWETH: "WETH",
  sBTC: "WBTC",
  sUSDC: "USDC",
  sUSDT: "USDT",
};

const hubAbi = [
  "function manualLinkRemoteToken(address _syntheticToken, uint32 _remoteEid, address _remoteToken, address _gatewayVault, int8 _decimalConversionRate) external",
  "function getLinkedToken(address syntheticToken, uint32 remoteEid) view returns (address remoteToken, address gatewayVault, int8 decimalConversion, uint256 mintedAmount)",
  "function syntheticTokenIdByAddress(address) view returns (uint256)",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const hub = new ethers.Contract(HUB_ADDRESS, hubAbi, deployer);

  // Check if synthetic tokens are registered
  console.log("\n=== Checking Synthetic Tokens ===");
  for (const [name, addr] of Object.entries(SYNTHETIC_TOKENS)) {
    try {
      const id = await hub.syntheticTokenIdByAddress(addr);
      console.log(`✅ ${name} (${addr}): ID = ${id.toString()}`);
    } catch (e) {
      console.log(`❌ ${name} (${addr}): Not registered`);
    }
  }

  // Link tokens
  console.log("\n=== Linking Tokens ===");
  for (const [chainName, gateway] of Object.entries(GATEWAYS)) {
    console.log(`\nLinking tokens for ${chainName} (EID ${gateway.eid})...`);
    const chainTokens = REMOTE_TOKENS[chainName];

    for (const [syntheticName, syntheticAddr] of Object.entries(SYNTHETIC_TOKENS)) {
      const remoteName = SYNTHETIC_TO_REMOTE[syntheticName];
      const remoteToken = chainTokens[remoteName];

      if (!remoteToken) {
        console.log(`  ⏭️ ${syntheticName}: No ${remoteName} on ${chainName}`);
        continue;
      }

      // Check if already linked
      try {
        const linked = await hub.getLinkedToken(syntheticAddr, gateway.eid);
        if (linked.remoteToken !== ethers.constants.AddressZero) {
          console.log(`  ✅ ${syntheticName} already linked to ${remoteName} on ${chainName}`);
          continue;
        }
      } catch (e) {
        // Not linked, proceed
      }

      // Calculate decimal conversion rate
      const syntheticDecimals = syntheticName === "sBTC" ? 8 : syntheticName.includes("USD") ? 6 : 18;
      const decimalDiff = syntheticDecimals - remoteToken.decimals;

      console.log(`  Linking ${syntheticName} to ${remoteName} on ${chainName}...`);
      try {
        const tx = await hub.manualLinkRemoteToken(
          syntheticAddr,
          gateway.eid,
          remoteToken.address,
          gateway.address,
          decimalDiff,
          { gasLimit: 300000 }
        );
        await tx.wait();
        console.log(`  ✅ ${syntheticName} -> ${remoteName} linked!`);
      } catch (e: any) {
        console.log(`  ❌ ${syntheticName}: ${e.reason || e.message}`);
      }
    }
  }

  console.log("\n=== Done! ===");
  console.log("Update frontend config with:");
  console.log(`
arbitrum: {
  gatewayVault: "${GATEWAYS.arbitrum.address}",
},
ethereum: {
  gatewayVault: "${GATEWAYS.ethereum.address}",
},
base: {
  gatewayVault: "${GATEWAYS.base.address}",
},
  `);
}

main().catch(console.error);
