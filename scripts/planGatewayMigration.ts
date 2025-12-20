import { ethers } from "hardhat";

const OLD_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const USER = "0x4151E05ABe56192e2A6775612C2020509Fd50637";

// Tokens on Arbitrum
const TOKENS = {
  USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  WBTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
};

async function main() {
  console.log("=== PLANNING GATEWAY MIGRATION ===\n");
  
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  // Check old gateway token balances
  console.log("=== OLD GATEWAY TOKEN BALANCES ===");
  for (const [name, addr] of Object.entries(TOKENS)) {
    const token = new ethers.Contract(addr, ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"], provider);
    const balance = await token.balanceOf(OLD_GATEWAY);
    const decimals = await token.decimals();
    console.log(`  ${name}: ${ethers.utils.formatUnits(balance, decimals)}`);
  }
  
  // Check old gateway configuration
  console.log("\n=== OLD GATEWAY CONFIG ===");
  const gatewayAbi = [
    "function owner() view returns (address)",
    "function endpoint() view returns (address)",
    "function getAvailableTokensLength() view returns (uint256)",
    "function availableTokens(uint256) view returns (bool onPause, address tokenAddress, address syntheticTokenAddress, int8 decimalsDelta, uint256 minBridgeAmt)",
    "function peers(uint32) view returns (bytes32)",
  ];
  
  const gateway = new ethers.Contract(OLD_GATEWAY, gatewayAbi, provider);
  
  const owner = await gateway.owner();
  console.log(`Owner: ${owner}`);
  
  const endpoint = await gateway.endpoint();
  console.log(`Endpoint: ${endpoint}`);
  
  const peer = await gateway.peers(30332); // Sonic EID
  console.log(`Peer (Hub): ${peer}`);
  
  const tokenCount = await gateway.getAvailableTokensLength();
  console.log(`\nRegistered tokens: ${tokenCount}`);
  
  for (let i = 0; i < tokenCount.toNumber(); i++) {
    const token = await gateway.availableTokens(i);
    console.log(`  [${i}] ${token.tokenAddress}`);
    console.log(`      Synthetic: ${token.syntheticTokenAddress}`);
    console.log(`      MinBridge: ${token.minBridgeAmt.toString()}`);
    console.log(`      Paused: ${token.onPause}`);
  }
  
  // Check if rescue function exists
  console.log("\n=== CHECKING RESCUE FUNCTION ===");
  const rescueSelector = ethers.utils.id("rescueTokens(address,address,uint256)").slice(0, 10);
  const code = await provider.getCode(OLD_GATEWAY);
  const hasRescue = code.toLowerCase().includes(rescueSelector.slice(2).toLowerCase());
  console.log(`Has rescueTokens: ${hasRescue ? "YES" : "NO"}`);
}

main().catch(console.error);
