import hardhat, { ethers } from "hardhat";
import { Options } from "@layerzerolabs/lz-v2-utilities";

/**
 * Link tokens on the new Arbitrum Gateway
 */

const LZ_GAS_LIMIT = 500000;
const NEW_GATEWAY_ADDRESS = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";

// Synthetic token addresses on Sonic
const SYNTHETIC_TOKENS = {
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  sUSDT: "0x72dFC771E515423E5B0CD2acf703d0F7eb30bdEa",
  sUSDC: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B",
};

// Arbitrum tokens
const TOKENS = [
  { symbol: "WETH", address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", decimals: 18, syntheticSymbol: "sWETH" as const },
  { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6, syntheticSymbol: "sUSDT" as const },
  { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6, syntheticSymbol: "sUSDC" as const },
];

// Synthetic decimals
const SYNTHETIC_DECIMALS: Record<keyof typeof SYNTHETIC_TOKENS, number> = {
  sWETH: 18,
  sUSDT: 6,
  sUSDC: 6,
};

async function main() {
  const network = hardhat.network.name;
  if (network !== "arbitrum") {
    console.log("This script should be run on Arbitrum network");
    return;
  }

  const [deployer] = await ethers.getSigners();
  
  console.log(`\n========================================`);
  console.log(`Linking Tokens on New Arbitrum Gateway`);
  console.log(`========================================`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH`);
  console.log(`Gateway: ${NEW_GATEWAY_ADDRESS}`);

  const gateway = await ethers.getContractAt("GatewayVault", NEW_GATEWAY_ADDRESS);
  const lzOptions = Options.newOptions().addExecutorLzReceiveOption(LZ_GAS_LIMIT, 0).toHex().toString();

  // Check current linked tokens
  console.log("\n--- Current linked tokens ---");
  const currentCount = await gateway.getAvailableTokenLength();
  console.log(`Already linked: ${currentCount}`);

  // Link each token
  console.log("\n--- Linking tokens ---");
  
  for (const token of TOKENS) {
    const syntheticAddress = SYNTHETIC_TOKENS[token.syntheticSymbol];
    const syntheticDecimals = SYNTHETIC_DECIMALS[token.syntheticSymbol];
    
    console.log(`\n${token.symbol}:`);
    console.log(`  Remote: ${token.address}`);
    console.log(`  Synthetic: ${syntheticAddress} (${token.syntheticSymbol})`);
    
    const tokenConfig = [{
      onPause: false,
      tokenAddress: token.address,
      syntheticTokenDecimals: syntheticDecimals,
      syntheticTokenAddress: syntheticAddress,
      minBridgeAmt: token.decimals === 18 
        ? ethers.utils.parseEther("0.001") 
        : ethers.utils.parseUnits("1", token.decimals),
    }];

    try {
      // Quote fee
      const fee = await gateway.quoteLinkTokenToHub(tokenConfig, lzOptions);
      console.log(`  Fee: ${ethers.utils.formatEther(fee)} ETH`);
      
      // Execute
      const tx = await gateway.linkTokenToHub(tokenConfig, lzOptions, {
        value: fee.mul(150).div(100), // 50% buffer
        gasLimit: 600000,
      });
      console.log(`  TX: ${tx.hash}`);
      await tx.wait();
      console.log(`  ✓ Link message sent!`);
    } catch (e: any) {
      console.log(`  ✗ Failed: ${e.message?.slice(0, 150)}`);
    }
  }

  // Verify final state
  console.log("\n--- Final state ---");
  const finalCount = await gateway.getAvailableTokenLength();
  console.log(`Total linked tokens: ${finalCount}`);
  
  if (finalCount.gt(0)) {
    const tokens = await gateway.getAllAvailableTokens();
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



