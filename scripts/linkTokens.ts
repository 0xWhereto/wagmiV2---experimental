import hardhat, { ethers } from "hardhat";
import { Options } from "@layerzerolabs/lz-v2-utilities";

/**
 * Link ETH, USDT, and USDC tokens from all Gateway chains to the Sonic Hub
 * 
 * This script should be run on each Gateway chain (Arbitrum, Base, Ethereum)
 * to register tokens for bridging.
 * 
 * Usage:
 *   npx hardhat run scripts/linkTokens.ts --network arbitrum
 *   npx hardhat run scripts/linkTokens.ts --network base
 *   npx hardhat run scripts/linkTokens.ts --network ethereum
 */

// ============ DEPLOYED ADDRESSES ============
const GATEWAY_ADDRESSES: Record<string, string> = {
  arbitrum: "0xb867d9E9D374E8b1165bcDF6D3f66d1A9AAd2447",
  base: "0xb867d9E9D374E8b1165bcDF6D3f66d1A9AAd2447",
  ethereum: "0xc792AB26B1f1670B2f5081F8d74bD6a451aD6b44",
};

// ============ TOKEN ADDRESSES PER CHAIN ============
const TOKENS: Record<string, { address: string; symbol: string; decimals: number }[]> = {
  arbitrum: [
    { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", symbol: "WETH", decimals: 18 },
    { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", symbol: "USDT", decimals: 6 },
    { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", symbol: "USDC", decimals: 6 },
  ],
  base: [
    { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 },
    { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6 },
    // Note: Base doesn't have native USDT, using USDbC instead
    { address: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", symbol: "USDbC", decimals: 6 },
  ],
  ethereum: [
    { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH", decimals: 18 },
    { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT", decimals: 6 },
    { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", decimals: 6 },
  ],
};

// Minimum bridge amounts (in token's smallest unit)
const MIN_BRIDGE_AMOUNTS: Record<string, bigint> = {
  WETH: ethers.utils.parseUnits("0.001", 18).toBigInt(), // 0.001 ETH
  USDT: ethers.utils.parseUnits("1", 6).toBigInt(),       // 1 USDT
  USDC: ethers.utils.parseUnits("1", 6).toBigInt(),       // 1 USDC
  USDbC: ethers.utils.parseUnits("1", 6).toBigInt(),      // 1 USDbC
};

// Gas limit for LayerZero execution
const LZ_GAS_LIMIT = 500000;

async function main() {
  const network = hardhat.network.name;
  
  if (!GATEWAY_ADDRESSES[network]) {
    console.log(`Network ${network} is not a gateway chain. Run this on: arbitrum, base, or ethereum`);
    return;
  }

  const [deployer] = await ethers.getSigners();
  console.log(`\n========================================`);
  console.log(`Linking tokens on ${network.toUpperCase()}`);
  console.log(`========================================`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH`);

  const gatewayAddress = GATEWAY_ADDRESSES[network];
  console.log(`\nGateway Vault: ${gatewayAddress}`);

  const gatewayVault = await ethers.getContractAt("GatewayVault", gatewayAddress);

  // Check existing tokens
  const existingTokenCount = await gatewayVault.getAvailableTokenLength();
  console.log(`\nExisting linked tokens: ${existingTokenCount}`);

  if (existingTokenCount.gt(0)) {
    const existingTokens = await gatewayVault.getAllAvailableTokens();
    console.log("Already linked:");
    for (const token of existingTokens) {
      console.log(`  - ${token.tokenSymbol} (${token.tokenAddress})`);
    }
  }

  // Get tokens to link for this network
  const tokensToLink = TOKENS[network];
  if (!tokensToLink || tokensToLink.length === 0) {
    console.log(`No tokens configured for ${network}`);
    return;
  }

  // Filter out already linked tokens
  const existingAddresses = existingTokenCount.gt(0) 
    ? (await gatewayVault.getAllAvailableTokens()).map((t: any) => t.tokenAddress.toLowerCase())
    : [];
  
  const newTokens = tokensToLink.filter(
    t => !existingAddresses.includes(t.address.toLowerCase())
  );

  if (newTokens.length === 0) {
    console.log("\n✓ All tokens are already linked!");
    return;
  }

  console.log(`\nTokens to link: ${newTokens.length}`);
  for (const token of newTokens) {
    console.log(`  - ${token.symbol} (${token.address})`);
  }

  // Build token config for linkTokenToHub
  // Note: syntheticTokenAddress will be 0x0 - the Hub creates synthetic tokens automatically
  const tokenConfigs = newTokens.map(token => ({
    onPause: false,
    tokenAddress: token.address,
    syntheticTokenDecimals: token.decimals, // Same decimals as original
    syntheticTokenAddress: ethers.constants.AddressZero, // Hub will create
    minBridgeAmt: MIN_BRIDGE_AMOUNTS[token.symbol] || ethers.utils.parseUnits("1", token.decimals).toBigInt(),
  }));

  // Build LayerZero options using official LZ utilities
  const lzOptions = Options.newOptions().addExecutorLzReceiveOption(LZ_GAS_LIMIT, 0).toHex().toString();
  console.log(`\nLZ Options: ${lzOptions}`);

  // Quote the fee
  console.log("\nQuoting LayerZero fee...");
  let nativeFee: any;
  try {
    nativeFee = await gatewayVault.quoteLinkTokenToHub(tokenConfigs, lzOptions);
    console.log(`Estimated fee: ${ethers.utils.formatEther(nativeFee)} ETH`);
  } catch (e: any) {
    console.log("Quote failed, using minimal fee of 0.001 ETH");
    console.log("Error:", e.message?.slice(0, 100));
    nativeFee = ethers.utils.parseEther("0.001");
  }

  // Add 50% buffer
  const feeWithBuffer = nativeFee.mul(150).div(100);
  console.log(`Fee with 50% buffer: ${ethers.utils.formatEther(feeWithBuffer)} ETH`);

  // Check balance
  const balance = await deployer.getBalance();
  console.log(`Current balance: ${ethers.utils.formatEther(balance)} ETH`);
  
  // Calculate max we can spend (leave some for gas)
  const gasReserve = ethers.utils.parseEther("0.001");
  const maxSpendable = balance.sub(gasReserve);
  
  let actualFee = feeWithBuffer;
  if (balance.lt(feeWithBuffer)) {
    if (maxSpendable.gt(nativeFee)) {
      console.log(`\n⚠️ Using available balance instead of buffered amount`);
      actualFee = maxSpendable;
    } else {
      console.log(`\n❌ Insufficient balance. Need ${ethers.utils.formatEther(feeWithBuffer)} ETH, have ${ethers.utils.formatEther(balance)} ETH`);
      return;
    }
  }
  
  console.log(`Will send: ${ethers.utils.formatEther(actualFee)} ETH as LZ fee`);

  // Execute linkTokenToHub
  console.log("\n🔗 Linking tokens to Hub...");
  try {
    const tx = await gatewayVault.linkTokenToHub(tokenConfigs, lzOptions, {
      value: actualFee,
      gasLimit: 500000,
    });
    console.log(`Transaction hash: ${tx.hash}`);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log(`\n✅ Tokens linked successfully!`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);
    console.log(`Block: ${receipt.blockNumber}`);

    // Verify linked tokens
    const newTokenCount = await gatewayVault.getAvailableTokenLength();
    console.log(`\nTotal linked tokens now: ${newTokenCount}`);
    
    const allTokens = await gatewayVault.getAllAvailableTokens();
    console.log("\nAll linked tokens:");
    for (const token of allTokens) {
      console.log(`  - ${token.tokenSymbol}`);
      console.log(`    Address: ${token.tokenAddress}`);
      console.log(`    Synthetic: ${token.syntheticTokenAddress}`);
      console.log(`    Decimals Delta: ${token.decimalsDelta}`);
      console.log(`    Paused: ${token.onPause}`);
    }

  } catch (e: any) {
    console.log(`\n❌ Failed to link tokens: ${e.message}`);
    if (e.reason) console.log(`Reason: ${e.reason}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

