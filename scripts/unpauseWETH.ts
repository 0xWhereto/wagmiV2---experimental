import { ethers } from "hardhat";

const ARBITRUM_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const WETH_ARBITRUM = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDT_ARBITRUM = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9";
const USDC_ARBITRUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const WBTC_ARBITRUM = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Unpausing Tokens on Arbitrum Gateway ===\n");
  console.log(`Signer: ${signer.address}`);
  
  const gateway = await ethers.getContractAt(
    [
      "function owner() view returns (address)",
      "function pauseToken(address _tokenAddress, bool _onPause) external",
      "function getTokenIndex(address _tokenAddress) view returns (uint256)",
      "function availableTokens(uint256) view returns (tuple(address tokenAddress, address syntheticTokenAddress, int8 decimalsDelta, uint256 minBridgeAmt, bool onPause))"
    ],
    ARBITRUM_GATEWAY,
    signer
  );

  // Check owner
  const owner = await gateway.owner();
  console.log(`Gateway owner: ${owner}`);
  
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.log("❌ You are NOT the owner! Cannot unpause tokens.");
    return;
  }

  console.log("✅ You are the owner!\n");

  // Unpause all tokens
  const tokens = [
    { name: "WETH", address: WETH_ARBITRUM },
    { name: "USDT", address: USDT_ARBITRUM },
    { name: "USDC", address: USDC_ARBITRUM },
    { name: "WBTC", address: WBTC_ARBITRUM },
  ];

  for (const token of tokens) {
    console.log(`Checking ${token.name}...`);
    
    try {
      const index = await gateway.getTokenIndex(token.address);
      const tokenInfo = await gateway.availableTokens(index);
      
      console.log(`  Index: ${index}`);
      console.log(`  Currently paused: ${tokenInfo.onPause}`);
      
      if (tokenInfo.onPause) {
        console.log(`  Unpausing ${token.name}...`);
        
        const tx = await gateway.pauseToken(token.address, false, {
          gasLimit: 100000
        });
        console.log(`  TX: ${tx.hash}`);
        
        const receipt = await tx.wait();
        if (receipt.status === 1) {
          console.log(`  ✅ ${token.name} unpaused successfully!`);
        } else {
          console.log(`  ❌ Transaction failed`);
        }
      } else {
        console.log(`  Already unpaused`);
      }
    } catch (e: any) {
      if (e.reason?.includes("Token not found") || e.message?.includes("Token not found")) {
        console.log(`  Token not linked to gateway`);
      } else {
        console.log(`  Error: ${e.reason || e.message?.slice(0, 100)}`);
      }
    }
    console.log();
  }

  console.log("=== Done ===");
  console.log("Try the bridge again now!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

