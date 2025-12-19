import { ethers } from "hardhat";
import { EndpointId } from "@layerzerolabs/lz-definitions";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

// New synthetic tokens (tokens 10-13)
const SYNTHETIC_TOKENS = {
  sWETH: { address: "0xFEad3E66D07cEA78003504Bb8d9158D5016F0109", decimals: 18 },
  sBTC: { address: "0xcb84ade32Bb4E9053F9cA8D641bfD35Cb7Fe1f0c", decimals: 8 },
  sUSDC: { address: "0x226D93e305F8e250bbA62546D1F0050F374ce5E1", decimals: 6 },
  sUSDT: { address: "0xf05776C3AA8278051641eaD2CE215530078DD663", decimals: 6 },
};

const GATEWAYS = {
  arbitrum: { address: "0x7d4877d3c814f09f71fB779402D94f7fB45CA50c", eid: EndpointId.ARBITRUM_V2_MAINNET },
  ethereum: { address: "0x9cbc0a8E6AB21780498A6B2f9cdE7D487B7E5095", eid: EndpointId.ETHEREUM_V2_MAINNET },
  base: { address: "0x46102e4227f3ef07c08b19fC07A1ad79a427329D", eid: EndpointId.BASE_V2_MAINNET },
};

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

const SYNTHETIC_TO_REMOTE: Record<string, string> = {
  sWETH: "WETH",
  sBTC: "WBTC",
  sUSDC: "USDC",
  sUSDT: "USDT",
};

const hubAbi = [
  "function manualLinkRemoteToken(address _syntheticTokenAddress, uint32 _srcEid, address _remoteTokenAddress, address _gateway, int8 _decimalsDelta) external",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const hub = new ethers.Contract(HUB_ADDRESS, hubAbi, deployer);

  console.log("\n=== Linking Tokens ===");
  for (const [chainName, gateway] of Object.entries(GATEWAYS)) {
    console.log(`\n${chainName} (EID ${gateway.eid}):`);
    const chainTokens = REMOTE_TOKENS[chainName];

    for (const [syntheticName, syntheticInfo] of Object.entries(SYNTHETIC_TOKENS)) {
      const remoteName = SYNTHETIC_TO_REMOTE[syntheticName];
      const remoteToken = chainTokens[remoteName];

      if (!remoteToken) {
        console.log(`  ⏭️ ${syntheticName}: No ${remoteName} on ${chainName}`);
        continue;
      }

      const decimalDiff = syntheticInfo.decimals - remoteToken.decimals;

      console.log(`  Linking ${syntheticName} to ${remoteName}...`);
      try {
        const tx = await hub.manualLinkRemoteToken(
          syntheticInfo.address,
          gateway.eid,
          remoteToken.address,
          gateway.address,
          decimalDiff,
          { gasLimit: 300000 }
        );
        await tx.wait();
        console.log(`  ✅ ${syntheticName} -> ${remoteName}`);
      } catch (e: any) {
        console.log(`  ❌ ${syntheticName}: ${e.reason || e.message?.substring(0, 100)}`);
      }
    }
  }

  console.log("\n\n========================================");
  console.log("UPDATE FRONTEND CONFIG:");
  console.log("========================================");
  console.log(`
syntheticTokens: {
  sWETH: "${SYNTHETIC_TOKENS.sWETH.address}",
  sBTC: "${SYNTHETIC_TOKENS.sBTC.address}",
  sUSDC: "${SYNTHETIC_TOKENS.sUSDC.address}",
  sUSDT: "${SYNTHETIC_TOKENS.sUSDT.address}",
},

gatewayVaults: {
  arbitrum: "${GATEWAYS.arbitrum.address}",
  ethereum: "${GATEWAYS.ethereum.address}",
  base: "${GATEWAYS.base.address}",
}
  `);
}

main().catch(console.error);
