import { ethers } from "hardhat";
import { EndpointId } from "@layerzerolabs/lz-definitions";

// Deployed addresses
const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

const GATEWAYS: Record<string, { address: string; eid: number }> = {
  arbitrum: { address: "0x7d4877d3c814f09f71fB779402D94f7fB45CA50c", eid: EndpointId.ARBITRUM_V2_MAINNET },
  ethereum: { address: "0x9cbc0a8E6AB21780498A6B2f9cdE7D487B7E5095", eid: EndpointId.ETHEREUM_V2_MAINNET },
  base: { address: "0x46102e4227f3ef07c08b19fC07A1ad79a427329D", eid: EndpointId.BASE_V2_MAINNET },
};

// Tokens to link per chain
const TOKENS: Record<string, Record<string, { address: string; decimals: number }>> = {
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

const hubAbi = [
  "function setPeer(uint32 _eid, bytes32 _peer) external",
  "function peers(uint32 _eid) view returns (bytes32)",
  "function owner() view returns (address)",
  "function createSyntheticToken(string memory _name, uint8 _decimals) external returns (address)",
  "function syntheticTokenId(address) view returns (uint256)",
  "function syntheticTokens(uint256) view returns (address)",
  "function syntheticTokenCount() view returns (uint256)",
  "function manualLinkRemoteToken(address _syntheticToken, uint32 _remoteEid, address _remoteToken, address _gatewayVault, int8 _decimalConversionRate) external",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const hub = new ethers.Contract(HUB_ADDRESS, hubAbi, deployer);
  
  // Verify ownership
  const owner = await hub.owner();
  console.log(`Hub owner: ${owner}`);
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("⚠️ You are not the owner of the Hub!");
    return;
  }

  // Step 1: Set peers for all gateways
  console.log("\n=== Setting Peers ===");
  for (const [chain, info] of Object.entries(GATEWAYS)) {
    const peerBytes32 = ethers.utils.hexZeroPad(info.address, 32);
    const currentPeer = await hub.peers(info.eid);
    
    if (currentPeer.toLowerCase() === peerBytes32.toLowerCase()) {
      console.log(`✅ ${chain} peer already set (EID ${info.eid})`);
    } else {
      console.log(`Setting peer for ${chain} (EID ${info.eid})...`);
      const tx = await hub.setPeer(info.eid, peerBytes32, { gasLimit: 100000 });
      await tx.wait();
      console.log(`✅ ${chain} peer set to ${info.address}`);
    }
  }

  // Step 2: Check/Create synthetic tokens
  console.log("\n=== Checking Synthetic Tokens ===");
  const tokenCount = await hub.syntheticTokenCount();
  console.log(`Current synthetic token count: ${tokenCount.toString()}`);

  // Get existing synthetic tokens
  const existingSynthetics: Record<string, string> = {};
  for (let i = 1; i <= tokenCount.toNumber(); i++) {
    const addr = await hub.syntheticTokens(i);
    existingSynthetics[i.toString()] = addr;
    console.log(`  Token ${i}: ${addr}`);
  }

  // We need: sWETH, sBTC, sUSDC, sUSDT
  const neededTokens = [
    { name: "sWETH", decimals: 18 },
    { name: "sBTC", decimals: 8 },
    { name: "sUSDC", decimals: 6 },
    { name: "sUSDT", decimals: 6 },
  ];

  const syntheticAddresses: Record<string, string> = {};
  
  // Check if tokens already exist (simple heuristic - check by count)
  if (tokenCount.toNumber() >= 4) {
    console.log("Synthetic tokens likely already exist. Using existing...");
    // Map by index (assuming order matches)
    syntheticAddresses["sWETH"] = existingSynthetics["1"] || "";
    syntheticAddresses["sBTC"] = existingSynthetics["2"] || "";
    syntheticAddresses["sUSDC"] = existingSynthetics["3"] || "";
    syntheticAddresses["sUSDT"] = existingSynthetics["4"] || "";
  } else {
    // Create missing tokens
    for (const token of neededTokens) {
      console.log(`Creating ${token.name}...`);
      try {
        const tx = await hub.createSyntheticToken(token.name, token.decimals, { gasLimit: 2000000 });
        const receipt = await tx.wait();
        // Find the created token address from events or return value
        console.log(`✅ ${token.name} created (tx: ${receipt.transactionHash})`);
      } catch (e: any) {
        console.log(`⚠️ ${token.name}: ${e.reason || e.message}`);
      }
    }
  }

  // Step 3: Link tokens
  console.log("\n=== Linking Tokens ===");
  console.log("Note: Run this step separately after verifying synthetic token addresses");

  // Output config for frontend
  console.log("\n========================================");
  console.log("FRONTEND CONFIG UPDATE:");
  console.log("========================================");
  console.log(`
sonic: {
  contracts: {
    syntheticTokenHub: "${HUB_ADDRESS}",
  },
  syntheticTokens: {
    // Update these with actual deployed addresses
    sWETH: "${syntheticAddresses["sWETH"] || "CHECK_HUB"}",
    sBTC: "${syntheticAddresses["sBTC"] || "CHECK_HUB"}",
    sUSDC: "${syntheticAddresses["sUSDC"] || "CHECK_HUB"}",
    sUSDT: "${syntheticAddresses["sUSDT"] || "CHECK_HUB"}",
  },
},
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


