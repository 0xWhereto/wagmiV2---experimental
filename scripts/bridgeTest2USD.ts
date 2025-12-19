import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

/**
 * Bridge $2 worth from all chains to Sonic Hub
 * Uses USDC/USDT since WETH has higher minimum (~0.001 ETH = $3.50)
 */

const CHAINS = {
  arbitrum: {
    name: "Arbitrum",
    rpc: "https://arb1.arbitrum.io/rpc",
    gateway: "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e",
    preferredToken: "USDC",
    tokens: {
      USDC: { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
      USDT: { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
    }
  },
  base: {
    name: "Base",
    rpc: "https://mainnet.base.org",
    gateway: "0xB712543E7fB87C411AAbB10c6823cf39bbEBB4Bb",
    preferredToken: "USDC",
    tokens: {
      USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
    }
  },
  ethereum: {
    name: "Ethereum",
    rpc: "https://ethereum-rpc.publicnode.com",
    gateway: "0xba36FC6568B953f691dd20754607590C59b7646a",
    preferredToken: "USDT",
    tokens: {
      USDT: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
      USDC: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
    }
  }
};

const GATEWAY_ABI = [
  "function deposit(address _recepient, tuple(address tokenAddress, uint256 tokenAmount)[] _assets, bytes _options) external payable returns (tuple(bytes32 guid, uint64 nonce, tuple(uint256 nativeFee, uint256 lzTokenFee) fee))",
  "function quoteDeposit(address _recepient, tuple(address tokenAddress, uint256 tokenAmount)[] _assets, bytes _options) view returns (uint256)",
  "function getTokenIndex(address _tokenAddress) view returns (uint256)",
  "function availableTokens(uint256) view returns (bool onPause, address tokenAddress, address syntheticTokenAddress, int8 decimalsDelta, uint256 minBridgeAmt)",
  "function getAllAvailableTokens() view returns (tuple(bool onPause, int8 decimalsDelta, address syntheticTokenAddress, address tokenAddress, uint8 tokenDecimals, string tokenSymbol, uint256 tokenBalance)[])",
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

async function bridgeFromChain(chainName: string, chainConfig: typeof CHAINS.arbitrum) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`BRIDGING FROM ${chainConfig.name}`);
  console.log("=".repeat(60));
  
  const provider = new ethers.providers.JsonRpcProvider(chainConfig.rpc);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  console.log(`Wallet: ${wallet.address}`);
  
  // Check native balance for gas
  const nativeBalance = await provider.getBalance(wallet.address);
  console.log(`Native balance: ${ethers.utils.formatEther(nativeBalance)} ETH`);
  
  if (nativeBalance.lt(ethers.utils.parseEther("0.001"))) {
    console.log(`❌ Insufficient gas! Need at least 0.001 ETH`);
    return { chain: chainName, status: "NO_GAS" };
  }

  const gateway = new ethers.Contract(chainConfig.gateway, GATEWAY_ABI, wallet);
  const lzOptions = buildLzOptions(1500000);

  // Find the best token to bridge (prefer the one we have most of)
  let bestToken: { symbol: string; address: string; decimals: number; balance: any } | null = null;
  
  for (const [symbol, tokenInfo] of Object.entries(chainConfig.tokens)) {
    const token = new ethers.Contract(tokenInfo.address, ERC20_ABI, provider);
    const balance = await token.balanceOf(wallet.address);
    console.log(`${symbol} balance: ${ethers.utils.formatUnits(balance, tokenInfo.decimals)}`);
    
    // Check if linked to gateway
    try {
      await gateway.getTokenIndex(tokenInfo.address);
      // Need at least $2 worth (2 tokens for stables)
      if (balance.gte(ethers.utils.parseUnits("2", tokenInfo.decimals))) {
        if (!bestToken || balance.gt(bestToken.balance)) {
          bestToken = { symbol, ...tokenInfo, balance };
        }
      }
    } catch (e) {
      console.log(`  ${symbol} not linked to gateway`);
    }
  }

  if (!bestToken) {
    console.log(`❌ No suitable token with >= $2 balance`);
    return { chain: chainName, status: "NO_BALANCE" };
  }

  console.log(`\nUsing ${bestToken.symbol} (balance: ${ethers.utils.formatUnits(bestToken.balance, bestToken.decimals)})`);

  // Bridge exactly $2 worth
  const bridgeAmount = ethers.utils.parseUnits("2", bestToken.decimals);
  console.log(`Amount to bridge: ${ethers.utils.formatUnits(bridgeAmount, bestToken.decimals)} ${bestToken.symbol}`);

  const assets = [{ tokenAddress: bestToken.address, tokenAmount: bridgeAmount }];

  // Get quote
  let quote;
  try {
    quote = await gateway.quoteDeposit(wallet.address, assets, lzOptions);
    console.log(`LayerZero fee: ${ethers.utils.formatEther(quote)} ETH`);
  } catch (e: any) {
    console.log(`❌ Quote failed: ${e.reason || e.message?.slice(0, 100)}`);
    return { chain: chainName, status: "QUOTE_FAILED", error: e.reason || e.message };
  }

  // Check and handle approval
  const token = new ethers.Contract(bestToken.address, ERC20_ABI, wallet);
  const allowance = await token.allowance(wallet.address, chainConfig.gateway);
  console.log(`Current allowance: ${ethers.utils.formatUnits(allowance, bestToken.decimals)}`);

  if (allowance.lt(bridgeAmount)) {
    console.log(`Approving ${bestToken.symbol}...`);
    
    // USDT on Ethereum requires setting to 0 first
    if (chainName === "ethereum" && bestToken.symbol === "USDT" && allowance.gt(0)) {
      console.log(`  Setting USDT allowance to 0 first (required by USDT)...`);
      try {
        const zeroTx = await token.approve(chainConfig.gateway, 0, { gasLimit: 100000 });
        await zeroTx.wait();
        console.log(`  ✅ Zeroed allowance`);
      } catch (e: any) {
        console.log(`  ❌ Failed to zero allowance: ${e.reason || e.message?.slice(0, 100)}`);
        return { chain: chainName, status: "APPROVE_FAILED" };
      }
    }

    try {
      const approveTx = await token.approve(chainConfig.gateway, bridgeAmount, { gasLimit: 100000 });
      console.log(`  Approval TX: ${approveTx.hash}`);
      await approveTx.wait();
      console.log(`  ✅ Approved`);
    } catch (e: any) {
      console.log(`  ❌ Approval failed: ${e.reason || e.message?.slice(0, 100)}`);
      return { chain: chainName, status: "APPROVE_FAILED", error: e.reason || e.message };
    }
  }

  // Execute bridge
  console.log(`\nExecuting bridge...`);
  try {
    const tx = await gateway.deposit(wallet.address, assets, lzOptions, { 
      value: quote,
      gasLimit: 500000 
    });
    console.log(`Bridge TX: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ SUCCESS! Gas used: ${receipt.gasUsed.toString()}`);
    
    // Parse events
    for (const log of receipt.logs) {
      try {
        const parsed = gateway.interface.parseLog(log);
        if (parsed.name === "MessageSent") {
          console.log(`\n📤 LayerZero Message Sent:`);
          console.log(`   GUID: ${parsed.args.guid}`);
          console.log(`   From: ${parsed.args.from}`);
          console.log(`   To: ${parsed.args.to}`);
        }
      } catch (e) {}
    }
    
    return { 
      chain: chainName, 
      status: "SUCCESS",
      txHash: tx.hash,
      amount: `${ethers.utils.formatUnits(bridgeAmount, bestToken.decimals)} ${bestToken.symbol}`
    };
  } catch (e: any) {
    console.log(`❌ Bridge failed: ${e.reason || e.message?.slice(0, 200)}`);
    
    // Try to decode revert reason
    if (e.error?.data) {
      console.log(`Error data: ${e.error.data}`);
    }
    
    return { chain: chainName, status: "TX_FAILED", error: e.reason || e.message?.slice(0, 100) };
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("WAGMI BRIDGE TEST - $2 from all chains to Sonic Hub");
  console.log("=".repeat(60));
  
  if (!process.env.PRIVATE_KEY) {
    console.log("❌ PRIVATE_KEY not found in .env");
    return;
  }

  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
  console.log(`Testing wallet: ${wallet.address}\n`);

  const results: any[] = [];

  for (const [chainName, chainConfig] of Object.entries(CHAINS)) {
    try {
      const result = await bridgeFromChain(chainName, chainConfig);
      results.push(result);
    } catch (e: any) {
      console.log(`\n❌ Error on ${chainName}: ${e.message?.slice(0, 200)}`);
      results.push({ chain: chainName, status: "ERROR", error: e.message?.slice(0, 100) });
    }
  }

  // Summary
  console.log(`\n\n${"=".repeat(60)}`);
  console.log("FINAL SUMMARY");
  console.log("=".repeat(60));
  
  for (const result of results) {
    console.log(`\n${result.chain.toUpperCase()}: ${result.status}`);
    if (result.txHash) console.log(`  TX: ${result.txHash}`);
    if (result.amount) console.log(`  Amount: ${result.amount}`);
    if (result.error) console.log(`  Error: ${result.error}`);
  }

  const successCount = results.filter(r => r.status === "SUCCESS").length;
  console.log(`\n✅ Successful bridges: ${successCount}/${results.length}`);
  
  if (successCount > 0) {
    console.log(`\n📌 Track LayerZero messages at: https://layerzeroscan.com`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

