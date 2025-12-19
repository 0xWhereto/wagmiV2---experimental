import hardhat, { ethers } from "hardhat";

/**
 * Deploy Hub Chain Contracts (Sonic)
 * - Balancer
 * - SyntheticTokenHub
 * - SyntheticTokenHubGetters
 */

// LayerZero V2 Endpoint - SONIC SPECIFIC ADDRESS
// Note: Sonic uses a different endpoint address than other chains!
const LZ_ENDPOINT_V2 = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";

// Sonic DEX addresses
// Note: Use deployer address as placeholder for Uniswap Router if not available on Sonic
// You can update these with actual DEX addresses later
const UNISWAP_UNIVERSAL_ROUTER = "0x0000000000000000000000000000000000000001"; // Placeholder - update with actual DEX router
const UNISWAP_PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3"; // Permit2 is same on most chains

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = hardhat.network.name;

  console.log(`\n========================================`);
  console.log(`Deploying HUB contracts to ${network}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(await deployer.getBalance())} S`);
  console.log(`========================================\n`);

  // 1. Deploy Balancer
  console.log("1. Deploying Balancer...");
  const Balancer = await ethers.getContractFactory("Balancer");
  const balancer = await Balancer.deploy(deployer.address, { gasLimit: 2000000 });
  await balancer.deployed();
  console.log(`   Balancer deployed to: ${balancer.address}`);

  // 2. Deploy SyntheticTokenHub
  console.log("\n2. Deploying SyntheticTokenHub...");
  console.log(`   LayerZero Endpoint: ${LZ_ENDPOINT_V2}`);
  console.log(`   Uniswap Router: ${UNISWAP_UNIVERSAL_ROUTER}`);
  console.log(`   Permit2: ${UNISWAP_PERMIT2}`);
  console.log(`   Balancer: ${balancer.address}`);
  
  const SyntheticTokenHub = await ethers.getContractFactory("SyntheticTokenHub");
  const syntheticTokenHub = await SyntheticTokenHub.deploy(
    LZ_ENDPOINT_V2,
    deployer.address,
    UNISWAP_UNIVERSAL_ROUTER,
    UNISWAP_PERMIT2,
    balancer.address,
    { gasLimit: 8000000 }
  );
  await syntheticTokenHub.deployed();
  console.log(`   SyntheticTokenHub deployed to: ${syntheticTokenHub.address}`);

  // 3. Deploy SyntheticTokenHubGetters
  console.log("\n3. Deploying SyntheticTokenHubGetters...");
  const SyntheticTokenHubGetters = await ethers.getContractFactory("SyntheticTokenHubGetters");
  const syntheticTokenHubGetters = await SyntheticTokenHubGetters.deploy(
    syntheticTokenHub.address,
    { gasLimit: 1000000 }
  );
  await syntheticTokenHubGetters.deployed();
  console.log(`   SyntheticTokenHubGetters deployed to: ${syntheticTokenHubGetters.address}`);

  // Summary
  console.log(`\n========================================`);
  console.log(`HUB DEPLOYMENT COMPLETE`);
  console.log(`========================================`);
  console.log(`Network: ${network}`);
  console.log(`Balancer: ${balancer.address}`);
  console.log(`SyntheticTokenHub: ${syntheticTokenHub.address}`);
  console.log(`SyntheticTokenHubGetters: ${syntheticTokenHubGetters.address}`);
  console.log(`========================================\n`);

  // Return addresses for use in other scripts
  return {
    balancer: balancer.address,
    syntheticTokenHub: syntheticTokenHub.address,
    syntheticTokenHubGetters: syntheticTokenHubGetters.address,
  };
}

main()
  .then((addresses) => {
    console.log("Deployment addresses:", JSON.stringify(addresses, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

