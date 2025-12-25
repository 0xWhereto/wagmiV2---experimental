import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

/**
 * Test bridging from all source chains to Sonic Hub
 * Max value: ~$2 USD
 */

// Chain configurations
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

// Hub configuration
const HUB = {
  name: "Sonic",
  chainId: 146,
  eid: 30332,
  rpc: "https://rpc.soniclabs.com",
  hub: "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd",
  getters: "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e",
};

// ABIs
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function approve(address, uint256) returns (bool)",
  "function allowance(address, address) view returns (uint256)",
];

const GATEWAY_ABI = [
  "function deposit(address _recepient, tuple(address tokenAddress, uint256 tokenAmount)[] _assets, bytes _options) external payable returns (tuple(bytes32 guid, uint64 nonce, tuple(uint256 nativeFee, uint256 lzTokenFee) fee))",
  "function quoteDeposit(address _recepient, tuple(address tokenAddress, uint256 tokenAmount)[] _assets, bytes _options) view returns (uint256)",
  "function getTokenIndex(address _tokenAddress) view returns (uint256)",
  "function availableTokens(uint256) view returns (tuple(address tokenAddress, address syntheticTokenAddress, int8 decimalsDelta, uint256 minBridgeAmt, bool onPause))",
  "function getAllAvailableTokens() view returns (tuple(bool onPause, int8 decimalsDelta, address syntheticTokenAddress, address tokenAddress, uint8 tokenDecimals, string tokenSymbol, uint256 tokenBalance)[])",
  "function peers(uint32) view returns (bytes32)",
  "function DST_EID() view returns (uint32)",
];

// Build LZ options for gas
function buildLzOptions(gasLimit: number = 1500000): string {
  const gasHex = BigInt(gasLimit).toString(16).padStart(32, '0');
  return `0x000301001101${gasHex}`;
}

