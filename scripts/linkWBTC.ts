import hardhat, { ethers } from "hardhat";
import { Options } from "@layerzerolabs/lz-v2-utilities";

/**
 * Link WBTC tokens from Ethereum and Arbitrum Gateway chains to the Sonic Hub
 * 
 * This creates a synthetic BTC (sBTC) on Sonic that is backed by real WBTC
 * from both Ethereum and Arbitrum chains.
 * 
 * Usage:
 *   npx hardhat run scripts/linkWBTC.ts --network arbitrum
 *   npx hardhat run scripts/linkWBTC.ts --network ethereum
 */

// ============ DEPLOYED GATEWAY ADDRESSES ============
const GATEWAY_ADDRESSES: Record<string, string> = {
  arbitrum: "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e", // NEW GATEWAY
  ethereum: "0xba36FC6568B953f691dd20754607590C59b7646a", // NEW GATEWAY
};

// ============ WBTC ADDRESSES PER CHAIN ============
const WBTC_ADDRESSES: Record<string, { address: string; symbol: string; decimals: number }> = {
  arbitrum: {
    address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
    symbol: "WBTC",
    decimals: 8, // WBTC has 8 decimals
  },
  ethereum: {
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    symbol: "WBTC",
    decimals: 8, // WBTC has 8 decimals
  },
};

// Minimum bridge amount: 0.0001 BTC = 10000 satoshi
const MIN_BRIDGE_AMOUNT = 10000n; // in satoshi (8 decimals)

// Gas limit for LayerZero execution
const LZ_GAS_LIMIT = 500000;

