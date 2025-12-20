import { ethers } from "hardhat";

/**
 * This script updates the existing Arbitrum Gateway to add WBTC support.
 * Since the Gateway now has updateSyntheticTokenAddress function, we can:
 * 1. Update WBTC's synthetic address on the Gateway
 * 2. Send linkTokenToHub to create the mapping on the Hub
 * 
 * BUT WAIT - the old Gateway doesn't have this function yet.
 * We need to deploy a new Gateway with the updated contract.
 */

const CONFIG = {
  // Hub (Sonic)
  hub: "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd",
  hubGetters: "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e",
  sonicEid: 30332,
  
  // Arbitrum
  arbitrumEid: 30110,
  oldGateway: "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e",
  endpoint: "0x1a44076050125825900e736c501f859c50fE728c",
  
  // Tokens to link
  tokens: {
    WETH: {
      address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
      synthetic: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
      decimals: 18,
    },
    USDT: {
      address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      synthetic: "0x72dFC771E515423E5B0CD2acf703d0F7eb30bdEa",
      decimals: 6,
    },
    USDC: {
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      synthetic: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B",
      decimals: 6,
    },
    WBTC: {
      address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
      synthetic: "", // Need to find or create sBTC
      decimals: 8,
    },
  },
  
  // DVN Config
  dvn: "0x2f55C492897526677C5B68fb199ea31E2c126416",
  executor: "0x31CAe3B7fB82d847621859fb1585353c5720660D",
};

async function main() {
  console.log("=== ADDING WBTC TO BRIDGE ===\n");
  
  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);
  
  // First, we need to find or create sBTC on the Hub
  console.log("\n--- Step 1: Finding sBTC on Hub ---");
  
  const hubGetters = await ethers.getContractAt("SyntheticTokenHubGetters", CONFIG.hubGetters);
  
  // Check existing sBTC tokens
  const count = await hubGetters.getSyntheticTokenCount();
  console.log(`Total synthetic tokens: ${count}`);
  
  let sbtcAddress = "";
  for (let i = 1; i <= count.toNumber(); i++) {
    try {
      const info = await hubGetters.getSyntheticTokenInfo(i);
      if (info[1] === "sBTC") {
        console.log(`Found sBTC at index ${i}: ${info[0]}`);
        
        // Check if already linked to Arbitrum
        try {
          const remoteInfo = await hubGetters.getRemoteTokenInfo(info[0], CONFIG.arbitrumEid);
          if (remoteInfo.remoteAddress === ethers.constants.AddressZero) {
            console.log(`  → Not linked to Arbitrum yet!`);
            sbtcAddress = info[0];
            break;
          } else {
            console.log(`  → Already linked to ${remoteInfo.remoteAddress}`);
          }
        } catch (e) {
          sbtcAddress = info[0];
          break;
        }
      }
    } catch (e) {}
  }
  
  if (!sbtcAddress) {
    console.log("\nNo unlinked sBTC found. Need to create one on the Hub.");
    console.log("Run this on Sonic network to create sBTC:");
    console.log(`
    const hub = await ethers.getContractAt("SyntheticTokenHub", "${CONFIG.hub}");
    await hub.createSyntheticToken("BTC", 8);
    `);
    return;
  }
  
  console.log(`\nUsing sBTC: ${sbtcAddress}`);
  CONFIG.tokens.WBTC.synthetic = sbtcAddress;
  
  // Step 2: Check if we can update the existing Gateway
  console.log("\n--- Step 2: Checking Gateway ---");
  
  // Check if existing gateway has updateSyntheticTokenAddress
  const gateway = await ethers.getContractAt("GatewayVault", CONFIG.oldGateway);
  
  try {
    // Try to call the function (it will revert but we'll know if it exists)
    await gateway.estimateGas.updateSyntheticTokenAddress(
      CONFIG.tokens.WBTC.address,
      sbtcAddress,
      8
    );
    console.log("✅ Gateway has updateSyntheticTokenAddress function");
    
    // Update WBTC synthetic address
    console.log("\n--- Step 3: Updating WBTC synthetic address ---");
    const tx = await gateway.updateSyntheticTokenAddress(
      CONFIG.tokens.WBTC.address,
      sbtcAddress,
      8
    );
    console.log(`TX: ${tx.hash}`);
    await tx.wait();
    console.log("✅ Updated WBTC synthetic address");
    
    // Now we need to link it on the Hub
    console.log("\n--- Step 4: Linking WBTC on Hub ---");
    // This requires sending an LZ message from Gateway
    // We'll use linkTokenToHub but it will fail because token is already registered
    // We need a different approach...
    
  } catch (e: any) {
    if (e.message?.includes("function selector was not recognized")) {
      console.log("❌ Old Gateway doesn't have updateSyntheticTokenAddress");
      console.log("Need to deploy a new Gateway");
    } else {
      // Function exists, just other error
      console.log(`Function check result: ${e.message?.slice(0, 100)}`);
    }
  }
}

main().catch(console.error);

