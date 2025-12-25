import { ethers } from "hardhat";

// Your wallet address to receive the tokens
const RECIPIENT = "0x4151E05ABe56192e2A6775612C2020509Fd50637";

// Hub configuration
const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

// Gateway configurations with their tokens
const GATEWAYS = {
  arbitrum: {
    chainId: 42161,
    eid: 30110,
    gateway: "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e",
    rpc: "https://arb1.arbitrum.io/rpc",
    tokens: [
      { symbol: "WETH", address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", decimals: 18 },
      { symbol: "WBTC", address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", decimals: 8 },
      { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
      { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
    ]
  },
  ethereum: {
    chainId: 1,
    eid: 30101,
    gateway: "0xba36FC6568B953f691dd20754607590C59b7646a",
    rpc: "https://ethereum-rpc.publicnode.com",
    tokens: [
      { symbol: "WETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18 },
      { symbol: "WBTC", address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8 },
      { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
      { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
    ]
  },
  base: {
    chainId: 8453,
    eid: 30184,
    gateway: "0xB712543E7fB87C411AAbB10c6823cf39bbEBB4Bb",
    rpc: "https://mainnet.base.org",
    tokens: [
      { symbol: "WETH", address: "0x4200000000000000000000000000000000000006", decimals: 18 },
      { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
    ]
  }
};

// SyntheticTokenHub ABI (partial - just the withdraw function)
const HUB_ABI = [
  "function sendWithdrawToGateway(uint32 _dstEid, address _to, tuple(address tokenAddress, uint256 tokenAmount)[] _assets, bytes _options) external payable returns (tuple(bytes32 guid, uint64 nonce, tuple(uint256 nativeFee, uint256 lzTokenFee) fee))",
  "function quoteWithdrawToGateway(uint32 _dstEid, address _to, tuple(address tokenAddress, uint256 tokenAmount)[] _assets, bytes _options) external view returns (uint256 nativeFee)",
  "function owner() external view returns (address)",
];

// ERC20 ABI for balance checking
const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
];

// GatewayVault ABI for checking balances
const GATEWAY_ABI = [
  "function getAllAvailableTokens() external view returns (tuple(bool onPause, int8 decimalsDelta, address syntheticTokenAddress, address tokenAddress, uint8 tokenDecimals, string tokenSymbol, uint256 tokenBalance)[])",
];

// Build LayerZero options with gas
function buildLzOptions(gasLimit: bigint = BigInt(500000)): string {
  const gasHex = gasLimit.toString(16).padStart(32, '0');
  return `0x000301001101${gasHex}`;
}

async function main() {
  console.log("=".repeat(60));
  console.log("Gateway Vault Token Withdrawal Script");
  console.log("=".repeat(60));
  console.log(`Recipient: ${RECIPIENT}`);
  console.log("");

  // Connect to Sonic (Hub chain)
  const sonicProvider = new ethers.JsonRpcProvider("https://rpc.soniclabs.com");
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY not set in environment");
  }
  const wallet = new ethers.Wallet(privateKey, sonicProvider);
  
  console.log(`Using wallet: ${wallet.address}`);
  console.log("");

  // Check Hub ownership
  const hub = new ethers.Contract(HUB_ADDRESS, HUB_ABI, wallet);
  
  try {
    const owner = await hub.owner();
    console.log(`Hub owner: ${owner}`);
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
      console.log("WARNING: Your wallet is not the Hub owner!");
    }
  } catch (e: any) {
    console.log("Could not verify Hub ownership:", e.message);
  }

  // Check balances on each gateway
  for (const [chainName, config] of Object.entries(GATEWAYS)) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Checking ${chainName.toUpperCase()} Gateway (${config.gateway})`);
    console.log("=".repeat(60));

    const provider = new ethers.JsonRpcProvider(config.rpc);
    const gateway = new ethers.Contract(config.gateway, GATEWAY_ABI, provider);

    try {
      const tokens = await gateway.getAllAvailableTokens();
      
      console.log(`\nAvailable tokens on ${chainName}:`);
      const assetsToWithdraw: { tokenAddress: string; tokenAmount: bigint }[] = [];

      for (const token of tokens) {
        const balance = token.tokenBalance;
        const symbol = token.tokenSymbol;
        const decimals = token.tokenDecimals;
        const formattedBalance = ethers.formatUnits(balance, decimals);
        
        console.log(`  ${symbol}: ${formattedBalance} (${balance.toString()} wei)`);
        
        if (balance > 0n) {
          assetsToWithdraw.push({
            tokenAddress: token.tokenAddress,
            tokenAmount: balance,
          });
        }
      }

      if (assetsToWithdraw.length === 0) {
        console.log(`\nNo tokens to withdraw from ${chainName}`);
        continue;
      }

      console.log(`\nWithdrawing ${assetsToWithdraw.length} tokens from ${chainName}...`);
      
      // Quote the withdrawal
      const options = buildLzOptions(BigInt(800000));
      
      try {
        // First try to quote
        const quoteFee = await hub.quoteWithdrawToGateway(
          config.eid,
          RECIPIENT,
          assetsToWithdraw,
          options
        );
        console.log(`LayerZero fee: ${ethers.formatEther(quoteFee)} S`);

        // Execute withdrawal
        console.log(`Sending withdrawal transaction...`);
        const tx = await hub.sendWithdrawToGateway(
          config.eid,
          RECIPIENT,
          assetsToWithdraw,
          options,
          { value: quoteFee + ethers.parseEther("0.1") } // Add buffer
        );
        
        console.log(`Transaction hash: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
        console.log(`✅ Withdrawal from ${chainName} initiated successfully!`);
        
      } catch (e: any) {
        console.log(`\n❌ Error withdrawing from ${chainName}:`);
        console.log(e.message);
        
        // Check if Hub has the withdraw function
        if (e.message.includes("no matching function")) {
          console.log("\nThe Hub may not have the sendWithdrawToGateway function.");
          console.log("Alternative: You may need to burn synthetic tokens on Hub to trigger withdrawal.");
        }
      }

    } catch (e: any) {
      console.log(`Error checking ${chainName}:`, e.message);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Script completed!");
  console.log("=".repeat(60));
}

main().catch(console.error);


