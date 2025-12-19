import { ethers } from "hardhat";

// Gateway addresses
const GATEWAYS: { [network: string]: string } = {
  arbitrum: "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e",
  ethereum: "0xba36FC6568B953f691dd20754607590C59b7646a",
  base: "0xB712543E7fB87C411AAbB10c6823cf39bbEBB4Bb",
};

// Token addresses per network
const TOKENS: { [network: string]: { name: string; address: string }[] } = {
  arbitrum: [
    { name: "WETH", address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1" },
    { name: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" },
    { name: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
    { name: "WBTC", address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f" },
  ],
  ethereum: [
    { name: "WETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" },
    { name: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
    { name: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
    { name: "WBTC", address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" },
  ],
  base: [
    { name: "WETH", address: "0x4200000000000000000000000000000000000006" },
    { name: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
  ],
};

async function main() {
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  // Determine which network we're on
  let networkName: string;
  if (network.chainId === 42161) {
    networkName = "arbitrum";
  } else if (network.chainId === 1) {
    networkName = "ethereum";
  } else if (network.chainId === 8453) {
    networkName = "base";
  } else {
    console.log(`Unknown network: chainId ${network.chainId}`);
    return;
  }

  console.log(`=== Unpausing All Tokens on ${networkName.toUpperCase()} Gateway ===\n`);
  console.log(`Signer: ${signer.address}`);
  console.log(`Network: ${networkName} (chainId: ${network.chainId})`);
  
  const gatewayAddress = GATEWAYS[networkName];
  const tokens = TOKENS[networkName];
  
  if (!gatewayAddress) {
    console.log("No gateway configured for this network");
    return;
  }

  const gateway = await ethers.getContractAt(
    [
      "function owner() view returns (address)",
      "function pauseToken(address _tokenAddress, bool _onPause) external",
      "function getTokenIndex(address _tokenAddress) view returns (uint256)",
      "function availableTokens(uint256) view returns (tuple(address tokenAddress, address syntheticTokenAddress, int8 decimalsDelta, uint256 minBridgeAmt, bool onPause))"
    ],
    gatewayAddress,
    signer
  );

  // Check owner
  const owner = await gateway.owner();
  console.log(`Gateway: ${gatewayAddress}`);
  console.log(`Gateway owner: ${owner}`);
  
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.log("❌ You are NOT the owner! Cannot unpause tokens.");
    return;
  }

  console.log("✅ You are the owner!\n");

  // Unpause all tokens
  for (const token of tokens) {
    console.log(`Checking ${token.name} (${token.address})...`);
    
    try {
      const index = await gateway.getTokenIndex(token.address);
      const tokenInfo = await gateway.availableTokens(index);
      
      console.log(`  Index: ${index}, Paused: ${tokenInfo.onPause}`);
      
      if (tokenInfo.onPause) {
        console.log(`  Unpausing...`);
        
        const tx = await gateway.pauseToken(token.address, false, {
          gasLimit: 100000
        });
        console.log(`  TX: ${tx.hash}`);
        
        const receipt = await tx.wait();
        if (receipt.status === 1) {
          console.log(`  ✅ ${token.name} unpaused!`);
        } else {
          console.log(`  ❌ Transaction failed`);
        }
      } else {
        console.log(`  ✅ Already unpaused`);
      }
    } catch (e: any) {
      if (e.reason?.includes("Token not found") || e.message?.includes("Token not found")) {
        console.log(`  ⏭️ Token not linked to gateway`);
      } else {
        console.log(`  ❌ Error: ${e.reason || e.message?.slice(0, 80)}`);
      }
    }
  }

  console.log(`\n=== ${networkName.toUpperCase()} Gateway Done ===`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

