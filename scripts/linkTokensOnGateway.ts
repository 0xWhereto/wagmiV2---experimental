import { ethers, network } from "hardhat";

const HUB_EID = 30332; // Sonic LZ EID

// Existing synthetic tokens on Hub
const SYNTHETIC_TOKENS = {
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  sUSDT: "0x72dFC771E515423E5B0CD2acf703d0F7eb30bdEa",
  sUSDC: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B",
  sBTC: "0x2F0324268031E6413280F3B5ddBc4A97639A284a",
};

// New Gateway addresses
const GATEWAYS = {
  arbitrum: "0x87D26048e94Cb62fad640F59054f7502dFE6209f",
  ethereum: "0xBb34D03d6110c079858B3Dd71F3791647b8F62cf",
};

// Token addresses
const TOKENS = {
  arbitrum: {
    WETH: { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", synthetic: SYNTHETIC_TOKENS.sWETH, decimals: 18 },
    USDC: { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", synthetic: SYNTHETIC_TOKENS.sUSDC, decimals: 6 },
    USDT: { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", synthetic: SYNTHETIC_TOKENS.sUSDT, decimals: 6 },
    WBTC: { address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", synthetic: SYNTHETIC_TOKENS.sBTC, decimals: 8 },
  },
  ethereum: {
    WETH: { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", synthetic: SYNTHETIC_TOKENS.sWETH, decimals: 18 },
    USDC: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", synthetic: SYNTHETIC_TOKENS.sUSDC, decimals: 6 },
    USDT: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", synthetic: SYNTHETIC_TOKENS.sUSDT, decimals: 6 },
    WBTC: { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", synthetic: SYNTHETIC_TOKENS.sBTC, decimals: 8 },
  },
};

const SYNTHETIC_DECIMALS = {
  sWETH: 18,
  sUSDT: 6,
  sUSDC: 6,
  sBTC: 8,
};

const gatewayAbi = [
  "function linkTokenToHub(tuple(bool onPause, address tokenAddress, uint8 syntheticTokenDecimals, address syntheticTokenAddress, uint256 minBridgeAmt)[] _tokensConfig, bytes _options) external payable",
  "function getAllAvailableTokens() view returns (tuple(bool onPause, int8 decimalsDelta, address syntheticTokenAddress, address tokenAddress, uint8 tokenDecimals, string tokenSymbol, uint256 tokenBalance)[])",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainName = network.name;
  
  console.log(`\n=== Linking Tokens on ${chainName.toUpperCase()} Gateway ===`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH`);

  if (chainName !== "arbitrum" && chainName !== "ethereum") {
    throw new Error("Run this on arbitrum or ethereum network");
  }

  const gatewayAddress = GATEWAYS[chainName as keyof typeof GATEWAYS];
  if (!gatewayAddress) {
    throw new Error(`No gateway address for ${chainName}`);
  }

  const gateway = new ethers.Contract(gatewayAddress, gatewayAbi, deployer);
  const tokens = TOKENS[chainName as keyof typeof TOKENS];

  // Check current tokens
  console.log("\nCurrent tokens in gateway:");
  try {
    const currentTokens = await gateway.getAllAvailableTokens();
    console.log(`  ${currentTokens.length} tokens registered`);
    for (const t of currentTokens) {
      console.log(`  - ${t.tokenSymbol}: ${t.syntheticTokenAddress === ethers.constants.AddressZero ? "❌ NOT LINKED" : "✅ Linked"}`);
    }
  } catch (e) {
    console.log("  No tokens registered yet");
  }

  // Prepare token configs
  console.log("\nPreparing token configurations...");
  const tokenConfigs = [];
  for (const [name, info] of Object.entries(tokens)) {
    const syntheticKey = name === "WETH" ? "sWETH" : name === "USDC" ? "sUSDC" : name === "USDT" ? "sUSDT" : "sBTC";
    const syntheticDecimals = SYNTHETIC_DECIMALS[syntheticKey as keyof typeof SYNTHETIC_DECIMALS];
    
    tokenConfigs.push({
      onPause: false,
      tokenAddress: info.address,
      syntheticTokenDecimals: syntheticDecimals,
      syntheticTokenAddress: info.synthetic,
      minBridgeAmt: name === "WBTC" ? 1000 : name === "WETH" ? ethers.utils.parseUnits("0.001", 18) : ethers.utils.parseUnits("1", 6),
    });
    
    console.log(`  ${name}: ${info.address} → ${info.synthetic}`);
  }

  // LZ Options
  const lzOptions = ethers.utils.hexConcat([
    "0x0003",
    "0x01",
    "0x0011",
    "0x01",
    ethers.utils.hexZeroPad(ethers.utils.hexlify(500000), 16),
  ]);

  // Send with generous fee
  const fee = ethers.utils.parseEther("0.005");
  console.log(`\nSending linkTokenToHub with ${ethers.utils.formatEther(fee)} ETH fee...`);

  try {
    const tx = await gateway.linkTokenToHub(tokenConfigs, lzOptions, { value: fee, gasLimit: 800000 });
    console.log(`TX: ${tx.hash}`);
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      console.log("✅ Tokens linked successfully!");
      
      // Verify
      console.log("\nVerifying tokens after linking:");
      const newTokens = await gateway.getAllAvailableTokens();
      for (const t of newTokens) {
        const status = t.syntheticTokenAddress !== ethers.constants.AddressZero;
        console.log(`  ${t.tokenSymbol}: ${status ? "✅ Linked to " + t.syntheticTokenAddress : "❌ NOT LINKED"}`);
      }
    } else {
      console.log("❌ Transaction failed");
    }
  } catch (e: any) {
    console.log(`❌ Error: ${e.message?.substring(0, 200)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

