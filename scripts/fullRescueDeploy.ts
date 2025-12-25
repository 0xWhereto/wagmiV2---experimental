import { ethers } from "hardhat";

/**
 * FULL RESCUE DEPLOYMENT
 * 
 * This script deploys:
 * 1. New SyntheticTokenHub on Sonic with adminRescueFromGateway function
 * 2. New GatewayVaults on Arbitrum, Ethereum, Base with rescueTokens function
 * 3. Sets up all peers
 * 4. Links all tokens
 * 5. Rescues tokens from old gateways (after Hub is live)
 * 
 * WARNING: This replaces the entire infrastructure!
 */

const RECIPIENT = "0x4151E05ABe56192e2A6775612C2020509Fd50637";
const PRIVATE_KEY = process.env.PRIVATE_KEY!;

// Chain configs
const CHAINS = {
  sonic: {
    chainId: 146,
    eid: 30332,
    rpc: "https://rpc.soniclabs.com",
    endpoint: "0x6C7Ab2202C98C4227C5c46f1417D81144DA716Ff", // LZ V2 endpoint on Sonic
  },
  arbitrum: {
    chainId: 42161,
    eid: 30110,
    rpc: "https://arb1.arbitrum.io/rpc",
    endpoint: "0x1a44076050125825900e736c501f859c50fE728c",
    oldGateway: "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e",
    tokens: [
      { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", symbol: "WETH", decimals: 18, minBridge: "1000000000000000" },
      { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", symbol: "USDT", decimals: 6, minBridge: "1000000" },
      { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", symbol: "USDC", decimals: 6, minBridge: "1000000" },
      { address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", symbol: "WBTC", decimals: 8, minBridge: "10000" },
    ]
  },
  ethereum: {
    chainId: 1,
    eid: 30101,
    rpc: "https://ethereum-rpc.publicnode.com",
    endpoint: "0x1a44076050125825900e736c501f859c50fE728c",
    oldGateway: "0xba36FC6568B953f691dd20754607590C59b7646a",
    tokens: [
      { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH", decimals: 18, minBridge: "1000000000000000" },
      { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT", decimals: 6, minBridge: "1000000" },
      { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", decimals: 6, minBridge: "1000000" },
      { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", symbol: "WBTC", decimals: 8, minBridge: "10000" },
    ]
  },
  base: {
    chainId: 8453,
    eid: 30184,
    rpc: "https://mainnet.base.org",
    endpoint: "0x1a44076050125825900e736c501f859c50fE728c",
    oldGateway: "0xB712543E7fB87C411AAbB10c6823cf39bbEBB4Bb",
    tokens: [
      { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18, minBridge: "1000000000000000" },
      { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6, minBridge: "1000000" },
    ]
  }
};

async function main() {
  console.log("=".repeat(70));
  console.log("FULL RESCUE DEPLOYMENT");
  console.log("=".repeat(70));

  if (!PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY not set");
  }

  // Connect to Sonic for Hub deployment
  const sonicProvider = new ethers.providers.JsonRpcProvider(CHAINS.sonic.rpc);
  const sonicWallet = new ethers.Wallet(PRIVATE_KEY, sonicProvider);
  
  console.log(`\nWallet: ${sonicWallet.address}`);
  const sonicBalance = await sonicProvider.getBalance(sonicWallet.address);
  console.log(`Sonic Balance: ${ethers.utils.formatEther(sonicBalance)} S`);

  // Step 1: Deploy new Hub on Sonic
  console.log("\n" + "─".repeat(70));
  console.log("Step 1: Deploy New SyntheticTokenHub on Sonic");
  console.log("─".repeat(70));

  // Hub needs: endpoint, uniswapPermit2, uniswapRouter, weth
  const SONIC_UNISWAP_PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
  const SONIC_UNISWAP_ROUTER = "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD";
  const SONIC_WETH = "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38";

  const SyntheticTokenHub = await ethers.getContractFactory("SyntheticTokenHub", sonicWallet);
  
  console.log("Deploying SyntheticTokenHub...");
  console.log(`  Endpoint: ${CHAINS.sonic.endpoint}`);
  console.log(`  Permit2: ${SONIC_UNISWAP_PERMIT2}`);
  console.log(`  Router: ${SONIC_UNISWAP_ROUTER}`);
  console.log(`  WETH: ${SONIC_WETH}`);

  const hub = await SyntheticTokenHub.deploy(
    CHAINS.sonic.endpoint,
    sonicWallet.address,
    SONIC_UNISWAP_PERMIT2,
    SONIC_UNISWAP_ROUTER,
    SONIC_WETH,
    { gasLimit: 8000000 }
  );

  await hub.deployed();
  console.log(`\n✅ SyntheticTokenHub deployed at: ${hub.address}`);

  // Step 2: Deploy new Gateways on each chain
  console.log("\n" + "─".repeat(70));
  console.log("Step 2: Deploy New GatewayVaults");
  console.log("─".repeat(70));

  const newGateways: Record<string, string> = {};

  for (const [chainName, config] of Object.entries(CHAINS)) {
    if (chainName === 'sonic') continue; // Skip hub chain

    const chainConfig = config as any;
    console.log(`\nDeploying on ${chainName.toUpperCase()}...`);

    const provider = new ethers.providers.JsonRpcProvider(chainConfig.rpc);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const balance = await provider.getBalance(wallet.address);
    console.log(`  Balance: ${ethers.utils.formatEther(balance)} ETH`);

    const GatewayVault = await ethers.getContractFactory("GatewayVault", wallet);
    
    const gateway = await GatewayVault.deploy(
      chainConfig.endpoint,
      wallet.address,
      CHAINS.sonic.eid,
      { gasLimit: 5000000 }
    );

    await gateway.deployed();
    newGateways[chainName] = gateway.address;
    console.log(`  ✅ GatewayVault: ${gateway.address}`);

    // Set peer to Hub
    const hubPeerBytes32 = ethers.utils.hexZeroPad(hub.address, 32);
    const setPeerTx = await gateway.setPeer(CHAINS.sonic.eid, hubPeerBytes32, { gasLimit: 500000 });
    await setPeerTx.wait();
    console.log(`  ✅ Peer set to Hub`);
  }

  // Step 3: Set peers on Hub for each gateway
  console.log("\n" + "─".repeat(70));
  console.log("Step 3: Set Hub Peers");
  console.log("─".repeat(70));

  for (const [chainName, gatewayAddr] of Object.entries(newGateways)) {
    const chainConfig = (CHAINS as any)[chainName];
    const gatewayPeerBytes32 = ethers.utils.hexZeroPad(gatewayAddr, 32);
    
    console.log(`Setting peer for ${chainName} (EID: ${chainConfig.eid})...`);
    const tx = await hub.setPeer(chainConfig.eid, gatewayPeerBytes32, { gasLimit: 500000 });
    await tx.wait();
    console.log(`  ✅ Done`);
  }

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("DEPLOYMENT COMPLETE");
  console.log("=".repeat(70));
  console.log(`\nNew Hub: ${hub.address}`);
  console.log(`\nNew Gateways:`);
  for (const [chain, addr] of Object.entries(newGateways)) {
    console.log(`  ${chain}: ${addr}`);
  }

  console.log("\n" + "─".repeat(70));
  console.log("NEXT STEPS:");
  console.log("─".repeat(70));
  console.log(`
1. Create synthetic tokens on new Hub:
   hub.createSyntheticToken("sWETH", 18)
   hub.createSyntheticToken("sUSDC", 6)
   hub.createSyntheticToken("sUSDT", 6)
   hub.createSyntheticToken("sBTC", 8)

2. Link tokens on each gateway using linkTokenToHub()

3. Update frontend config with new addresses

4. Use adminRescueFromGateway to rescue tokens from OLD gateways:
   - Call from new Hub
   - Specify old gateway chain EID
   - Tokens will be released
`);
}

main().catch(console.error);


