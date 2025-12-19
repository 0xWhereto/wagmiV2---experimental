import { ethers } from "hardhat";

/**
 * This script:
 * 1. Deploys new GatewayVault with rescueTokens function
 * 2. Sets up peers with Hub
 * 3. Links tokens
 * 4. Once the Hub peers are updated, the new gateways can be used
 */

const RECIPIENT = "0x4151E05ABe56192e2A6775612C2020509Fd50637";
const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const HUB_EID = 30332;

// For now, let's just deploy on one chain to test
const ARBITRUM_CONFIG = {
  chainId: 42161,
  eid: 30110,
  oldGateway: "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e",
  endpoint: "0x1a44076050125825900e736c501f859c50fE728c",
  rpc: "https://arb1.arbitrum.io/rpc",
  tokens: [
    { symbol: "WETH", address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", syntheticAddress: "0x5E501C482952c1F2D58a4294F9A97759968c5125", syntheticDecimals: 18, minBridge: ethers.utils.parseEther("0.001").toString() },
    { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", syntheticAddress: "0x72dFC771E515423E5B0CD2acf703d0F7eb30bdEa", syntheticDecimals: 6, minBridge: "1000000" },
    { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", syntheticAddress: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B", syntheticDecimals: 6, minBridge: "1000000" },
    { symbol: "WBTC", address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", syntheticAddress: "0x1DeFDa524B2B5edB94299775B23d7E3dde1Fbb6C", syntheticDecimals: 8, minBridge: "10000" },
  ]
};

const GATEWAY_ABI = [
  "function rescueAllTokens(address _tokenAddress, address _to) external",
  "function rescueTokens(address _tokenAddress, address _to, uint256 _amount) external",
  "function getAllAvailableTokens() external view returns (tuple(bool onPause, int8 decimalsDelta, address syntheticTokenAddress, address tokenAddress, uint8 tokenDecimals, string tokenSymbol, uint256 tokenBalance)[])",
  "function owner() external view returns (address)",
];

async function main() {
  console.log("=".repeat(60));
  console.log("Deploy New Gateway & Rescue Tokens");
  console.log("=".repeat(60));

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY not set");
  }

  // Connect to Arbitrum
  const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_CONFIG.rpc);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log(`Wallet: ${wallet.address}`);
  const balance = await provider.getBalance(wallet.address);
  console.log(`ETH Balance: ${ethers.utils.formatEther(balance)} ETH`);

  // Step 1: Deploy new Gateway
  console.log("\n--- Step 1: Deploy New GatewayVault ---");
  
  const GatewayVault = await ethers.getContractFactory("GatewayVault", wallet);
  
  console.log(`Deploying GatewayVault...`);
  console.log(`  Endpoint: ${ARBITRUM_CONFIG.endpoint}`);
  console.log(`  Owner: ${wallet.address}`);
  console.log(`  Hub EID: ${HUB_EID}`);

  const gateway = await GatewayVault.deploy(
    ARBITRUM_CONFIG.endpoint,
    wallet.address,
    HUB_EID,
    { gasLimit: 5000000 }
  );
  
  await gateway.deployed();
  const gatewayAddress = gateway.address;
  
  console.log(`\n✅ New GatewayVault deployed at: ${gatewayAddress}`);

  // Step 2: Rescue tokens from OLD gateway using rescueAllTokens
  console.log("\n--- Step 2: Rescue Tokens from Old Gateway ---");
  
  // We need to check if the old gateway has rescueTokens... it doesn't!
  // So we can't rescue from old gateway directly.
  // 
  // What we CAN do is use the NEW gateway going forward, and for the old tokens:
  // - Either wait for users to withdraw normally
  // - Or we need to redeploy Hub to update peer
  
  console.log("\n⚠️  The OLD gateway doesn't have rescueTokens function.");
  console.log("To rescue old tokens, you have two options:");
  console.log("");
  console.log("Option A: NORMAL WITHDRAWAL FLOW");
  console.log("  1. Make sure you have synthetic tokens on Sonic");
  console.log("  2. Bridge them back to Arbitrum via the UI");
  console.log("  3. This will release your original tokens");
  console.log("");
  console.log("Option B: UPDATE HUB PEER (Complex)");
  console.log("  1. Call Hub.setPeer(30110, newGateway) on Sonic");
  console.log("  2. Call newGateway.setPeer(30332, Hub) on Arbitrum");
  console.log("  3. Link tokens on new gateway");
  console.log("  4. Old gateway tokens remain locked unless you update Hub to allow withdraw");
  
  // Step 3: Set peer on new gateway
  console.log("\n--- Step 3: Set Peer on New Gateway ---");
  
  const hubPeerBytes32 = ethers.utils.hexZeroPad(HUB_ADDRESS, 32);
  console.log(`Setting peer: EID=${HUB_EID}, Peer=${hubPeerBytes32}`);
  
  const setPeerTx = await gateway.setPeer(HUB_EID, hubPeerBytes32, { gasLimit: 500000 });
  await setPeerTx.wait();
  console.log(`✅ Peer set on new gateway`);

  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`New Gateway Address: ${gatewayAddress}`);
  console.log(`Old Gateway Address: ${ARBITRUM_CONFIG.oldGateway}`);
  console.log("");
  console.log("NEXT STEPS:");
  console.log("1. Update Hub peer on Sonic to point to new gateway:");
  console.log(`   hub.setPeer(${ARBITRUM_CONFIG.eid}, ${ethers.utils.hexZeroPad(gatewayAddress, 32)})`);
  console.log("");
  console.log("2. Link tokens on new gateway using linkTokenToHub()");
  console.log("");
  console.log("3. To get tokens from OLD gateway:");
  console.log("   - Use normal bridge flow (burn synthetics on Sonic)");
  console.log("   - Or update frontend config and use new gateway");
}

main().catch(console.error);

