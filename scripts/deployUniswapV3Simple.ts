import { ethers } from "hardhat";

/**
 * Deploy Simplified Uniswap V3 Fork on Sonic
 * 
 * Core contracts only (no NFT image generation):
 * 1. WETH9 (already deployed)
 * 2. UniswapV3Factory (already deployed)
 * 3. SwapRouter
 * 4. NonfungiblePositionManager (with dummy descriptor)
 * 5. QuoterV2
 */

const UniswapV3Factory = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json");
const SwapRouter = require("@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json");
const NonfungiblePositionManager = require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json");
const QuoterV2 = require("@uniswap/v3-periphery/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(`\n${"=".repeat(60)}`);
  console.log(`🦄 Deploying Uniswap V3 Core (Simplified) to Sonic`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(await deployer.getBalance())} S\n`);

  // Already deployed contracts
  const WETH9_ADDRESS = "0xBFF7867E7e5e8D656Fc0B567cE7672140D208235";
  const FACTORY_ADDRESS = "0x3a1713B6C3734cfC883A3897647f3128Fe789f39";

  console.log("Using existing deployments:");
  console.log(`   WETH9: ${WETH9_ADDRESS}`);
  console.log(`   Factory: ${FACTORY_ADDRESS}\n`);

  // ============================================
  // 1. Deploy SwapRouter
  // ============================================
  console.log("1️⃣  Deploying SwapRouter...");
  
  const SwapRouterFactory = new ethers.ContractFactory(
    SwapRouter.abi,
    SwapRouter.bytecode,
    deployer
  );
  
  const swapRouter = await SwapRouterFactory.deploy(
    FACTORY_ADDRESS,
    WETH9_ADDRESS,
    { gasLimit: 5000000 }
  );
  await swapRouter.deployed();
  console.log(`   ✅ SwapRouter: ${swapRouter.address}`);

  // ============================================
  // 2. Deploy NonfungiblePositionManager
  // ============================================
  console.log("\n2️⃣  Deploying NonfungiblePositionManager...");
  console.log("   (Using zero address for descriptor - NFT images will be empty)");
  
  const PositionManagerFactory = new ethers.ContractFactory(
    NonfungiblePositionManager.abi,
    NonfungiblePositionManager.bytecode,
    deployer
  );
  
  // Use zero address for tokenDescriptor - positions will work but without images
  const positionManager = await PositionManagerFactory.deploy(
    FACTORY_ADDRESS,
    WETH9_ADDRESS,
    ethers.constants.AddressZero, // No descriptor = no NFT images
    { gasLimit: 6000000 }
  );
  await positionManager.deployed();
  console.log(`   ✅ NonfungiblePositionManager: ${positionManager.address}`);

  // ============================================
  // 3. Deploy QuoterV2
  // ============================================
  console.log("\n3️⃣  Deploying QuoterV2...");
  
  const QuoterV2Factory = new ethers.ContractFactory(
    QuoterV2.abi,
    QuoterV2.bytecode,
    deployer
  );
  
  const quoterV2 = await QuoterV2Factory.deploy(
    FACTORY_ADDRESS,
    WETH9_ADDRESS,
    { gasLimit: 3000000 }
  );
  await quoterV2.deployed();
  console.log(`   ✅ QuoterV2: ${quoterV2.address}`);

  // ============================================
  // Summary
  // ============================================
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🎉 UNISWAP V3 DEPLOYMENT COMPLETE!`);
  console.log(`${"=".repeat(60)}`);
  console.log(`
📋 All Contract Addresses:
────────────────────────────────────────────────────────────
WETH9 (Wrapped Sonic):        ${WETH9_ADDRESS}
UniswapV3Factory:             ${FACTORY_ADDRESS}
SwapRouter:                   ${swapRouter.address}
NonfungiblePositionManager:   ${positionManager.address}
QuoterV2:                     ${quoterV2.address}
────────────────────────────────────────────────────────────

🔧 To update your SyntheticTokenHub, run:
   
   const hub = await ethers.getContractAt("SyntheticTokenHub", "YOUR_HUB_ADDRESS");
   await hub.setUniswapRouter("${swapRouter.address}");

📊 Fee Tiers Available (default):
   • 0.05% (500)  - tick spacing: 10
   • 0.30% (3000) - tick spacing: 60
   • 1.00% (10000)- tick spacing: 200

🏊 To Create a Pool:
   const factory = new ethers.Contract("${FACTORY_ADDRESS}", factoryAbi, signer);
   await factory.createPool(tokenA, tokenB, 3000); // 0.3% fee tier

💰 To Add Liquidity:
   const posManager = new ethers.Contract("${positionManager.address}", posManagerAbi, signer);
   await posManager.mint({
     token0: tokenA,
     token1: tokenB,
     fee: 3000,
     tickLower: -887220,
     tickUpper: 887220,
     amount0Desired: amount0,
     amount1Desired: amount1,
     amount0Min: 0,
     amount1Min: 0,
     recipient: yourAddress,
     deadline: Math.floor(Date.now() / 1000) + 3600
   });
`);

  return {
    weth9: WETH9_ADDRESS,
    factory: FACTORY_ADDRESS,
    swapRouter: swapRouter.address,
    positionManager: positionManager.address,
    quoterV2: quoterV2.address,
  };
}

main()
  .then((addresses) => {
    console.log("\n📦 Deployment Result (JSON):");
    console.log(JSON.stringify(addresses, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });



