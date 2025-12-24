import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const NEW_GATEWAY = "0x2d603F7B0d06Bd5f6232Afe1991aF3D103d68071";
const ARB_EID = 30110;

// Remote tokens on Arbitrum
const USDC = ethers.utils.getAddress("0xaf88d065e77c8cc2239327c5edb3a432268e5831");
const WETH = ethers.utils.getAddress("0x82af49447d8a07e3bd95bd0d56f35241523fbab1");
const WBTC = ethers.utils.getAddress("0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=== Create and Link Tokens ===");
  console.log("Owner:", deployer.address);
  
  const hub = await ethers.getContractAt("SyntheticTokenHub", HUB_ADDRESS);
  
  // First, let's try to create new synthetic tokens
  const tokens = [
    { name: "sUSDC_new", decimals: 6, remote: USDC, minBridge: "1000000" },
    { name: "sWETH_new", decimals: 18, remote: WETH, minBridge: "100000000000000" },
    { name: "sWBTC_new", decimals: 8, remote: WBTC, minBridge: "10000" },
  ];
  
  for (const token of tokens) {
    console.log(`\n--- Processing ${token.name} ---`);
    
    // Step 1: Create synthetic token
    console.log(`1. Creating ${token.name}...`);
    let synthAddress: string;
    try {
      const tx = await hub.createSyntheticToken(token.name, token.decimals);
      console.log("   TX:", tx.hash);
      const receipt = await tx.wait();
      
      // Find the synthetic token address from event
      const event = receipt.events?.find((e: any) => e.event === "SyntheticTokenCreated");
      if (event) {
        synthAddress = event.args?.tokenAddress || event.args?.[0];
        console.log(`   ✓ Created ${token.name} at ${synthAddress}`);
      } else {
        // Try to find from logs
        console.log("   Events:", receipt.events?.map((e: any) => e.event));
        continue;
      }
    } catch (e: any) {
      if (e.reason?.includes("already") || e.message?.includes("already")) {
        console.log(`   Token might already exist, continuing...`);
        continue;
      }
      console.log(`   ✗ Error:`, e.reason || e.message?.slice(0, 80));
      continue;
    }
    
    // Step 2: Link remote token
    console.log(`2. Linking ${token.name} to ${token.remote}...`);
    try {
      const tx = await hub.manualLinkRemoteToken(
        synthAddress!,
        ARB_EID,
        token.remote,
        NEW_GATEWAY,
        0, // decimalsDelta (same decimals)
        token.minBridge
      );
      console.log("   TX:", tx.hash);
      await tx.wait();
      console.log(`   ✓ Linked!`);
    } catch (e: any) {
      console.log(`   ✗ Error:`, e.reason || e.message?.slice(0, 80));
    }
  }
}

main().catch(console.error);
