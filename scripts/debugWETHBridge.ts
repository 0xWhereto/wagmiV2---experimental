import { ethers } from "hardhat";

// Addresses
const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const ARB_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const ARB_WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const ARB_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const ARB_EID = 30110;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=== DEBUGGING WETH BRIDGE ===\n");
  console.log(`User: ${deployer.address}\n`);
  
  const arbProvider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  const sonicProvider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");
  
  // 1. Check if WETH is registered on Gateway
  console.log("1. GATEWAY TOKEN REGISTRATION:");
  const gatewayAbi = [
    "function getTokenIndex(address) view returns (uint256)",
    "function availableTokens(uint256) view returns (bool onPause, address tokenAddress, address syntheticTokenAddress, int8 decimalsDelta, uint256 minBridgeAmt)",
    "function getAvailableTokenLength() view returns (uint256)",
  ];
  
  const gateway = new ethers.Contract(ARB_GATEWAY, gatewayAbi, arbProvider);
  
  try {
    const tokenCount = await gateway.getAvailableTokenLength();
    console.log(`   Total tokens registered: ${tokenCount}`);
    
    // List all tokens
    console.log("\n   Registered tokens:");
    for (let i = 0; i < Math.min(Number(tokenCount), 10); i++) {
      const token = await gateway.availableTokens(i);
      const isWETH = token.tokenAddress.toLowerCase() === ARB_WETH.toLowerCase();
      const isUSDC = token.tokenAddress.toLowerCase() === ARB_USDC.toLowerCase();
      const label = isWETH ? "WETH" : isUSDC ? "USDC" : token.tokenAddress.slice(0,10);
      console.log(`   [${i}] ${label}: paused=${token.onPause}, minBridge=${ethers.utils.formatEther(token.minBridgeAmt)}`);
    }
    
    // Check WETH specifically
    console.log("\n   Checking WETH registration:");
    try {
      const wethIndex = await gateway.getTokenIndex(ARB_WETH);
      console.log(`   ✅ WETH index: ${wethIndex}`);
      const wethToken = await gateway.availableTokens(wethIndex);
      console.log(`   WETH paused: ${wethToken.onPause}`);
      console.log(`   WETH minBridge: ${ethers.utils.formatEther(wethToken.minBridgeAmt)} WETH`);
      console.log(`   WETH syntheticAddress: ${wethToken.syntheticTokenAddress}`);
    } catch (e: any) {
      console.log(`   ❌ WETH NOT REGISTERED on Gateway!`);
      console.log(`      This means WETH needs to be linked first.`);
    }
  } catch (e: any) {
    console.log(`   Error: ${e.message?.slice(0, 100)}`);
  }
  
  // 2. Check user's WETH balance
  console.log("\n\n2. USER WETH BALANCE:");
  
  const erc20Abi = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function allowance(address owner, address spender) view returns (uint256)",
  ];
  
  const weth = new ethers.Contract(ARB_WETH, erc20Abi, arbProvider);
  
  try {
    const balance = await weth.balanceOf(deployer.address);
    const decimals = await weth.decimals();
    const allowance = await weth.allowance(deployer.address, ARB_GATEWAY);
    console.log(`   WETH balance: ${ethers.utils.formatUnits(balance, decimals)} WETH`);
    console.log(`   Gateway allowance: ${ethers.utils.formatUnits(allowance, decimals)} WETH`);
    
    // $3 worth of WETH at ~$3500/ETH
    const ethPrice = 3500;
    const dollarValue = parseFloat(ethers.utils.formatEther(balance)) * ethPrice;
    console.log(`   Value: ~$${dollarValue.toFixed(2)}`);
  } catch (e: any) {
    console.log(`   Error: ${e.message?.slice(0, 100)}`);
  }
  
  // 3. Check Hub for sWETH
  console.log("\n\n3. HUB sWETH STATUS:");
  
  // Try calling the hub directly
  const hubAbi = [
    "function owner() view returns (address)",
  ];
  
  const hub = new ethers.Contract(HUB, hubAbi, sonicProvider);
  
  try {
    const owner = await hub.owner();
    console.log(`   Hub owner: ${owner}`);
    console.log(`   Is deployer owner: ${owner.toLowerCase() === deployer.address.toLowerCase()}`);
  } catch (e: any) {
    console.log(`   Error: ${e.message?.slice(0, 100)}`);
  }
}

main().catch(console.error);
