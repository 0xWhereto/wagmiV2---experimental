import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

/**
 * Debug bridge issues - check actual minBridgeAmt values and test with USDC/USDT
 */

const CHAINS = {
  arbitrum: {
    name: "Arbitrum",
    chainId: 42161,
    eid: 30110,
    rpc: "https://arb1.arbitrum.io/rpc",
    gateway: "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e",
    tokens: {
      WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
      USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    }
  },
  base: {
    name: "Base",
    chainId: 8453,
    eid: 30184,
    rpc: "https://mainnet.base.org",
    gateway: "0xB712543E7fB87C411AAbB10c6823cf39bbEBB4Bb",
    tokens: {
      WETH: "0x4200000000000000000000000000000000000006",
      USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    }
  },
  ethereum: {
    name: "Ethereum",
    chainId: 1,
    eid: 30101,
    rpc: "https://ethereum-rpc.publicnode.com",
    gateway: "0xba36FC6568B953f691dd20754607590C59b7646a",
    tokens: {
      WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    }
  }
};

const GATEWAY_ABI = [
  "function deposit(address _recepient, tuple(address tokenAddress, uint256 tokenAmount)[] _assets, bytes _options) external payable returns (tuple(bytes32 guid, uint64 nonce, tuple(uint256 nativeFee, uint256 lzTokenFee) fee))",
  "function quoteDeposit(address _recepient, tuple(address tokenAddress, uint256 tokenAmount)[] _assets, bytes _options) view returns (uint256)",
  "function getTokenIndex(address _tokenAddress) view returns (uint256)",
  "function availableTokens(uint256) view returns (tuple(address tokenAddress, address syntheticTokenAddress, int8 decimalsDelta, uint256 minBridgeAmt, bool onPause))",
  "function getAllAvailableTokens() view returns (tuple(bool onPause, int8 decimalsDelta, address syntheticTokenAddress, address tokenAddress, uint8 tokenDecimals, string tokenSymbol, uint256 tokenBalance)[])",
  "function getAvailableTokenLength() view returns (uint256)",
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function approve(address, uint256) returns (bool)",
  "function allowance(address, address) view returns (uint256)",
];

function buildLzOptions(gasLimit: number = 1500000): string {
  const gasHex = BigInt(gasLimit).toString(16).padStart(32, '0');
  return `0x000301001101${gasHex}`;
}

async function debugChain(chainName: string, chainConfig: typeof CHAINS.arbitrum) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`DEBUGGING ${chainConfig.name}`);
  console.log("=".repeat(60));
  
  const provider = new ethers.providers.JsonRpcProvider(chainConfig.rpc);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  const gateway = new ethers.Contract(chainConfig.gateway, GATEWAY_ABI, wallet);

  // Check raw availableTokens array
  console.log(`\n--- Raw availableTokens Array ---`);
  const tokenCount = await gateway.getAvailableTokenLength();
  console.log(`Total tokens: ${tokenCount.toString()}`);
  
  for (let i = 0; i < tokenCount.toNumber(); i++) {
    const rawToken = await gateway.availableTokens(i);
    console.log(`\nToken ${i}:`);
    console.log(`  tokenAddress: ${rawToken.tokenAddress}`);
    console.log(`  syntheticTokenAddress: ${rawToken.syntheticTokenAddress}`);
    console.log(`  decimalsDelta: ${rawToken.decimalsDelta}`);
    console.log(`  minBridgeAmt (raw): ${rawToken.minBridgeAmt.toString()}`);
    console.log(`  onPause: ${rawToken.onPause}`);
    
    // Get token decimals to format the amount
    try {
      const token = new ethers.Contract(rawToken.tokenAddress, ERC20_ABI, provider);
      const decimals = await token.decimals();
      const symbol = await token.symbol();
      console.log(`  minBridgeAmt (formatted): ${ethers.utils.formatUnits(rawToken.minBridgeAmt, decimals)} ${symbol}`);
    } catch (e) {
      console.log(`  Could not get token details`);
    }
  }

  // Now try quotes with different amounts for each token
  console.log(`\n--- Testing Quotes ---`);
  const lzOptions = buildLzOptions(1500000);

  for (const [symbol, address] of Object.entries(chainConfig.tokens)) {
    console.log(`\n${symbol}:`);
    
    try {
      const token = new ethers.Contract(address, ERC20_ABI, provider);
      const decimals = await token.decimals();
      const balance = await token.balanceOf(wallet.address);
      console.log(`  Your balance: ${ethers.utils.formatUnits(balance, decimals)}`);
      
      if (balance.isZero()) {
        console.log(`  Skipping - no balance`);
        continue;
      }
      
      // Try to get token index
      try {
        const index = await gateway.getTokenIndex(address);
        const tokenInfo = await gateway.availableTokens(index);
        console.log(`  Gateway index: ${index.toString()}`);
        console.log(`  Min bridge (raw): ${tokenInfo.minBridgeAmt.toString()}`);
        console.log(`  Min bridge (formatted): ${ethers.utils.formatUnits(tokenInfo.minBridgeAmt, decimals)}`);
        console.log(`  Paused: ${tokenInfo.onPause}`);
        
        // Try different amounts
        const testAmounts = [
          ethers.utils.parseUnits("0.0001", decimals),
          ethers.utils.parseUnits("0.001", decimals),
          ethers.utils.parseUnits("0.01", decimals),
          ethers.utils.parseUnits("1", decimals),
          ethers.utils.parseUnits("2", decimals),
        ];
        
        for (const amt of testAmounts) {
          if (amt.gt(balance)) continue;
          
          const assets = [{ tokenAddress: address, tokenAmount: amt }];
          try {
            const quote = await gateway.quoteDeposit(wallet.address, assets, lzOptions);
            console.log(`  ✅ Quote OK for ${ethers.utils.formatUnits(amt, decimals)} ${symbol}: ${ethers.utils.formatEther(quote)} ETH`);
            break; // Found working amount
          } catch (e: any) {
            console.log(`  ❌ ${ethers.utils.formatUnits(amt, decimals)}: ${e.reason || e.message?.slice(0, 60)}`);
          }
        }
      } catch (e: any) {
        console.log(`  Token not linked to gateway: ${e.message?.slice(0, 50)}`);
      }
    } catch (e: any) {
      console.log(`  Error: ${e.message?.slice(0, 100)}`);
    }
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("DEBUG BRIDGE ISSUES");
  console.log("=".repeat(60));
  
  if (!process.env.PRIVATE_KEY) {
    console.log("❌ PRIVATE_KEY not found in .env");
    return;
  }

  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
  console.log(`Wallet: ${wallet.address}`);

  for (const [chainName, chainConfig] of Object.entries(CHAINS)) {
    await debugChain(chainName, chainConfig);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