async function checkChain(chainName: string, chainConfig: typeof CHAINS.arbitrum) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Checking ${chainConfig.name} (Chain ID: ${chainConfig.chainId})`);
  console.log("=".repeat(60));
  
  const provider = new ethers.providers.JsonRpcProvider(chainConfig.rpc);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  
  console.log(`\nWallet: ${wallet.address}`);
  
  // Check native balance
  const nativeBalance = await provider.getBalance(wallet.address);
  console.log(`Native Balance: ${ethers.utils.formatEther(nativeBalance)} ETH`);
  
  if (nativeBalance.lt(ethers.utils.parseEther("0.001"))) {
    console.log(`❌ Insufficient native balance for gas!`);
    return { chain: chainName, status: "NO_GAS", error: "Insufficient native balance" };
  }

  // Check gateway contract
  const gatewayCode = await provider.getCode(chainConfig.gateway);
  if (gatewayCode === "0x") {
    console.log(`❌ Gateway contract not deployed at ${chainConfig.gateway}`);
    return { chain: chainName, status: "NO_GATEWAY", error: "Gateway not deployed" };
  }
  console.log(`✅ Gateway deployed: ${chainConfig.gateway}`);

  const gateway = new ethers.Contract(chainConfig.gateway, GATEWAY_ABI, wallet);

  // Check gateway peer configuration
  try {
    const dstEid = await gateway.DST_EID();
    console.log(`Gateway DST_EID: ${dstEid}`);
    
    const peer = await gateway.peers(HUB.eid);
    if (peer === ethers.constants.HashZero) {
      console.log(`❌ Gateway peer not set for Hub (EID ${HUB.eid})`);
      return { chain: chainName, status: "NO_PEER", error: "Peer not configured" };
    }
    console.log(`✅ Peer configured: ${peer}`);
  } catch (e: any) {
    console.log(`⚠️ Could not check peer: ${e.message?.slice(0, 100)}`);
  }

  // Check available tokens on gateway
  console.log(`\n--- Available Tokens on Gateway ---`);
  let availableTokens: any[] = [];
  try {
    availableTokens = await gateway.getAllAvailableTokens();
    if (availableTokens.length === 0) {
      console.log(`❌ No tokens linked to gateway!`);
      return { chain: chainName, status: "NO_TOKENS", error: "No tokens linked" };
    }
    
    for (const token of availableTokens) {
      console.log(`  ${token.tokenSymbol}: ${token.tokenAddress}`);
      console.log(`    - Paused: ${token.onPause}`);
      console.log(`    - Min Bridge: ${ethers.utils.formatUnits(token.minBridgeAmt || 0, token.tokenDecimals)} ${token.tokenSymbol}`);
      console.log(`    - Gateway Balance: ${ethers.utils.formatUnits(token.tokenBalance, token.tokenDecimals)} ${token.tokenSymbol}`);
    }
  } catch (e: any) {
    console.log(`⚠️ Could not fetch available tokens: ${e.message?.slice(0, 100)}`);
  }

  // Check token balances
  console.log(`\n--- Your Token Balances ---`);
  const tokenBalances: {token: string, balance: any, decimals: number, address: string}[] = [];
  
  for (const [symbol, address] of Object.entries(chainConfig.tokens)) {
    try {
      const token = new ethers.Contract(address, ERC20_ABI, provider);
      const balance = await token.balanceOf(wallet.address);
      const decimals = await token.decimals();
      console.log(`  ${symbol}: ${ethers.utils.formatUnits(balance, decimals)}`);
      tokenBalances.push({ token: symbol, balance, decimals, address });
    } catch (e: any) {
      console.log(`  ${symbol}: Error fetching - ${e.message?.slice(0, 50)}`);
    }
  }

  // Find a token with balance that's linked to the gateway
  const linkedToken = availableTokens.find(t => {
    const ourToken = tokenBalances.find(tb => tb.address.toLowerCase() === t.tokenAddress.toLowerCase());
    return ourToken && ourToken.balance.gt(0) && !t.onPause;
  });

  if (!linkedToken) {
    console.log(`\n❌ No usable tokens found (either no balance or tokens are paused)`);
    return { chain: chainName, status: "NO_BALANCE", error: "No tokens with balance" };
  }

  console.log(`\n✅ Can bridge ${linkedToken.tokenSymbol} on ${chainConfig.name}`);
  
  // Try to get a quote
  console.log(`\n--- Testing Bridge Quote ---`);
  const ourToken = tokenBalances.find(tb => tb.address.toLowerCase() === linkedToken.tokenAddress.toLowerCase())!;
  
  // Calculate $2 worth (rough estimate)
  // WETH ~$3500, USDC/USDT = $1
  let bridgeAmount;
  if (linkedToken.tokenSymbol === "WETH") {
    bridgeAmount = ethers.utils.parseUnits("0.0006", 18); // ~$2 at $3500/ETH
  } else {
    bridgeAmount = ethers.utils.parseUnits("2", linkedToken.tokenDecimals); // $2 for stables
  }

  // Check if we have enough
  if (ourToken.balance.lt(bridgeAmount)) {
    bridgeAmount = ourToken.balance.div(2); // Use half of what we have
  }

  // Check minimum bridge amount
  const minBridge = linkedToken.minBridgeAmt || ethers.BigNumber.from(0);
  if (bridgeAmount.lt(minBridge)) {
    console.log(`❌ Amount ${ethers.utils.formatUnits(bridgeAmount, linkedToken.tokenDecimals)} is below minimum ${ethers.utils.formatUnits(minBridge, linkedToken.tokenDecimals)}`);
    return { chain: chainName, status: "BELOW_MIN", error: "Amount below minimum" };
  }

  console.log(`Attempting to bridge: ${ethers.utils.formatUnits(bridgeAmount, linkedToken.tokenDecimals)} ${linkedToken.tokenSymbol}`);

  const assets = [{
    tokenAddress: linkedToken.tokenAddress,
    tokenAmount: bridgeAmount
  }];
  
  const lzOptions = buildLzOptions(1500000);
  
  try {
    const quote = await gateway.quoteDeposit(wallet.address, assets, lzOptions);
    console.log(`✅ Quote successful: ${ethers.utils.formatEther(quote)} ETH for LZ fee`);
    
    // Check allowance
    const token = new ethers.Contract(linkedToken.tokenAddress, ERC20_ABI, wallet);
    const allowance = await token.allowance(wallet.address, chainConfig.gateway);
    console.log(`Current allowance: ${ethers.utils.formatUnits(allowance, linkedToken.tokenDecimals)}`);
    
    if (allowance.lt(bridgeAmount)) {
      console.log(`⚠️ Need to approve tokens before bridging`);
    }

    return { 
      chain: chainName, 
      status: "READY", 
      token: linkedToken.tokenSymbol,
      amount: ethers.utils.formatUnits(bridgeAmount, linkedToken.tokenDecimals),
      quoteFee: ethers.utils.formatEther(quote),
      needsApproval: allowance.lt(bridgeAmount)
    };
  } catch (e: any) {
    console.log(`❌ Quote failed: ${e.reason || e.message?.slice(0, 200)}`);
    
    // Try to decode the error
    if (e.error?.data) {
      console.log(`Error data: ${e.error.data}`);
    }
    
    return { chain: chainName, status: "QUOTE_FAILED", error: e.reason || e.message?.slice(0, 100) };
  }
}

async function attemptBridge(chainName: string, chainConfig: typeof CHAINS.arbitrum, tokenSymbol: string, amount: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`BRIDGING from ${chainConfig.name}`);
  console.log("=".repeat(60));

  const provider = new ethers.providers.JsonRpcProvider(chainConfig.rpc);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  const gateway = new ethers.Contract(chainConfig.gateway, GATEWAY_ABI, wallet);

  // Find the token
  const availableTokens = await gateway.getAllAvailableTokens();
  const linkedToken = availableTokens.find((t: any) => t.tokenSymbol === tokenSymbol);
  
  if (!linkedToken) {
    console.log(`❌ Token ${tokenSymbol} not found on ${chainName}`);
    return false;
  }

  const bridgeAmount = ethers.utils.parseUnits(amount, linkedToken.tokenDecimals);
  const token = new ethers.Contract(linkedToken.tokenAddress, ERC20_ABI, wallet);

  // Approve if needed
  const allowance = await token.allowance(wallet.address, chainConfig.gateway);
  if (allowance.lt(bridgeAmount)) {
    console.log(`Approving ${amount} ${tokenSymbol}...`);
    const approveTx = await token.approve(chainConfig.gateway, bridgeAmount);
    await approveTx.wait();
    console.log(`✅ Approved`);
  }

  const assets = [{
    tokenAddress: linkedToken.tokenAddress,
    tokenAmount: bridgeAmount
  }];
  
  const lzOptions = buildLzOptions(1500000);
  
  // Get quote
  const quote = await gateway.quoteDeposit(wallet.address, assets, lzOptions);
  console.log(`LZ Fee: ${ethers.utils.formatEther(quote)} ETH`);

  // Execute bridge
  console.log(`Executing bridge...`);
  try {
    const tx = await gateway.deposit(wallet.address, assets, lzOptions, { value: quote });
    console.log(`TX Hash: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ Bridge transaction confirmed! Gas used: ${receipt.gasUsed.toString()}`);
    return true;
  } catch (e: any) {
    console.log(`❌ Bridge failed: ${e.reason || e.message?.slice(0, 200)}`);
    return false;
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("WAGMI Bridge Test - All Chains to Sonic Hub");
  console.log("=".repeat(60));
  
  if (!process.env.PRIVATE_KEY) {
    console.log("❌ PRIVATE_KEY not found in .env");
    return;
  }

  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
  console.log(`\nTesting wallet: ${wallet.address}`);

  // Check Hub first
  console.log(`\n--- Checking Hub (Sonic) ---`);
  const hubProvider = new ethers.providers.JsonRpcProvider(HUB.rpc);
  const hubCode = await hubProvider.getCode(HUB.hub);
  if (hubCode === "0x") {
    console.log(`❌ Hub not deployed at ${HUB.hub}`);
    return;
  }
  console.log(`✅ Hub deployed at ${HUB.hub}`);

  // Check all source chains
  const results: any[] = [];
  for (const [chainName, chainConfig] of Object.entries(CHAINS)) {
    try {
      const result = await checkChain(chainName, chainConfig);
      results.push(result);
    } catch (e: any) {
      console.log(`\n❌ Error checking ${chainName}: ${e.message?.slice(0, 200)}`);
      results.push({ chain: chainName, status: "ERROR", error: e.message?.slice(0, 100) });
    }
  }

  // Summary
  console.log(`\n\n${"=".repeat(60)}`);
  console.log("SUMMARY");
  console.log("=".repeat(60));
  
  for (const result of results) {
    console.log(`\n${result.chain.toUpperCase()}:`);
    console.log(`  Status: ${result.status}`);
    if (result.error) console.log(`  Error: ${result.error}`);
    if (result.token) console.log(`  Ready Token: ${result.token}`);
    if (result.amount) console.log(`  Bridge Amount: ${result.amount}`);
    if (result.quoteFee) console.log(`  LZ Fee: ${result.quoteFee} ETH`);
    if (result.needsApproval !== undefined) console.log(`  Needs Approval: ${result.needsApproval}`);
  }

  // Ask to execute bridges for ready chains
  const readyChains = results.filter(r => r.status === "READY");
  if (readyChains.length > 0) {
    console.log(`\n\n${"=".repeat(60)}`);
    console.log(`Ready to bridge from ${readyChains.length} chain(s)`);
    console.log("=".repeat(60));
    
    // Execute bridges
    for (const ready of readyChains) {
      const chainConfig = CHAINS[ready.chain as keyof typeof CHAINS];
      const success = await attemptBridge(ready.chain, chainConfig, ready.token, ready.amount);
      if (!success) {
        console.log(`\nBridge from ${ready.chain} failed, continuing to next...`);
      }
    }
  } else {
    console.log(`\n❌ No chains are ready for bridging!`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