async function main() {
  const network = hardhat.network.name;
  
  if (!GATEWAY_ADDRESSES[network]) {
    console.log(`Network ${network} is not supported. Run this on: arbitrum or ethereum`);
    return;
  }

  const [deployer] = await ethers.getSigners();
  console.log(`\n╔════════════════════════════════════════════╗`);
  console.log(`║     LINKING WBTC ON ${network.toUpperCase().padEnd(10)}           ║`);
  console.log(`╚════════════════════════════════════════════╝`);
  console.log(`\nDeployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH`);

  const gatewayAddress = GATEWAY_ADDRESSES[network];
  console.log(`\nGateway Vault: ${gatewayAddress}`);

  const gatewayVault = await ethers.getContractAt("GatewayVault", gatewayAddress);

  // Check existing tokens
  const existingTokenCount = await gatewayVault.getAvailableTokenLength();
  console.log(`\nExisting linked tokens: ${existingTokenCount}`);

  if (existingTokenCount.gt(0)) {
    const existingTokens = await gatewayVault.getAllAvailableTokens();
    console.log("Already linked:");
    for (const token of existingTokens) {
      console.log(`  - ${token.tokenSymbol} (${token.tokenAddress})`);
    }
    
    // Check if WBTC is already linked
    const wbtcLinked = existingTokens.some(
      (t: any) => t.tokenAddress.toLowerCase() === WBTC_ADDRESSES[network].address.toLowerCase()
    );
    
    if (wbtcLinked) {
      console.log("\n✓ WBTC is already linked on this chain!");
      return;
    }
  }

  // Get WBTC config for this network
  const wbtcConfig = WBTC_ADDRESSES[network];
  console.log(`\n┌────────────────────────────────────────────┐`);
  console.log(`│ WBTC Token Details                         │`);
  console.log(`├────────────────────────────────────────────┤`);
  console.log(`│ Address:  ${wbtcConfig.address}    │`);
  console.log(`│ Symbol:   ${wbtcConfig.symbol.padEnd(20)}           │`);
  console.log(`│ Decimals: ${wbtcConfig.decimals.toString().padEnd(20)}           │`);
  console.log(`└────────────────────────────────────────────┘`);

  // Build token config for linkTokenToHub
  // syntheticTokenAddress will be 0x0 - Hub creates synthetic token automatically
  const tokenConfigs = [{
    onPause: false,
    tokenAddress: wbtcConfig.address,
    syntheticTokenDecimals: wbtcConfig.decimals, // Keep 8 decimals for BTC
    syntheticTokenAddress: ethers.constants.AddressZero, // Hub will create
    minBridgeAmt: MIN_BRIDGE_AMOUNT,
  }];

  // Build LayerZero options
  const lzOptions = Options.newOptions()
    .addExecutorLzReceiveOption(LZ_GAS_LIMIT, 0)
    .toHex()
    .toString();
  
  console.log(`\nLZ Options: ${lzOptions}`);

  // Quote the fee
  console.log("\nQuoting LayerZero fee...");
  let nativeFee: any;
  try {
    nativeFee = await gatewayVault.quoteLinkTokenToHub(tokenConfigs, lzOptions);
    console.log(`Estimated fee: ${ethers.utils.formatEther(nativeFee)} ETH`);
  } catch (e: any) {
    console.log("Quote failed, using default fee of 0.01 ETH");
    console.log("Error:", e.message?.slice(0, 100));
    nativeFee = ethers.utils.parseEther("0.01");
  }

  // Add 50% buffer
  const feeWithBuffer = nativeFee.mul(150).div(100);
  console.log(`Fee with 50% buffer: ${ethers.utils.formatEther(feeWithBuffer)} ETH`);

  // Check balance
  const balance = await deployer.getBalance();
  console.log(`Current balance: ${ethers.utils.formatEther(balance)} ETH`);
  
  const gasReserve = ethers.utils.parseEther("0.01");
  const maxSpendable = balance.sub(gasReserve);
  
  let actualFee = feeWithBuffer;
  if (balance.lt(feeWithBuffer)) {
    if (maxSpendable.gt(nativeFee)) {
      console.log(`\n⚠️ Using available balance instead of buffered amount`);
      actualFee = maxSpendable;
    } else {
      console.log(`\n❌ Insufficient balance. Need ${ethers.utils.formatEther(feeWithBuffer)} ETH`);
      return;
    }
  }
  
  console.log(`Will send: ${ethers.utils.formatEther(actualFee)} ETH as LZ fee`);

  // Confirm before executing
  console.log("\n🔗 Linking WBTC to Hub...");
  console.log("This will:");
  console.log("  1. Register WBTC on the Gateway");
  console.log("  2. Send LayerZero message to Sonic Hub");
  console.log("  3. Hub will create sBTC synthetic token (if first link)");
  console.log("  4. Hub will link sBTC to this WBTC address");

  try {
    const tx = await gatewayVault.linkTokenToHub(tokenConfigs, lzOptions, {
      value: actualFee,
      gasLimit: 500000,
    });
    console.log(`\nTransaction hash: ${tx.hash}`);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log(`\n╔════════════════════════════════════════════╗`);
    console.log(`║           ✅ WBTC LINKED SUCCESSFULLY       ║`);
    console.log(`╚════════════════════════════════════════════╝`);
    console.log(`\nGas used: ${receipt.gasUsed.toString()}`);
    console.log(`Block: ${receipt.blockNumber}`);

    // Verify linked tokens
    const newTokenCount = await gatewayVault.getAvailableTokenLength();
    console.log(`\nTotal linked tokens now: ${newTokenCount}`);
    
    const allTokens = await gatewayVault.getAllAvailableTokens();
    console.log("\nAll linked tokens on this gateway:");
    for (const token of allTokens) {
      console.log(`\n  ${token.tokenSymbol}:`);
      console.log(`    Token:     ${token.tokenAddress}`);
      console.log(`    Synthetic: ${token.syntheticTokenAddress}`);
      console.log(`    DecDelta:  ${token.decimalsDelta}`);
      console.log(`    Paused:    ${token.onPause}`);
    }

    console.log(`\n📋 NEXT STEPS:`);
    console.log(`   1. Wait for LayerZero message to arrive on Sonic Hub`);
    console.log(`   2. Verify sBTC was created on Hub: ${network === 'ethereum' ? 'First link creates it' : 'Should link to existing sBTC'}`);
    console.log(`   3. Run this script on the other chain if not done yet`);
    console.log(`   4. Users can now bridge WBTC from ${network} to Sonic`);

  } catch (e: any) {
    console.log(`\n❌ Failed to link WBTC: ${e.message}`);
    if (e.reason) console.log(`Reason: ${e.reason}`);
    if (e.data) console.log(`Data: ${e.data}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

