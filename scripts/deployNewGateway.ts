import hardhat, { ethers } from "hardhat";
import { Options } from "@layerzerolabs/lz-v2-utilities";

/**
 * Deploy new GatewayVault and link tokens with CORRECT synthetic addresses
 */

const LZ_GAS_LIMIT = 500000;

// Existing Hub on Sonic
const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const SONIC_EID = 30332;

// Synthetic token addresses on Sonic (from setupSyntheticTokens.ts output)
const SYNTHETIC_TOKENS = {
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  sUSDT: "0x72dFC771E515423E5B0CD2acf703d0F7eb30bdEa",
  sUSDC: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B",
};

// LayerZero endpoints
const LZ_ENDPOINTS: Record<string, string> = {
  arbitrum: "0x1a44076050125825900e736c501f859c50fE728c",
  base: "0x1a44076050125825900e736c501f859c50fE728c",
  ethereum: "0x1a44076050125825900e736c501f859c50fE728c",
};

// Chain EIDs
const CHAIN_EIDS: Record<string, number> = {
  arbitrum: 30110,
  base: 30184,
  ethereum: 30101,
};

// Token configs per chain
const TOKEN_CONFIGS: Record<string, Array<{
  symbol: string;
  address: string;
  decimals: number;
  syntheticSymbol: keyof typeof SYNTHETIC_TOKENS;
}>> = {
  arbitrum: [
    { symbol: "WETH", address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", decimals: 18, syntheticSymbol: "sWETH" },
    { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6, syntheticSymbol: "sUSDT" },
    { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6, syntheticSymbol: "sUSDC" },
  ],
  base: [
    { symbol: "WETH", address: "0x4200000000000000000000000000000000000006", decimals: 18, syntheticSymbol: "sWETH" },
    { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6, syntheticSymbol: "sUSDC" },
  ],
  ethereum: [
    { symbol: "WETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18, syntheticSymbol: "sWETH" },
    { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6, syntheticSymbol: "sUSDT" },
    { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6, syntheticSymbol: "sUSDC" },
  ],
};

// Synthetic decimals
const SYNTHETIC_DECIMALS: Record<keyof typeof SYNTHETIC_TOKENS, number> = {
  sWETH: 18,
  sUSDT: 6,
  sUSDC: 6,
};

function addressToBytes32(addr: string): string {
  return ethers.utils.hexZeroPad(addr, 32).toLowerCase();
}

async function main() {
  const network = hardhat.network.name;
  
  if (!TOKEN_CONFIGS[network]) {
    console.log(`Network ${network} not configured. Run this on: arbitrum, base, or ethereum`);
    return;
  }

  const [deployer] = await ethers.getSigners();
  
  console.log(`\n========================================`);
  console.log(`Deploying New GatewayVault on ${network.toUpperCase()}`);
  console.log(`========================================`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH`);

  const lzEndpoint = LZ_ENDPOINTS[network];
  
  // 1. Deploy new Gateway
  console.log("\n--- Step 1: Deploying new GatewayVault ---");
  const GatewayVault = await ethers.getContractFactory("GatewayVault");
  const newGateway = await GatewayVault.deploy(
    lzEndpoint,
    deployer.address, // owner
    SONIC_EID         // destination EID (Sonic)
  );
  await newGateway.deployed();
  console.log(`New Gateway deployed at: ${newGateway.address}`);

  // 2. Set peer to Hub
  console.log("\n--- Step 2: Setting peer to Hub ---");
  const setPeerTx = await newGateway.setPeer(SONIC_EID, addressToBytes32(HUB_ADDRESS));
  await setPeerTx.wait();
  console.log(`Peer set to Sonic Hub: ${HUB_ADDRESS}`);

  // 3. Link tokens with CORRECT synthetic addresses
  console.log("\n--- Step 3: Linking tokens with correct synthetic addresses ---");
  
  const tokens = TOKEN_CONFIGS[network];
  const lzOptions = Options.newOptions().addExecutorLzReceiveOption(LZ_GAS_LIMIT, 0).toHex().toString();
  
  for (const token of tokens) {
    const syntheticAddress = SYNTHETIC_TOKENS[token.syntheticSymbol];
    const syntheticDecimals = SYNTHETIC_DECIMALS[token.syntheticSymbol];
    
    console.log(`\n${token.symbol}:`);
    console.log(`  Remote: ${token.address}`);
    console.log(`  Synthetic: ${syntheticAddress} (${token.syntheticSymbol})`);
    
    const tokenConfig = [{
      onPause: false,
      tokenAddress: token.address,
      syntheticTokenDecimals: syntheticDecimals,
      syntheticTokenAddress: syntheticAddress, // <-- CORRECT ADDRESS!
      minBridgeAmt: token.decimals === 18 
        ? ethers.utils.parseEther("0.001") 
        : ethers.utils.parseUnits("1", token.decimals),
    }];

    try {
      // Quote fee
      const fee = await newGateway.quoteLinkTokenToHub(tokenConfig, lzOptions);
      console.log(`  Fee: ${ethers.utils.formatEther(fee)} ETH`);
      
      // Execute
      const tx = await newGateway.linkTokenToHub(tokenConfig, lzOptions, {
        value: fee.mul(150).div(100), // 50% buffer
        gasLimit: 600000,
      });
      console.log(`  TX: ${tx.hash}`);
      await tx.wait();
      console.log(`  ✓ Link message sent!`);
    } catch (e: any) {
      console.log(`  ✗ Failed: ${e.message?.slice(0, 100)}`);
    }
  }

  // Summary
  console.log("\n========================================");
  console.log("DEPLOYMENT COMPLETE!");
  console.log("========================================");
  console.log(`\nNew Gateway: ${newGateway.address}`);
  console.log(`\nNEXT STEPS:`);
  console.log(`1. Update Hub peer to accept messages from new Gateway`);
  console.log(`   Run on Sonic: hub.setPeer(${CHAIN_EIDS[network]}, "${addressToBytes32(newGateway.address)}")`);
  console.log(`2. Update frontend config with new Gateway address`);
  console.log(`3. Configure LayerZero OApp for new Gateway`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


