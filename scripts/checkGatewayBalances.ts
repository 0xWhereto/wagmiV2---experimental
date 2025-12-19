import { ethers } from "hardhat";

/**
 * This script checks all token balances held in gateway vaults across all chains.
 */

const GATEWAYS = {
  arbitrum: {
    chainId: 42161,
    gateway: "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e",
    rpc: "https://arb1.arbitrum.io/rpc",
  },
  ethereum: {
    chainId: 1,
    gateway: "0xba36FC6568B953f691dd20754607590C59b7646a",
    rpc: "https://ethereum-rpc.publicnode.com",
  },
  base: {
    chainId: 8453,
    gateway: "0xB712543E7fB87C411AAbB10c6823cf39bbEBB4Bb",
    rpc: "https://mainnet.base.org",
  }
};

const GATEWAY_ABI = [
  "function getAllAvailableTokens() external view returns (tuple(bool onPause, int8 decimalsDelta, address syntheticTokenAddress, address tokenAddress, uint8 tokenDecimals, string tokenSymbol, uint256 tokenBalance)[])",
  "function owner() external view returns (address)",
];

async function main() {
  console.log("=".repeat(70));
  console.log("GATEWAY VAULT BALANCE CHECK");
  console.log("=".repeat(70));

  let totalValueUSD = 0;

  // Rough token prices for estimation
  const PRICES: Record<string, number> = {
    WETH: 3500,
    WBTC: 100000,
    USDC: 1,
    USDT: 1,
    DAI: 1,
  };

  for (const [chainName, config] of Object.entries(GATEWAYS)) {
    console.log(`\n${"─".repeat(70)}`);
    console.log(`${chainName.toUpperCase()} Gateway: ${config.gateway}`);
    console.log("─".repeat(70));

    try {
      const provider = new ethers.providers.JsonRpcProvider(config.rpc);
      const gateway = new ethers.Contract(config.gateway, GATEWAY_ABI, provider);

      // Check owner
      const owner = await gateway.owner();
      console.log(`Owner: ${owner}`);

      // Get all tokens
      const tokens = await gateway.getAllAvailableTokens();
      
      if (tokens.length === 0) {
        console.log("No tokens configured");
        continue;
      }

      console.log(`\nToken Balances:`);
      console.log("─".repeat(50));

      let chainTotal = 0;

      for (const token of tokens) {
        const symbol = token.tokenSymbol;
        const decimals = Number(token.tokenDecimals);
        const balance = token.tokenBalance;
        const formattedBalance = ethers.utils.formatUnits(balance, decimals);
        const numBalance = parseFloat(formattedBalance);
        
        const price = PRICES[symbol] || 0;
        const valueUSD = numBalance * price;
        chainTotal += valueUSD;

        const paused = token.onPause ? " [PAUSED]" : "";
        
        if (numBalance > 0) {
          console.log(`  ${symbol}${paused}:`);
          console.log(`    Balance: ${formattedBalance}`);
          console.log(`    Address: ${token.tokenAddress}`);
          if (price > 0) {
            console.log(`    Value: ~$${valueUSD.toFixed(2)}`);
          }
        } else {
          console.log(`  ${symbol}: 0${paused}`);
        }
      }

      if (chainTotal > 0) {
        console.log(`\n  Chain Total: ~$${chainTotal.toFixed(2)}`);
      }
      totalValueUSD += chainTotal;

    } catch (e: any) {
      console.log(`Error: ${e.message}`);
    }
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log(`TOTAL VALUE ACROSS ALL GATEWAYS: ~$${totalValueUSD.toFixed(2)}`);
  console.log("=".repeat(70));

  console.log(`\n${"─".repeat(70)}`);
  console.log("OPTIONS TO WITHDRAW TOKENS:");
  console.log("─".repeat(70));
  console.log(`
1. NORMAL WITHDRAWAL (Recommended):
   - Burn synthetic tokens on Sonic Hub
   - Hub sends LayerZero message to Gateway
   - Gateway releases original tokens to recipient
   
2. REDEPLOY GATEWAYS (If normal flow not possible):
   - Deploy new GatewayVault contracts with rescueTokens function
   - Update Hub peers to point to new gateways
   - Re-link tokens
   - Use rescueTokens to withdraw
   - Note: This requires redeploying on each chain

3. UPGRADE (If using proxy - not applicable here):
   - Current gateways are not upgradeable
`);
}

main().catch(console.error);

