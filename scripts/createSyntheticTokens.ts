import hardhat, { ethers } from "hardhat";

/**
 * Create synthetic tokens on the Sonic Hub
 * These must exist BEFORE linking remote tokens
 */

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

// Tokens to create (symbol, decimals)
const TOKENS_TO_CREATE = [
  { symbol: "sWETH", decimals: 18 },
  { symbol: "sUSDT", decimals: 6 },
  { symbol: "sUSDC", decimals: 6 },
];

async function main() {
  const network = hardhat.network.name;
  if (network !== "sonic") {
    console.log("This script should be run on Sonic network");
    return;
  }

  const [deployer] = await ethers.getSigners();
  console.log(`\n========================================`);
  console.log(`Creating Synthetic Tokens on SONIC Hub`);
  console.log(`========================================`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(await deployer.getBalance())} S`);

  const hub = await ethers.getContractAt("SyntheticTokenHub", HUB_ADDRESS);

  // Check owner
  const owner = await hub.owner();
  console.log(`\nHub Owner: ${owner}`);
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("❌ ERROR: You are not the Hub owner!");
    return;
  }

  // Create each synthetic token
  const createdTokens: { symbol: string; address: string; decimals: number }[] = [];

  for (const token of TOKENS_TO_CREATE) {
    console.log(`\n--- Creating ${token.symbol} ---`);
    
    try {
      const tx = await hub.createSyntheticToken(token.symbol, token.decimals, {
        gasLimit: 3000000,
      });
      console.log(`TX: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`✓ Created successfully!`);
      
      // Find the SyntheticTokenAdded event
      const event = receipt.events?.find((e: any) => e.event === "SyntheticTokenAdded");
      if (event) {
        const tokenAddress = event.args.tokenAddress;
        console.log(`  Address: ${tokenAddress}`);
        console.log(`  Index: ${event.args.tokenIndex.toString()}`);
        createdTokens.push({
          symbol: token.symbol,
          address: tokenAddress,
          decimals: token.decimals,
        });
      }
    } catch (e: any) {
      console.log(`Failed: ${e.message?.slice(0, 150)}`);
      if (e.message?.includes("already")) {
        console.log("Token may already exist");
      }
    }
  }

  // Print summary
  console.log("\n========================================");
  console.log("CREATED TOKENS:");
  console.log("========================================");
  for (const t of createdTokens) {
    console.log(`${t.symbol}: ${t.address} (${t.decimals} decimals)`);
  }

  console.log("\n========================================");
  console.log("NEXT STEPS:");
  console.log("========================================");
  console.log("1. Update linkTokens scripts with correct synthetic addresses");
  console.log("2. Skip the failed messages on the Hub");
  console.log("3. Re-run linkTokenToHub from each Gateway");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

