import hardhat, { ethers } from "hardhat";

/**
 * Deploy Wagmi Chain Local Development Contracts
 * 
 * This script deploys a mock LayerZero endpoint and the full HUB stack
 * for local development and testing.
 * 
 * Usage:
 *   npx hardhat run scripts/deployWagmiLocal.ts --network localhost
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = hardhat.network.name;

  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║           WAGMI CHAIN LOCAL DEPLOYMENT                     ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);
  
  console.log(`Network: ${network}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH\n`);

  // ============================================================================
  // 1. Deploy Mock LayerZero Endpoint
  // ============================================================================
  console.log("1. Deploying Mock LayerZero Endpoint...");
  
  // For local testing, we'll deploy a simple mock endpoint
  // In production, this would be the real LZ Endpoint
  const MockEndpoint = await ethers.getContractFactory("MockLzEndpoint");
  let lzEndpoint: string;
  
  try {
    const mockEndpoint = await MockEndpoint.deploy({ gasLimit: 2000000 });
    await mockEndpoint.deployed();
    lzEndpoint = mockEndpoint.address;
    console.log(`   ✅ Mock LZ Endpoint deployed to: ${lzEndpoint}`);
  } catch (e) {
    // If mock doesn't exist, use a placeholder address
    // The contracts will still deploy but LZ messaging won't work
    lzEndpoint = deployer.address; // Use deployer as placeholder
    console.log(`   ⚠️  Using placeholder for LZ Endpoint: ${lzEndpoint}`);
    console.log(`   ⚠️  Note: Cross-chain messaging won't work without real LZ Endpoint`);
  }

  // ============================================================================
  // 2. Deploy WETH9
  // ============================================================================
  console.log("\n2. Deploying WETH9...");
  const WETH9 = await ethers.getContractFactory("WETH9");
  const weth9 = await WETH9.deploy({ gasLimit: 2000000 });
  await weth9.deployed();
  console.log(`   ✅ WETH9 deployed to: ${weth9.address}`);

  // ============================================================================
  // 3. Deploy Balancer
  // ============================================================================
  console.log("\n3. Deploying Balancer...");
  const Balancer = await ethers.getContractFactory("Balancer");
  const balancer = await Balancer.deploy(deployer.address, { gasLimit: 2000000 });
  await balancer.deployed();
  console.log(`   ✅ Balancer deployed to: ${balancer.address}`);

  // ============================================================================
  // 4. Deploy SyntheticTokenHub
  // ============================================================================
  console.log("\n4. Deploying SyntheticTokenHub...");
  
  // Use placeholder addresses for Uniswap (can be deployed separately)
  const UNISWAP_ROUTER_PLACEHOLDER = "0x0000000000000000000000000000000000000001";
  const PERMIT2_PLACEHOLDER = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
  
  console.log(`   LZ Endpoint: ${lzEndpoint}`);
  console.log(`   Uniswap Router: ${UNISWAP_ROUTER_PLACEHOLDER} (placeholder)`);
  console.log(`   Permit2: ${PERMIT2_PLACEHOLDER}`);
  console.log(`   Balancer: ${balancer.address}`);
  
  const SyntheticTokenHub = await ethers.getContractFactory("SyntheticTokenHub");
  const syntheticTokenHub = await SyntheticTokenHub.deploy(
    lzEndpoint,
    deployer.address,
    UNISWAP_ROUTER_PLACEHOLDER,
    PERMIT2_PLACEHOLDER,
    balancer.address,
    { gasLimit: 8000000 }
  );
  await syntheticTokenHub.deployed();
  console.log(`   ✅ SyntheticTokenHub deployed to: ${syntheticTokenHub.address}`);

  // ============================================================================
  // 5. Deploy SyntheticTokenHubGetters
  // ============================================================================
  console.log("\n5. Deploying SyntheticTokenHubGetters...");
  const SyntheticTokenHubGetters = await ethers.getContractFactory("SyntheticTokenHubGetters");
  const syntheticTokenHubGetters = await SyntheticTokenHubGetters.deploy(
    syntheticTokenHub.address,
    { gasLimit: 1000000 }
  );
  await syntheticTokenHubGetters.deployed();
  console.log(`   ✅ SyntheticTokenHubGetters deployed to: ${syntheticTokenHubGetters.address}`);

  // ============================================================================
  // Summary
  // ============================================================================
  const deploymentInfo = {
    network,
    chainId: (await ethers.provider.getNetwork()).chainId,
    deployer: deployer.address,
    contracts: {
      lzEndpoint: lzEndpoint,
      weth9: weth9.address,
      balancer: balancer.address,
      syntheticTokenHub: syntheticTokenHub.address,
      syntheticTokenHubGetters: syntheticTokenHubGetters.address,
    },
    uniswap: {
      router: UNISWAP_ROUTER_PLACEHOLDER,
      permit2: PERMIT2_PLACEHOLDER,
      note: "Uniswap V3 needs to be deployed separately",
    },
  };

  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║           WAGMI CHAIN DEPLOYMENT COMPLETE                  ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);
  
  console.log(`📍 Network: ${network} (Chain ID: ${deploymentInfo.chainId})`);
  console.log(`\n📋 Deployed Contracts:`);
  console.log(`   WETH9:                    ${weth9.address}`);
  console.log(`   Balancer:                 ${balancer.address}`);
  console.log(`   SyntheticTokenHub:        ${syntheticTokenHub.address}`);
  console.log(`   SyntheticTokenHubGetters: ${syntheticTokenHubGetters.address}`);
  
  console.log(`\n🔗 LayerZero:`);
  console.log(`   Endpoint: ${lzEndpoint}`);
  console.log(`   Note: For production, use real LZ Endpoint from LayerZero`);
  
  console.log(`\n🦄 Uniswap V3:`);
  console.log(`   Status: Not deployed (use scripts/deployUniswapV3.ts)`);
  
  console.log(`\n📝 Next Steps:`);
  console.log(`   1. Deploy Uniswap V3: npx hardhat run scripts/deployUniswapV3.ts --network localhost`);
  console.log(`   2. Create synthetic tokens: npx hardhat run scripts/createSyntheticTokens.ts --network localhost`);
  console.log(`   3. Create liquidity pools`);
  console.log(`\n`);

  // Save deployment info to file
  const fs = await import("fs");
  const deploymentPath = "./wagmi-chain/local/deployment.json";
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`💾 Deployment info saved to: ${deploymentPath}\n`);

  return deploymentInfo;
}

main()
  .then((info) => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });


