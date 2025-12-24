import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const ARB_EID = 30110;

async function main() {
  console.log("=== Query Hub State via Getters ===");
  
  // Deploy the SyntheticTokenHubGetters helper
  console.log("Deploying fresh SyntheticTokenHubGetters...");
  const Getters = await ethers.getContractFactory("SyntheticTokenHubGetters");
  const getters = await Getters.deploy(HUB_ADDRESS);
  await getters.deployed();
  console.log("Getters at:", getters.address);
  
  // Query synthetic tokens
  console.log("\n--- Synthetic Tokens ---");
  try {
    const count = await getters.getSyntheticTokenCount();
    console.log("Count:", count.toString());
    
    if (count.gt(0)) {
      const tokensInfo = await getters.getSyntheticTokensInfo(0, count);
      console.log("Tokens:");
      for (const t of tokensInfo) {
        console.log(`  - ${t.name} (${t.decimals} dec) @ ${t.tokenAddress}`);
        console.log(`    Chains:`, t.linkedChainEids.map((e: any) => e.toString()));
      }
    }
  } catch (e: any) {
    console.log("Error:", e.reason || e.message?.slice(0, 100));
  }
  
  // Check remote token info for USDC
  console.log("\n--- Remote Token Info (USDC from Arbitrum) ---");
  const USDC_ARB = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  try {
    const info = await getters.getRemoteTokenInfo(ARB_EID, USDC_ARB);
    console.log("Synthetic token:", info.syntheticTokenAddress);
    console.log("Decimals delta:", info.decimalsDelta.toString());
    console.log("Min bridge:", info.minBridgeAmt.toString());
  } catch (e: any) {
    console.log("Error:", e.reason || e.message?.slice(0, 100));
  }
  
  // Check gateway vault for Arbitrum
  console.log("\n--- Gateway Vault for Arbitrum ---");
  try {
    const gateway = await getters.getGatewayVaultByEid(ARB_EID);
    console.log("Gateway:", gateway);
  } catch (e: any) {
    console.log("Error:", e.reason || e.message?.slice(0, 100));
  }
}

main().catch(console.error);
