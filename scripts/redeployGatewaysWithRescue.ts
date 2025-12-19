import { ethers } from "hardhat";

/**
 * This script redeploys GatewayVault contracts with the new rescueTokens function
 * on all gateway chains.
 * 
 * IMPORTANT: After running this, you need to:
 * 1. Update the Hub's peer mappings to point to new gateways
 * 2. Re-link tokens on the new gateways
 * 3. Update frontend config with new gateway addresses
 */

const RECIPIENT = "0x4151E05ABe56192e2A6775612C2020509Fd50637";
const HUB_EID = 30332; // Sonic LayerZero Endpoint ID

// Existing gateway configurations
const GATEWAYS = {
  arbitrum: {
    chainId: 42161,
    eid: 30110,
    oldGateway: "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e",
    endpoint: "0x1a44076050125825900e736c501f859c50fE728c", // LZ V2 endpoint
    rpc: "https://arb1.arbitrum.io/rpc",
    tokens: [
      { symbol: "WETH", address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", syntheticAddress: "0x5E501C482952c1F2D58a4294F9A97759968c5125", syntheticDecimals: 18, minBridge: "1000000000000000" }, // 0.001 WETH
      { symbol: "WBTC", address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", syntheticAddress: "0x1DeFDa524B2B5edB94299775B23d7E3dde1Fbb6C", syntheticDecimals: 8, minBridge: "10000" }, // 0.0001 WBTC
      { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", syntheticAddress: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B", syntheticDecimals: 6, minBridge: "1000000" }, // 1 USDC
      { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", syntheticAddress: "0x72dFC771E515423E5B0CD2acf703d0F7eb30bdEa", syntheticDecimals: 6, minBridge: "1000000" }, // 1 USDT
    ]
  },
  ethereum: {
    chainId: 1,
    eid: 30101,
    oldGateway: "0xba36FC6568B953f691dd20754607590C59b7646a",
    endpoint: "0x1a44076050125825900e736c501f859c50fE728c",
    rpc: "https://ethereum-rpc.publicnode.com",
    tokens: [
      { symbol: "WETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", syntheticAddress: "0x5E501C482952c1F2D58a4294F9A97759968c5125", syntheticDecimals: 18, minBridge: "1000000000000000" },
      { symbol: "WBTC", address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", syntheticAddress: "0x1DeFDa524B2B5edB94299775B23d7E3dde1Fbb6C", syntheticDecimals: 8, minBridge: "10000" },
      { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", syntheticAddress: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B", syntheticDecimals: 6, minBridge: "1000000" },
      { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", syntheticAddress: "0x72dFC771E515423E5B0CD2acf703d0F7eb30bdEa", syntheticDecimals: 6, minBridge: "1000000" },
    ]
  },
  base: {
    chainId: 8453,
    eid: 30184,
    oldGateway: "0xB712543E7fB87C411AAbB10c6823cf39bbEBB4Bb",
    endpoint: "0x1a44076050125825900e736c501f859c50fE728c",
    rpc: "https://mainnet.base.org",
    tokens: [
      { symbol: "WETH", address: "0x4200000000000000000000000000000000000006", syntheticAddress: "0x5E501C482952c1F2D58a4294F9A97759968c5125", syntheticDecimals: 18, minBridge: "1000000000000000" },
      { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", syntheticAddress: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B", syntheticDecimals: 6, minBridge: "1000000" },
    ]
  }
};

async function main() {
  console.log("=".repeat(60));
  console.log("Gateway Redeployment Script (with rescueTokens function)");
  console.log("=".repeat(60));

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY not set");
  }

  const newGateways: Record<string, string> = {};

  for (const [chainName, config] of Object.entries(GATEWAYS)) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Deploying on ${chainName.toUpperCase()}`);
    console.log("=".repeat(60));

    const provider = new ethers.JsonRpcProvider(config.rpc);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log(`Wallet: ${wallet.address}`);
    const balance = await provider.getBalance(wallet.address);
    console.log(`Balance: ${ethers.formatEther(balance)} ETH`);

    // Get contract factory
    const GatewayVault = await ethers.getContractFactory("GatewayVault", wallet);
    
    console.log(`\nDeploying GatewayVault...`);
    console.log(`  Endpoint: ${config.endpoint}`);
    console.log(`  Owner: ${wallet.address}`);
    console.log(`  Hub EID: ${HUB_EID}`);

    try {
      const gateway = await GatewayVault.deploy(
        config.endpoint,
        wallet.address,
        HUB_EID
      );
      
      await gateway.waitForDeployment();
      const gatewayAddress = await gateway.getAddress();
      
      console.log(`\n✅ GatewayVault deployed at: ${gatewayAddress}`);
      newGateways[chainName] = gatewayAddress;

      // Set up peer (Hub)
      console.log(`\nSetting peer to Hub (EID: ${HUB_EID})...`);
      // Note: You'll need to update Hub's peer as well
      
    } catch (e: any) {
      console.log(`\n❌ Error deploying on ${chainName}:`, e.message);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  
  for (const [chain, address] of Object.entries(newGateways)) {
    console.log(`${chain}: ${address}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("NEXT STEPS:");
  console.log("=".repeat(60));
  console.log("1. Update Hub's peer mappings for each new gateway");
  console.log("2. Link tokens on each new gateway using linkTokenToHub()");
  console.log("3. Update frontend config with new gateway addresses");
  console.log("4. Run rescueTokens on new gateways once tokens are bridged");
}

main().catch(console.error);

