import hardhat, { ethers } from "hardhat";
import { Options } from "@layerzerolabs/lz-v2-utilities";

/**
 * Re-link tokens on Gateway with CORRECT synthetic token addresses
 */

const LZ_GAS_LIMIT = 500000;

// Synthetic token addresses on Sonic (from setupSyntheticTokens.ts output)
const SYNTHETIC_TOKENS = {
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  sUSDT: "0x72dFC771E515423E5B0CD2acf703d0F7eb30bdEa",
  sUSDC: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B",
};

// Chain configurations
const CHAINS: Record<string, {
  gatewayAddress: string;
  tokens: Array<{
    symbol: string;
    address: string;
    decimals: number;
    syntheticSymbol: keyof typeof SYNTHETIC_TOKENS;
  }>;
}> = {
  arbitrum: {
    gatewayAddress: "0xb867d9E9D374E8b1165bcDF6D3f66d1A9AAd2447",
    tokens: [
      { symbol: "WETH", address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", decimals: 18, syntheticSymbol: "sWETH" },
      { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6, syntheticSymbol: "sUSDT" },
      { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6, syntheticSymbol: "sUSDC" },
    ],
  },
  base: {
    gatewayAddress: "0xb867d9E9D374E8b1165bcDF6D3f66d1A9AAd2447",
    tokens: [
      { symbol: "WETH", address: "0x4200000000000000000000000000000000000006", decimals: 18, syntheticSymbol: "sWETH" },
      { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6, syntheticSymbol: "sUSDC" },
    ],
  },
  ethereum: {
    gatewayAddress: "0xc792AB26B1f1670B2f5081F8d74bD6a451aD6b44",
    tokens: [
      { symbol: "WETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18, syntheticSymbol: "sWETH" },
      { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6, syntheticSymbol: "sUSDT" },
      { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6, syntheticSymbol: "sUSDC" },
    ],
  },
};

// Synthetic decimals
const SYNTHETIC_DECIMALS: Record<keyof typeof SYNTHETIC_TOKENS, number> = {
  sWETH: 18,
  sUSDT: 6,
  sUSDC: 6,
};

async function main() {
  const network = hardhat.network.name;
  
  if (!CHAINS[network]) {
    console.log(`Network ${network} not configured. Run this on: arbitrum, base, or ethereum`);
    return;
  }

  const chainConfig = CHAINS[network];
  const [deployer] = await ethers.getSigners();
  
  console.log(`\n========================================`);
  console.log(`Re-linking tokens on ${network.toUpperCase()}`);
  console.log(`========================================`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH`);
  console.log(`Gateway: ${chainConfig.gatewayAddress}`);

  const gatewayVault = await ethers.getContractAt("GatewayVault", chainConfig.gatewayAddress);
  const lzOptions = Options.newOptions().addExecutorLzReceiveOption(LZ_GAS_LIMIT, 0).toHex().toString();

  // Check current linked tokens
  console.log("\n--- Current linked tokens ---");
  const currentCount = await gatewayVault.getAvailableTokenLength();
  console.log(`Already linked: ${currentCount}`);
  
  if (currentCount.gt(0)) {
    const tokens = await gatewayVault.getAllAvailableTokens();
    for (const t of tokens) {
      console.log(`  - ${t.tokenSymbol}: ${t.tokenAddress}`);
      console.log(`    Synthetic: ${t.syntheticTokenAddress}`);
    }
  }

  // Link each token with CORRECT synthetic address
  console.log("\n--- Linking tokens with correct synthetic addresses ---");
  
  for (const token of chainConfig.tokens) {
    const syntheticAddress = SYNTHETIC_TOKENS[token.syntheticSymbol];
    const syntheticDecimals = SYNTHETIC_DECIMALS[token.syntheticSymbol];
    
    console.log(`\n${token.symbol}:`);
    console.log(`  Remote: ${token.address}`);
    console.log(`  Synthetic: ${syntheticAddress} (${token.syntheticSymbol})`);
    
    // Check if already linked
    try {
      const existingToken = await gatewayVault.getAllAvailableTokenByAddress(token.address);
      if (existingToken.syntheticTokenAddress === syntheticAddress) {
        console.log(`  ✓ Already correctly linked!`);
        continue;
      } else if (existingToken.syntheticTokenAddress !== ethers.constants.AddressZero) {
        console.log(`  ⚠️ Linked to different synthetic: ${existingToken.syntheticTokenAddress}`);
        console.log(`  Cannot re-link (already exists)`);
        continue;
      }
    } catch (e) {
      // Token not found, we can link it
    }

    // Build config with CORRECT synthetic address
    const tokenConfig = [{
      onPause: false,
      tokenAddress: token.address,
      syntheticTokenDecimals: syntheticDecimals,
      syntheticTokenAddress: syntheticAddress, // <-- THE KEY FIX!
      minBridgeAmt: token.decimals === 18 
        ? ethers.utils.parseEther("0.001") 
        : ethers.utils.parseUnits("1", token.decimals),
    }];

    try {
      // Quote fee
      const fee = await gatewayVault.quoteLinkTokenToHub(tokenConfig, lzOptions);
      console.log(`  Fee: ${ethers.utils.formatEther(fee)} ETH`);
      
      // Execute
      const tx = await gatewayVault.linkTokenToHub(tokenConfig, lzOptions, {
        value: fee.mul(150).div(100), // 50% buffer
        gasLimit: 600000,
      });
      console.log(`  TX: ${tx.hash}`);
      await tx.wait();
      console.log(`  ✓ Link message sent!`);
    } catch (e: any) {
      if (e.message?.includes("Token already linked")) {
        console.log(`  ✓ Already linked`);
      } else {
        console.log(`  ✗ Failed: ${e.message?.slice(0, 100)}`);
      }
    }
  }

  // Verify final state
  console.log("\n--- Final state ---");
  const finalCount = await gatewayVault.getAvailableTokenLength();
  console.log(`Total linked tokens: ${finalCount}`);
  
  if (finalCount.gt(0)) {
    const tokens = await gatewayVault.getAllAvailableTokens();
    for (const t of tokens) {
      console.log(`  - ${t.tokenSymbol}: ${t.tokenAddress}`);
      console.log(`    Synthetic: ${t.syntheticTokenAddress}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


