import { ethers, network } from "hardhat";

/**
 * Deploy Gateway and Link Tokens
 * 
 * Usage:
 *   npx hardhat run scripts/deployGatewayFresh.ts --network arbitrum
 *   npx hardhat run scripts/deployGatewayFresh.ts --network ethereum
 *   npx hardhat run scripts/deployGatewayFresh.ts --network base
 */

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const HUB_EID = 30332;

const LZ_ENDPOINTS: Record<string, string> = {
  arbitrum: "0x1a44076050125825900e736c501f859c50fE728c",
  ethereum: "0x1a44076050125825900e736c501f859c50fE728c",
  base: "0x1a44076050125825900e736c501f859c50fE728c",
};

// Existing synthetic tokens on Hub
const SYNTHETICS = {
  sWETH: { address: "0x5E501C482952c1F2D58a4294F9A97759968c5125", decimals: 18 },
  sUSDC: { address: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B", decimals: 6 },
  sUSDT: { address: "0x72dFC771E515423E5B0CD2acf703d0F7eb30bdEa", decimals: 6 },
  sBTC: { address: "0x2F0324268031E6413280F3B5ddBc4A97639A284a", decimals: 8 },
};

// Tokens per chain
const CHAIN_TOKENS: Record<string, Array<{symbol: string, address: string, syntheticKey: keyof typeof SYNTHETICS}>> = {
  arbitrum: [
    { symbol: "WETH", address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", syntheticKey: "sWETH" },
    { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", syntheticKey: "sUSDC" },
    { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", syntheticKey: "sUSDT" },
    { symbol: "WBTC", address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", syntheticKey: "sBTC" },
  ],
  ethereum: [
    { symbol: "WETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", syntheticKey: "sWETH" },
    { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", syntheticKey: "sUSDC" },
    { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", syntheticKey: "sUSDT" },
    { symbol: "WBTC", address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", syntheticKey: "sBTC" },
  ],
  base: [
    { symbol: "WETH", address: "0x4200000000000000000000000000000000000006", syntheticKey: "sWETH" },
    { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", syntheticKey: "sUSDC" },
  ],
};

async function main() {
  const chainName = network.name;
  const [deployer] = await ethers.getSigners();
  
  console.log(`\n========================================`);
  console.log(`  DEPLOYING GATEWAY ON ${chainName.toUpperCase()}`);
  console.log(`========================================\n`);
  
  console.log(`Deployer: ${deployer.address}`);
  const balance = await deployer.getBalance();
  console.log(`Balance: ${ethers.utils.formatEther(balance)} ETH`);
  
  if (balance.lt(ethers.utils.parseEther("0.003"))) {
    throw new Error("Insufficient balance! Need at least 0.003 ETH");
  }

  const endpoint = LZ_ENDPOINTS[chainName];
  const tokens = CHAIN_TOKENS[chainName];
  
  if (!endpoint || !tokens) {
    throw new Error(`Unsupported network: ${chainName}`);
  }

  // Step 1: Deploy Gateway
  console.log("\n[1/4] Deploying GatewayVault...");
  const Gateway = await ethers.getContractFactory("GatewayVault");
  const gateway = await Gateway.deploy(endpoint, deployer.address, HUB_EID, { gasLimit: 5000000 });
  await gateway.deployed();
  console.log(`      ✅ Gateway: ${gateway.address}`);

  // Step 2: Set Hub as peer
  console.log("\n[2/4] Setting Hub as peer...");
  const hubBytes32 = ethers.utils.hexZeroPad(HUB, 32);
  const tx1 = await gateway.setPeer(HUB_EID, hubBytes32, { gasLimit: 200000 });
  await tx1.wait();
  console.log(`      ✅ Peer set`);

  // Step 3: Prepare token configs
  console.log("\n[3/4] Preparing token configs...");
  const tokenConfigs = tokens.map(t => {
    const synthetic = SYNTHETICS[t.syntheticKey];
    console.log(`      ${t.symbol} → ${synthetic.address}`);
    return {
      onPause: false,
      tokenAddress: t.address,
      syntheticTokenDecimals: synthetic.decimals,
      syntheticTokenAddress: synthetic.address,
      minBridgeAmt: t.symbol === "WBTC" ? 1000 : 
                    t.symbol === "WETH" ? ethers.utils.parseUnits("0.0001", 18) :
                    ethers.utils.parseUnits("0.1", 6),
    };
  });

  // Step 4: Link tokens
  console.log("\n[4/4] Linking tokens to Hub via LayerZero...");
  const lzOptions = "0x00030100110100000000000000000000000000061a80"; // 400k gas
  const fee = ethers.utils.parseEther("0.002");
  
  const tx2 = await gateway.linkTokenToHub(tokenConfigs, lzOptions, {
    value: fee,
    gasLimit: 800000,
  });
  console.log(`      TX: ${tx2.hash}`);
  const receipt = await tx2.wait();
  
  if (receipt.status === 1) {
    console.log(`      ✅ Link transaction successful!`);
    console.log(`\n      ⏳ LayerZero message sent to Hub.`);
    console.log(`      Check https://layerzeroscan.com for message delivery.`);
  } else {
    console.log(`      ❌ Transaction failed`);
  }

  // Summary
  console.log(`\n========================================`);
  console.log(`  DEPLOYMENT COMPLETE`);
  console.log(`========================================`);
  console.log(`\nChain: ${chainName}`);
  console.log(`Gateway: ${gateway.address}`);
  console.log(`Tokens: ${tokens.map(t => t.symbol).join(", ")}`);
  console.log(`\nUpdate frontend config:`);
  console.log(`  ${chainName}: {`);
  console.log(`    contracts: {`);
  console.log(`      gatewayVault: "${gateway.address}",`);
  console.log(`    }`);
  console.log(`  }`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

