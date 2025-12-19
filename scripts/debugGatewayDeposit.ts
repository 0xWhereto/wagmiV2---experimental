import { ethers } from "hardhat";

const GATEWAY_ADDRESS = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const USER_ADDRESS = "0x4151E05ABe56192e2A6775612C2020509Fd50637";
const USDC_ARB = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const WETH_ARB = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const WBTC_ARB = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
const USDT_ARB = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9";

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  console.log("=== Gateway Deposit Debug ===\n");
  
  // Check if gateway contract exists
  const code = await provider.getCode(GATEWAY_ADDRESS);
  console.log(`Gateway has code: ${code.length > 2}`);
  
  // Gateway ABI for checking tokens
  const gatewayAbi = [
    "function getAllAvailableTokens() view returns (tuple(bool onPause, int8 decimalsDelta, address syntheticTokenAddress, address tokenAddress, uint8 tokenDecimals, string tokenSymbol, uint256 tokenBalance)[])",
    "function getTokenIndex(address _tokenAddress) view returns (uint256)",
    "function isPaused() view returns (bool)",
    "function owner() view returns (address)",
  ];
  
  const gateway = new ethers.Contract(GATEWAY_ADDRESS, gatewayAbi, provider);
  
  // Check owner
  try {
    const owner = await gateway.owner();
    console.log(`Gateway owner: ${owner}`);
  } catch (e: any) {
    console.log(`Cannot get owner: ${e.message?.substring(0, 50)}`);
  }
  
  // Check if paused
  try {
    const paused = await gateway.isPaused();
    console.log(`Gateway paused: ${paused}`);
  } catch (e: any) {
    console.log(`Cannot check pause: ${e.message?.substring(0, 50)}`);
  }
  
  // Get all available tokens
  console.log("\n=== Available Tokens in Gateway ===");
  try {
    const tokens = await gateway.getAllAvailableTokens();
    console.log(`Number of tokens: ${tokens.length}`);
    for (const t of tokens) {
      console.log(`\n  Symbol: ${t.tokenSymbol}`);
      console.log(`  Token Address: ${t.tokenAddress}`);
      console.log(`  Synthetic Address: ${t.syntheticTokenAddress}`);
      console.log(`  On Pause: ${t.onPause}`);
      console.log(`  Decimals Delta: ${t.decimalsDelta}`);
      console.log(`  Balance: ${t.tokenBalance.toString()}`);
    }
  } catch (e: any) {
    console.log(`Cannot get tokens: ${e.message?.substring(0, 100)}`);
  }
  
  // Check specific token indices
  console.log("\n=== Token Index Check ===");
  const tokensToCheck = [
    { name: "USDC", address: USDC_ARB },
    { name: "WETH", address: WETH_ARB },
    { name: "WBTC", address: WBTC_ARB },
    { name: "USDT", address: USDT_ARB },
  ];
  
  for (const t of tokensToCheck) {
    try {
      const index = await gateway.getTokenIndex(t.address);
      console.log(`${t.name}: index = ${index}`);
    } catch (e: any) {
      console.log(`${t.name}: NOT REGISTERED (${e.message?.substring(0, 50)})`);
    }
  }
  
  // Check user's USDC balance and allowance
  console.log("\n=== User Token Status ===");
  const erc20Abi = [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function decimals() view returns (uint8)",
  ];
  
  const usdc = new ethers.Contract(USDC_ARB, erc20Abi, provider);
  try {
    const balance = await usdc.balanceOf(USER_ADDRESS);
    const allowance = await usdc.allowance(USER_ADDRESS, GATEWAY_ADDRESS);
    const decimals = await usdc.decimals();
    console.log(`USDC Balance: ${ethers.utils.formatUnits(balance, decimals)} USDC`);
    console.log(`USDC Allowance to Gateway: ${ethers.utils.formatUnits(allowance, decimals)} USDC`);
  } catch (e: any) {
    console.log(`Error checking USDC: ${e.message?.substring(0, 50)}`);
  }
}

main().catch(console.error);
