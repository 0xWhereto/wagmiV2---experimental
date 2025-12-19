import { ethers, network } from "hardhat";

// Hub address on Sonic
const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const HUB_EID = 30332; // Sonic LZ EID

// Existing synthetic tokens on Hub
const SYNTHETIC_TOKENS = {
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  sUSDT: "0x72dFC771E515423E5B0CD2acf703d0F7eb30bdEa",
  sUSDC: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B",
  sBTC: "0x2F0324268031E6413280F3B5ddBc4A97639A284a",
};

// LZ Endpoints
const LZ_ENDPOINTS = {
  arbitrum: "0x1a44076050125825900e736c501f859c50fE728c",
  ethereum: "0x1a44076050125825900e736c501f859c50fE728c",
};

// Token addresses on each chain
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

// Synthetic token decimals (on Hub/Sonic)
const SYNTHETIC_DECIMALS = {
  sWETH: 18,
  sUSDT: 6,
  sUSDC: 6,
  sBTC: 8,
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainName = network.name;
  
  console.log(`\n=== Deploying New Gateway on ${chainName.toUpperCase()} ===`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH`);

  if (chainName !== "arbitrum" && chainName !== "ethereum") {
    throw new Error("Run this on arbitrum or ethereum network");
  }

  const lzEndpoint = LZ_ENDPOINTS[chainName as keyof typeof LZ_ENDPOINTS];
  const tokens = TOKENS[chainName as keyof typeof TOKENS];

  // Deploy GatewayVault
  console.log("\n1. Deploying GatewayVault...");
  const GatewayVault = await ethers.getContractFactory("GatewayVault");
  const gateway = await GatewayVault.deploy(
    lzEndpoint,
    deployer.address,
    HUB_EID,
    { gasLimit: 5000000 }
  );
  await gateway.deployed();
  console.log(`   GatewayVault deployed: ${gateway.address}`);

  // Set Hub as peer
  console.log("\n2. Setting Hub as peer...");
  const hubAddressBytes32 = ethers.utils.hexZeroPad(HUB_ADDRESS, 32);
  const setPeerTx = await gateway.setPeer(HUB_EID, hubAddressBytes32);
  await setPeerTx.wait();
  console.log("   ✅ Hub set as peer");

  // Prepare token configs for linkTokenToHub
  console.log("\n3. Preparing token configurations...");
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
    
    console.log(`   ${name}: ${info.address} → ${info.synthetic}`);
  }

  // Get quote for linkTokenToHub LZ message
  console.log("\n4. Getting quote for linkTokenToHub...");
  const lzOptions = ethers.utils.hexConcat([
    "0x0003", // Type 3
    "0x01",   // Version 1
    "0x0011", // Length 17
    "0x01",   // Executor type 1
    ethers.utils.hexZeroPad(ethers.utils.hexlify(500000), 16), // Gas limit
  ]);
  
  // Estimate fee (we'll use a generous amount)
  const estimatedFee = ethers.utils.parseEther("0.01");
  
  console.log("\n5. Calling linkTokenToHub...");
  try {
    const linkTx = await gateway.linkTokenToHub(
      tokenConfigs,
      lzOptions,
      { value: estimatedFee, gasLimit: 1000000 }
    );
    console.log(`   TX: ${linkTx.hash}`);
    const receipt = await linkTx.wait();
    
    if (receipt.status === 1) {
      console.log("   ✅ Tokens linked successfully!");
    } else {
      console.log("   ❌ Transaction failed");
    }
  } catch (e: any) {
    console.log(`   ❌ Error: ${e.message?.substring(0, 150)}`);
  }

  // Summary
  console.log("\n=== Deployment Summary ===");
  console.log(`Chain: ${chainName}`);
  console.log(`New Gateway: ${gateway.address}`);
  console.log("\nUpdate frontend config with this address!");
  console.log(`\nFor ${chainName}:`);
  console.log(`  gatewayVault: "${gateway.address}",`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

