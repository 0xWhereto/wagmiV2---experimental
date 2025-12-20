import { ethers } from "hardhat";

const LZ_ENDPOINT_SONIC = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
const ARB_EID = 30110;
const GATEWAY_ARB = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";

// Use zero addresses for unused Uniswap features
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

async function main() {
  console.log("=== DEPLOYING NEW HUB ===\n");
  
  const [signer] = await ethers.getSigners();
  console.log(`Deployer: ${signer.address}`);
  
  const balance = await signer.getBalance();
  console.log(`Balance: ${ethers.utils.formatEther(balance)} S`);
  
  if (balance.lt(ethers.utils.parseEther("1"))) {
    console.log("❌ Need at least 1 S for deployment");
    return;
  }
  
  // Deploy new Hub with all 5 constructor args
  console.log("\nDeploying SyntheticTokenHub...");
  const Hub = await ethers.getContractFactory("SyntheticTokenHub");
  const hub = await Hub.deploy(
    LZ_ENDPOINT_SONIC,      // _endpoint
    signer.address,          // _owner
    ZERO_ADDRESS,            // _uniswapUniversalRouter (not needed for basic bridging)
    ZERO_ADDRESS,            // _uniswapPermitV2 (not needed)
    ZERO_ADDRESS             // _balancer (not needed)
  );
  await hub.deployed();
  console.log(`✅ New Hub deployed at: ${hub.address}`);
  
  // Set peer to Arbitrum Gateway
  console.log("\nSetting peer to Arbitrum Gateway...");
  const peerBytes32 = ethers.utils.hexZeroPad(GATEWAY_ARB.toLowerCase(), 32);
  const tx1 = await hub.setPeer(ARB_EID, peerBytes32);
  await tx1.wait();
  console.log("✅ Peer set");
  
  console.log("\nCreating synthetic tokens...");
  
  // Create sUSDC (6 decimals)
  const tx2 = await hub.createSyntheticToken("sUSDC", 6);
  await tx2.wait();
  console.log("✅ Created sUSDC");
  
  // Create sWETH (18 decimals)
  const tx3 = await hub.createSyntheticToken("sWETH", 18);
  await tx3.wait();
  console.log("✅ Created sWETH");
  
  // Create sUSDT (6 decimals)
  const tx4 = await hub.createSyntheticToken("sUSDT", 6);
  await tx4.wait();
  console.log("✅ Created sUSDT");
  
  // Create sWBTC (8 decimals)
  const tx5 = await hub.createSyntheticToken("sWBTC", 8);
  await tx5.wait();
  console.log("✅ Created sWBTC");
  
  // Get new token addresses
  const tokenCount = await hub.syntheticTokensLength();
  console.log(`\nNew synthetic tokens (${tokenCount}):`);
  
  const newTokens: Record<string, string> = {};
  for (let i = 1; i <= tokenCount.toNumber(); i++) {
    const addr = await hub.syntheticTokens(i);
    const token = await ethers.getContractAt("SyntheticToken", addr);
    const symbol = await token.symbol();
    console.log(`  ${symbol}: ${addr}`);
    newTokens[symbol] = addr;
  }
  
  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log(`New Hub: ${hub.address}`);
  console.log("\nNext steps:");
  console.log("1. Update Gateway peer to new Hub");
  console.log("2. Configure DVN on new Hub");
  console.log("3. Link remote tokens on new Hub");
  console.log("4. Mint missing sUSDC to user");
  
  return { hub: hub.address, tokens: newTokens };
}

main()
  .then((result) => {
    console.log("\n=== RESULT ===");
    console.log(JSON.stringify(result, null, 2));
  })
  .catch(console.error);
