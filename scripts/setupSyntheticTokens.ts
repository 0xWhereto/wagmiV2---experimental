import { ethers } from "hardhat";
import { Options } from "@layerzerolabs/lz-v2-utilities";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

// Gateway addresses (from peers)
const ARBITRUM_GATEWAY = "0x187ddd9a94236ba6d22376ee2e3c4c834e92f34e";
const ETHEREUM_GATEWAY = "0xba36fc6568b953f691dd20754607590c59b7646a";

// Endpoint IDs
const ARBITRUM_EID = 30110;
const ETHEREUM_EID = 30101;

// Remote token addresses
const TOKENS = {
  WETH: {
    symbol: "sWETH",
    decimals: 18,
    remotes: [
      { chainName: "Arbitrum", eid: ARBITRUM_EID, gateway: ARBITRUM_GATEWAY, address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1" },
      { chainName: "Ethereum", eid: ETHEREUM_EID, gateway: ETHEREUM_GATEWAY, address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" },
    ]
  },
  USDT: {
    symbol: "sUSDT",
    decimals: 6,
    remotes: [
      { chainName: "Arbitrum", eid: ARBITRUM_EID, gateway: ARBITRUM_GATEWAY, address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" },
      { chainName: "Ethereum", eid: ETHEREUM_EID, gateway: ETHEREUM_GATEWAY, address: "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
    ]
  },
  USDC: {
    symbol: "sUSDC",
    decimals: 6,
    remotes: [
      { chainName: "Arbitrum", eid: ARBITRUM_EID, gateway: ARBITRUM_GATEWAY, address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
      { chainName: "Ethereum", eid: ETHEREUM_EID, gateway: ETHEREUM_GATEWAY, address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
    ]
  },
  WBTC: {
    symbol: "sBTC",
    decimals: 8,
    remotes: [
      { chainName: "Arbitrum", eid: ARBITRUM_EID, gateway: ARBITRUM_GATEWAY, address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f" },
      { chainName: "Ethereum", eid: ETHEREUM_EID, gateway: ETHEREUM_GATEWAY, address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" },
    ]
  }
};

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`Using signer: ${signer.address}`);
  
  const hub = await ethers.getContractAt(
    [
      "function owner() view returns (address)",
      "function createSyntheticToken(string memory _symbol, uint8 _decimals) external",
      "function manualLinkRemoteToken(address _syntheticTokenAddress, address _remoteTokenAddress, uint32 _srcEid, address _gatewayVault, int8 _decimalsDelta, uint256 _minBridgeAmt) external",
      "function syntheticTokens(uint256) view returns (address)"
    ],
    HUB_ADDRESS,
    signer
  );

  // Verify owner
  const owner = await hub.owner();
  console.log(`Hub owner: ${owner}`);
  
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.log("\n❌ ERROR: You are not the Hub owner!");
    return;
  }

  // Check existing synthetic tokens
  console.log("\n=== Existing Synthetic Tokens ===");
  const existingTokens: string[] = [];
  for (let i = 0; i < 10; i++) {
    try {
      const token = await hub.syntheticTokens(i);
      existingTokens.push(token);
      
      const tokenContract = await ethers.getContractAt(
        ["function symbol() view returns (string)"],
        token
      );
      const symbol = await tokenContract.symbol();
      console.log(`  [${i}] ${symbol}: ${token}`);
    } catch (e) {
      break;
    }
  }

  console.log(`\nFound ${existingTokens.length} existing synthetic tokens`);

  // Create missing synthetic tokens
  const createdTokens: { [key: string]: string } = {};
  
  for (const [tokenName, config] of Object.entries(TOKENS)) {
    console.log(`\n=== Processing ${tokenName} (${config.symbol}) ===`);
    
    // Check if already exists
    let existingAddress = null;
    for (const addr of existingTokens) {
      try {
        const tokenContract = await ethers.getContractAt(
          ["function symbol() view returns (string)"],
          addr
        );
        const symbol = await tokenContract.symbol();
        if (symbol === config.symbol) {
          existingAddress = addr;
          break;
        }
      } catch (e) {}
    }
    
    if (existingAddress) {
      console.log(`✅ ${config.symbol} already exists at: ${existingAddress}`);
      createdTokens[tokenName] = existingAddress;
    } else {
      // Create new synthetic token
      console.log(`Creating ${config.symbol}...`);
      try {
        const tx = await hub.createSyntheticToken(config.symbol, config.decimals, {
          gasLimit: 3000000
        });
        console.log(`  TX: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`  ✅ Created in block ${receipt.blockNumber}`);
        
        // Get the new token address from events or by querying
        // The new token should be at the end of the array
        const newIndex = existingTokens.length;
        const newToken = await hub.syntheticTokens(newIndex);
        console.log(`  New ${config.symbol} address: ${newToken}`);
        createdTokens[tokenName] = newToken;
        existingTokens.push(newToken);
      } catch (e: any) {
        console.log(`  ❌ Failed: ${e.message?.slice(0, 100)}`);
      }
    }
    
    // Link remote tokens
    if (createdTokens[tokenName]) {
      for (const remote of config.remotes) {
        console.log(`  Linking to ${remote.chainName} ${remote.address}...`);
        try {
          // Calculate decimals delta: remote decimals - synthetic decimals
          // For same decimals: 0
          // For USDT/USDC on Arbitrum (6 decimals) to synthetic (6 decimals): 0
          const decimalsDelta = 0; // Same decimals
          
          const tx = await hub.manualLinkRemoteToken(
            createdTokens[tokenName],
            remote.address,
            remote.eid,
            remote.gateway,
            decimalsDelta,
            1000, // minBridgeAmt - very small
            { gasLimit: 500000 }
          );
          console.log(`    TX: ${tx.hash}`);
          const receipt = await tx.wait();
          if (receipt.status === 1) {
            console.log(`    ✅ Linked to ${remote.chainName}`);
          } else {
            console.log(`    ❌ Transaction reverted`);
          }
        } catch (e: any) {
          if (e.message?.includes("Already linked")) {
            console.log(`    ⏭️ Already linked to ${remote.chainName}`);
          } else {
            console.log(`    ❌ Failed: ${e.message?.slice(0, 100)}`);
          }
        }
      }
    }
  }

  // Print summary
  console.log("\n=== SUMMARY: New Synthetic Token Addresses ===");
  console.log("Update these in your frontend config:\n");
  console.log("syntheticTokens: {");
  for (const [name, addr] of Object.entries(createdTokens)) {
    console.log(`  ${TOKENS[name as keyof typeof TOKENS].symbol}: "${addr}",`);
  }
  console.log("}");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
