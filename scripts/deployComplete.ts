import { ethers, network } from "hardhat";

/**
 * COMPLETE REDEPLOYMENT SCRIPT
 * 
 * Run in order:
 * 1. npx hardhat run scripts/deployComplete.ts --network sonic
 * 2. npx hardhat run scripts/deployComplete.ts --network arbitrum
 * 3. npx hardhat run scripts/deployComplete.ts --network ethereum
 * 4. npx hardhat run scripts/deployComplete.ts --network base
 */

// Configuration
const LZ_ENDPOINTS = {
  sonic: "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B",
  arbitrum: "0x1a44076050125825900e736c501f859c50fE728c",
  ethereum: "0x1a44076050125825900e736c501f859c50fE728c",
  base: "0x1a44076050125825900e736c501f859c50fE728c",
};

const LZ_EIDS = {
  sonic: 30332,
  arbitrum: 30110,
  ethereum: 30101,
  base: 30184,
};

// Uniswap addresses on Sonic (can be zero if not used)
const SONIC_UNISWAP = {
  universalRouter: "0x0000000000000000000000000000000000000000",
  permit2: "0x0000000000000000000000000000000000000000",
  balancer: "0x0000000000000000000000000000000000000000",
};

// Token addresses on each chain
const REMOTE_TOKENS = {
  arbitrum: [
    { symbol: "WETH", address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", decimals: 18 },
    { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
    { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
    { symbol: "WBTC", address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", decimals: 8 },
  ],
  ethereum: [
    { symbol: "WETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18 },
    { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
    { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
    { symbol: "WBTC", address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8 },
  ],
  base: [
    { symbol: "WETH", address: "0x4200000000000000000000000000000000000006", decimals: 18 },
    { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
  ],
};

// Synthetic token config (on Hub)
const SYNTHETIC_TOKENS = [
  { symbol: "sWETH", name: "Synthetic WETH", decimals: 18 },
  { symbol: "sUSDC", name: "Synthetic USDC", decimals: 6 },
  { symbol: "sUSDT", name: "Synthetic USDT", decimals: 6 },
  { symbol: "sBTC", name: "Synthetic BTC", decimals: 8 },
];

// State file to share between runs
const STATE_FILE = "./deployment-state.json";
const fs = require("fs");

function loadState(): any {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return { hub: null, gateways: {}, syntheticTokens: {} };
  }
}

function saveState(state: any) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function deploySonicHub() {
  const [deployer] = await ethers.getSigners();
  console.log("\n=== DEPLOYING HUB ON SONIC ===");
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(await deployer.getBalance())} S`);

  const state = loadState();

  // Deploy Hub
  console.log("\n1. Deploying SyntheticTokenHub...");
  const Hub = await ethers.getContractFactory("SyntheticTokenHub");
  const hub = await Hub.deploy(
    LZ_ENDPOINTS.sonic,
    deployer.address,
    SONIC_UNISWAP.universalRouter,
    SONIC_UNISWAP.permit2,
    SONIC_UNISWAP.balancer,
    { gasLimit: 10000000 }
  );
  await hub.deployed();
  console.log(`   Hub deployed: ${hub.address}`);
  state.hub = hub.address;

  // Create synthetic tokens
  console.log("\n2. Creating synthetic tokens...");
  for (const token of SYNTHETIC_TOKENS) {
    console.log(`   Creating ${token.symbol}...`);
    const tx = await hub.createSyntheticToken(token.symbol, token.decimals, { gasLimit: 500000 });
    await tx.wait();
    console.log(`   ✅ ${token.symbol} created`);
  }

  // Get synthetic token addresses
  console.log("\n3. Getting synthetic token addresses...");
  const hubAbi = ["function getSyntheticToken(uint256 _id) view returns (address)"];
  const hubContract = new ethers.Contract(hub.address, hubAbi, deployer);
  
  for (let i = 1; i <= SYNTHETIC_TOKENS.length; i++) {
    try {
      const addr = await hubContract.getSyntheticToken(i);
      const symbol = SYNTHETIC_TOKENS[i - 1].symbol;
      state.syntheticTokens[symbol] = addr;
      console.log(`   ${symbol}: ${addr}`);
    } catch (e) {
      console.log(`   Token ${i}: Error getting address`);
    }
  }

  saveState(state);

  console.log("\n=== HUB DEPLOYMENT COMPLETE ===");
  console.log(`Hub: ${hub.address}`);
  console.log("\nNext: Run on arbitrum, ethereum, and base networks");
}

async function deployGateway() {
  const [deployer] = await ethers.getSigners();
  const chainName = network.name;
  
  console.log(`\n=== DEPLOYING GATEWAY ON ${chainName.toUpperCase()} ===`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH`);

  const state = loadState();
  
  if (!state.hub) {
    throw new Error("Hub not deployed yet! Run on sonic first.");
  }

  const lzEndpoint = LZ_ENDPOINTS[chainName as keyof typeof LZ_ENDPOINTS];
  const tokens = REMOTE_TOKENS[chainName as keyof typeof REMOTE_TOKENS];
  
  if (!tokens) {
    throw new Error(`No token config for ${chainName}`);
  }

  // Deploy Gateway
  console.log("\n1. Deploying GatewayVault...");
  const Gateway = await ethers.getContractFactory("GatewayVault");
  const gateway = await Gateway.deploy(
    lzEndpoint,
    deployer.address,
    LZ_EIDS.sonic,
    { gasLimit: 5000000 }
  );
  await gateway.deployed();
  console.log(`   Gateway deployed: ${gateway.address}`);
  state.gateways[chainName] = gateway.address;
  saveState(state);

  // Set Hub as peer
  console.log("\n2. Setting Hub as peer...");
  const hubBytes32 = ethers.utils.hexZeroPad(state.hub, 32);
  const setPeerTx = await gateway.setPeer(LZ_EIDS.sonic, hubBytes32, { gasLimit: 200000 });
  await setPeerTx.wait();
  console.log("   ✅ Hub set as peer");

  // Prepare token configs
  console.log("\n3. Preparing token configurations...");
  const tokenConfigs = [];
  
  for (const token of tokens) {
    // Map to synthetic token
    const syntheticKey = token.symbol === "WETH" ? "sWETH" : 
                        token.symbol === "USDC" ? "sUSDC" :
                        token.symbol === "USDT" ? "sUSDT" : "sBTC";
    
    const syntheticAddr = state.syntheticTokens[syntheticKey];
    if (!syntheticAddr) {
      console.log(`   ⚠️ Skipping ${token.symbol} - synthetic token not found`);
      continue;
    }
    
    const syntheticDecimals = SYNTHETIC_TOKENS.find(t => t.symbol === syntheticKey)?.decimals || 18;
    const minBridgeAmt = token.symbol === "WBTC" ? 1000 : 
                         token.symbol === "WETH" ? ethers.utils.parseUnits("0.001", 18) :
                         ethers.utils.parseUnits("1", token.decimals);

    tokenConfigs.push({
      onPause: false,
      tokenAddress: token.address,
      syntheticTokenDecimals: syntheticDecimals,
      syntheticTokenAddress: syntheticAddr,
      minBridgeAmt: minBridgeAmt,
    });

    console.log(`   ${token.symbol}: ${token.address} → ${syntheticAddr}`);
  }

  // Link tokens
  console.log("\n4. Linking tokens to Hub...");
  const lzOptions = ethers.utils.hexConcat([
    "0x0003", "0x01", "0x0011", "0x01",
    ethers.utils.hexZeroPad(ethers.utils.hexlify(500000), 16),
  ]);

  const fee = ethers.utils.parseEther("0.01");
  
  try {
    const linkTx = await gateway.linkTokenToHub(tokenConfigs, lzOptions, { 
      value: fee, 
      gasLimit: 1000000 
    });
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

  saveState(state);

  console.log(`\n=== GATEWAY DEPLOYMENT COMPLETE ===`);
  console.log(`Gateway: ${gateway.address}`);
}

async function main() {
  const chainName = network.name;
  
  if (chainName === "sonic") {
    await deploySonicHub();
  } else if (["arbitrum", "ethereum", "base"].includes(chainName)) {
    await deployGateway();
  } else {
    console.log(`Unknown network: ${chainName}`);
    console.log("Supported: sonic, arbitrum, ethereum, base");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});


