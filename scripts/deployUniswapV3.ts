import { ethers } from "hardhat";

/**
 * Deploy Uniswap V3 Fork on Sonic
 * 
 * Deploys:
 * 1. WETH9 (Wrapped Sonic) - wS
 * 2. UniswapV3Factory
 * 3. SwapRouter
 * 4. NonfungiblePositionManager
 * 5. QuoterV2
 */

// Import compiled artifacts from Uniswap packages
const UniswapV3Factory = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json");
const SwapRouter = require("@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json");
const NonfungiblePositionManager = require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json");
const NonfungibleTokenPositionDescriptor = require("@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json");
const NFTDescriptor = require("@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json");
const QuoterV2 = require("@uniswap/v3-periphery/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = (await ethers.provider.getNetwork()).name;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`🦄 Deploying Uniswap V3 Fork to Sonic`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(await deployer.getBalance())} S\n`);

  // Already deployed addresses (set to null to redeploy)
  const EXISTING_WETH9 = "0xBFF7867E7e5e8D656Fc0B567cE7672140D208235";
  const EXISTING_FACTORY = "0x3a1713B6C3734cfC883A3897647f3128Fe789f39";

  // ============================================
  // 1. Deploy WETH9 (Wrapped Sonic - wS)
  // ============================================
  let weth9: any;
  if (EXISTING_WETH9) {
    console.log("1️⃣  Using existing WETH9 (Wrapped Sonic)...");
    weth9 = await ethers.getContractAt("WETH9", EXISTING_WETH9);
    console.log(`   ✅ WETH9 (wS): ${weth9.address}`);
  } else {
    console.log("1️⃣  Deploying WETH9 (Wrapped Sonic)...");
    const WETH9 = await ethers.getContractFactory("WETH9");
    weth9 = await WETH9.deploy({ gasLimit: 1500000 });
    await weth9.deployed();
    console.log(`   ✅ WETH9 (wS): ${weth9.address}`);
  }

  // ============================================
  // 2. Deploy UniswapV3Factory
  // ============================================
  let factory: any;
  if (EXISTING_FACTORY) {
    console.log("\n2️⃣  Using existing UniswapV3Factory...");
    factory = new ethers.Contract(EXISTING_FACTORY, UniswapV3Factory.abi, deployer);
    console.log(`   ✅ UniswapV3Factory: ${factory.address}`);
  } else {
    console.log("\n2️⃣  Deploying UniswapV3Factory...");
    const V3FactoryFactory = new ethers.ContractFactory(
      UniswapV3Factory.abi,
      UniswapV3Factory.bytecode,
      deployer
    );
    factory = await V3FactoryFactory.deploy({ gasLimit: 6000000 });
    await factory.deployed();
    console.log(`   ✅ UniswapV3Factory: ${factory.address}`);
    
    // Enable additional fee tiers (500, 3000, 10000 are enabled by default)
    console.log("   Enabling additional fee tier (0.01%)...");
    try {
      await (await factory.enableFeeAmount(100, 1, { gasLimit: 150000 })).wait();
      console.log("   ✅ Fee tier 0.01% enabled");
    } catch (e: any) {
      console.log("   ⚠️  Fee tier 0.01% might already exist or failed");
    }
  }
  console.log("   ✅ Fee tiers available: 0.05%, 0.3%, 1%");

  // ============================================
  // 3. Deploy NFTDescriptor Library
  // ============================================
  console.log("\n3️⃣  Deploying NFTDescriptor Library...");
  
  const NFTDescriptorFactory = new ethers.ContractFactory(
    NFTDescriptor.abi,
    NFTDescriptor.bytecode,
    deployer
  );
  
  const nftDescriptor = await NFTDescriptorFactory.deploy({ gasLimit: 3000000 });
  await nftDescriptor.deployed();
  console.log(`   ✅ NFTDescriptor: ${nftDescriptor.address}`);

  // ============================================
  // 4. Deploy NonfungibleTokenPositionDescriptor
  // ============================================
  console.log("\n4️⃣  Deploying NonfungibleTokenPositionDescriptor...");
  
  // Link the NFTDescriptor library
  const linkedBytecode = NonfungibleTokenPositionDescriptor.bytecode.replace(
    /__\$[a-fA-F0-9]{34}\$__/g,
    nftDescriptor.address.slice(2).toLowerCase()
  );
  
  const TokenDescriptorFactory = new ethers.ContractFactory(
    NonfungibleTokenPositionDescriptor.abi,
    linkedBytecode,
    deployer
  );
  
  // Native currency label for Sonic: "S" encoded as bytes32
  const nativeCurrencyLabelBytes = ethers.utils.formatBytes32String("S");
  
  const tokenDescriptor = await TokenDescriptorFactory.deploy(
    weth9.address,
    nativeCurrencyLabelBytes,
    { gasLimit: 5000000 }
  );
  await tokenDescriptor.deployed();
  console.log(`   ✅ NonfungibleTokenPositionDescriptor: ${tokenDescriptor.address}`);

  // ============================================
  // 5. Deploy NonfungiblePositionManager
  // ============================================
  console.log("\n5️⃣  Deploying NonfungiblePositionManager...");
  
  const PositionManagerFactory = new ethers.ContractFactory(
    NonfungiblePositionManager.abi,
    NonfungiblePositionManager.bytecode,
    deployer
  );
  
  const positionManager = await PositionManagerFactory.deploy(
    factory.address,
    weth9.address,
    tokenDescriptor.address,
    { gasLimit: 6000000 }
  );
  await positionManager.deployed();
  console.log(`   ✅ NonfungiblePositionManager: ${positionManager.address}`);

  // ============================================
  // 6. Deploy SwapRouter
  // ============================================
  console.log("\n6️⃣  Deploying SwapRouter...");
  
  const SwapRouterFactory = new ethers.ContractFactory(
    SwapRouter.abi,
    SwapRouter.bytecode,
    deployer
  );
  
  const swapRouter = await SwapRouterFactory.deploy(
    factory.address,
    weth9.address,
    { gasLimit: 5000000 }
  );
  await swapRouter.deployed();
  console.log(`   ✅ SwapRouter: ${swapRouter.address}`);

  // ============================================
  // 7. Deploy QuoterV2
  // ============================================
  console.log("\n7️⃣  Deploying QuoterV2...");
  
  const QuoterV2Factory = new ethers.ContractFactory(
    QuoterV2.abi,
    QuoterV2.bytecode,
    deployer
  );
  
  const quoterV2 = await QuoterV2Factory.deploy(
    factory.address,
    weth9.address,
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
📋 Contract Addresses:
────────────────────────────────────────────────────────────
WETH9 (Wrapped Sonic):              ${weth9.address}
UniswapV3Factory:                   ${factory.address}
NFTDescriptor:                      ${nftDescriptor.address}
NonfungibleTokenPositionDescriptor: ${tokenDescriptor.address}
NonfungiblePositionManager:         ${positionManager.address}
SwapRouter:                         ${swapRouter.address}
QuoterV2:                           ${quoterV2.address}
────────────────────────────────────────────────────────────

🔧 To update your SyntheticTokenHub, call:
   syntheticTokenHub.setUniswapRouter("${swapRouter.address}")
   
📊 Fee Tiers Available:
   • 0.01% (100)  - tick spacing: 1
   • 0.05% (500)  - tick spacing: 10  
   • 0.30% (3000) - tick spacing: 60
   • 1.00% (10000)- tick spacing: 200
`);

  // Return addresses
  return {
    weth9: weth9.address,
    factory: factory.address,
    nftDescriptor: nftDescriptor.address,
    tokenDescriptor: tokenDescriptor.address,
    positionManager: positionManager.address,
    swapRouter: swapRouter.address,
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

