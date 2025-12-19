import { ethers, network } from "hardhat";

/**
 * Link tokens on an already-deployed gateway
 */

// Gateway addresses
const GATEWAYS: Record<string, string> = {
  arbitrum: "0x527f843672C4CD7F45B126f3E1E82D60A741C609",
  ethereum: "0x5826e10B513C891910032F15292B2F1b3041C3Df",
  base: "", // Deploy first
};

const SYNTHETICS = {
  sWETH: { address: "0x5E501C482952c1F2D58a4294F9A97759968c5125", decimals: 18 },
  sUSDC: { address: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B", decimals: 6 },
  sUSDT: { address: "0x72dFC771E515423E5B0CD2acf703d0F7eb30bdEa", decimals: 6 },
  sBTC: { address: "0x2F0324268031E6413280F3B5ddBc4A97639A284a", decimals: 8 },
};

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

const gatewayAbi = [
  "function linkTokenToHub(tuple(bool onPause, address tokenAddress, uint8 syntheticTokenDecimals, address syntheticTokenAddress, uint256 minBridgeAmt)[] _tokensConfig, bytes _options) external payable",
  "function getAllAvailableTokens() view returns (tuple(bool onPause, int8 decimalsDelta, address syntheticTokenAddress, address tokenAddress, uint8 tokenDecimals, string tokenSymbol, uint256 tokenBalance)[])",
];

async function main() {
  const chainName = network.name;
  const [deployer] = await ethers.getSigners();
  
  const gatewayAddr = GATEWAYS[chainName];
  const tokens = CHAIN_TOKENS[chainName];
  
  if (!gatewayAddr) throw new Error(`No gateway for ${chainName}`);
  if (!tokens) throw new Error(`No tokens for ${chainName}`);
  
  console.log(`\nLinking tokens on ${chainName.toUpperCase()}`);
  console.log(`Gateway: ${gatewayAddr}`);
  console.log(`Balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH`);
  
  const gateway = new ethers.Contract(gatewayAddr, gatewayAbi, deployer);
  
  // Check current state
  try {
    const current = await gateway.getAllAvailableTokens();
    console.log(`\nCurrent tokens: ${current.length}`);
    if (current.length > 0) {
      console.log("Already has tokens, skipping...");
      return;
    }
  } catch (e) {
    console.log("No tokens yet");
  }

  // Prepare configs
  const tokenConfigs = tokens.map(t => {
    const synthetic = SYNTHETICS[t.syntheticKey];
    console.log(`  ${t.symbol} → ${synthetic.address}`);
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

  // LZ options - proper format
  const lzOptions = ethers.utils.hexConcat([
    "0x0003",  // type 3
    "0x01",    // version 1
    "0x0011",  // length 17 (1 + 16)
    "0x01",    // executor lzReceive
    ethers.utils.hexZeroPad(ethers.utils.hexlify(400000), 16), // gas
  ]);
  
  console.log(`\nLZ Options: ${lzOptions}`);
  
  const fee = ethers.utils.parseEther("0.002");
  console.log(`Fee: ${ethers.utils.formatEther(fee)} ETH`);
  
  try {
    const tx = await gateway.linkTokenToHub(tokenConfigs, lzOptions, {
      value: fee,
      gasLimit: 1000000,
    });
    console.log(`TX: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Status: ${receipt.status === 1 ? "✅ SUCCESS" : "❌ FAILED"}`);
  } catch (e: any) {
    console.log(`Error: ${e.message?.substring(0, 200)}`);
  }
}

main().catch(console.error);

