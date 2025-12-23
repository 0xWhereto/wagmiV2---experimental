/**
 * 0IL Protocol v4 - Complete Redeployment
 * 
 * Deploys:
 * 1. MIM stablecoin with auto-liquidity for sUSDC
 * 2. MIMStakingVault (sMIM)
 * 3. MIM/sUSDC pool with correct 1:1 price initialization
 * 4. sWETH/MIM pool with correct ~3000 MIM/sWETH price
 * 5. WToken for zero-IL wETH positions
 * 6. OracleAdapter for price feeds
 * 7. V3LPVault for LP management
 * 8. LeverageAMM for 2x leverage
 */

import { ethers } from "hardhat";
import { config } from "../config/chains";

// Existing contracts on Sonic
const EXISTING_CONTRACTS = {
  // Uniswap V3 core (already deployed)
  uniswapV3Factory: "0x3a1713B6C3734cfC883A3897647f3128Fe789f39",
  nonfungiblePositionManager: "0x5826e10B513C891910032F15292B2F1b3041C3Df",
  swapRouter: "0x8BbF9fFF8CE8060B85DFe48d7b7E897d09418De9B",
  quoterV2: "0x57e3e0a9DfB3DA34cc164B2C8dD1EBc404c45d47",
  
  // Synthetic tokens (from Hub) - CORRECT ADDRESSES
  sUSDC: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B", // 6 decimals - Synthetic sUSDC
  sUSDT: "0xE00B91F92499d04e2E0A86bBA9ab3d6c1bC22c77", // 6 decimals
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125", // 18 decimals
  sWBTC: "0x20Ca9a180b6ae1f0Ba5B6750F47b1061C49E8aFE", // 8 decimals
  
  // Wrapped native (for WETH operations)
  weth9: "0xBFF7867E7e5e8D656Fc0B567cE7672140D208235",
  
  // Chainlink price feeds on Sonic
  ethUsdFeed: "0xC7b9324cE16DD2D9C0C4c4a9A6e5793a1e7bfA87", // ETH/USD (need to verify)
};

// Fee tiers for pools
const FEE_TIERS = {
  LOW: 500,      // 0.05%
  MEDIUM: 3000,  // 0.3%
  HIGH: 10000,   // 1%
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying 0IL Protocol v4 with account:", deployer.address);
  console.log("Account balance:", ethers.utils.formatEther(await deployer.getBalance()), "S");
  
  const deployedAddresses: Record<string, string> = {};
  
  // ============ 1. Deploy MIM Stablecoin ============
  console.log("\n1. Deploying MIM Stablecoin...");
  
  const MIM = await ethers.getContractFactory("contracts/0IL/core/MIM.sol:MIM");
  const mim = await MIM.deploy(
    EXISTING_CONTRACTS.sUSDC,                        // USDC backing
    EXISTING_CONTRACTS.nonfungiblePositionManager    // Position manager for auto-LP
  );
  await mim.deployed();
  deployedAddresses.mim = mim.address;
  console.log("   MIM deployed to:", mim.address);
  
  // ============ 2. Deploy MIMStakingVault (sMIM) ============
  console.log("\n2. Deploying MIMStakingVault (sMIM)...");
  
  const MIMStakingVault = await ethers.getContractFactory("contracts/0IL/core/MIMStakingVault.sol:MIMStakingVault");
  const stakingVault = await MIMStakingVault.deploy(
    mim.address,
    deployer.address  // Treasury (deployer for now)
  );
  await stakingVault.deployed();
  deployedAddresses.stakingVault = stakingVault.address;
  console.log("   MIMStakingVault deployed to:", stakingVault.address);
  
  // ============ 3. Create MIM/sUSDC Pool ============
  console.log("\n3. Creating MIM/sUSDC Pool...");
  
  const factory = await ethers.getContractAt(
    ["function createPool(address,address,uint24) external returns (address)", 
     "function getPool(address,address,uint24) external view returns (address)"],
    EXISTING_CONTRACTS.uniswapV3Factory,
    deployer
  );
  
  // Sort tokens (MIM and sUSDC)
  const mimAddr = mim.address;
  const usdcAddr = EXISTING_CONTRACTS.sUSDC;
  const [token0Usdc, token1Usdc] = mimAddr.toLowerCase() < usdcAddr.toLowerCase() 
    ? [mimAddr, usdcAddr] 
    : [usdcAddr, mimAddr];
  
  console.log(`   Token0: ${token0Usdc}`);
  console.log(`   Token1: ${token1Usdc}`);
  
  // Create pool with 0.3% fee
  let mimUsdcPool = await factory.getPool(token0Usdc, token1Usdc, FEE_TIERS.MEDIUM);
  if (mimUsdcPool === ethers.constants.AddressZero) {
    const tx = await factory.createPool(token0Usdc, token1Usdc, FEE_TIERS.MEDIUM);
    await tx.wait();
    mimUsdcPool = await factory.getPool(token0Usdc, token1Usdc, FEE_TIERS.MEDIUM);
  }
  deployedAddresses.mimUsdcPool = mimUsdcPool;
  console.log("   MIM/sUSDC Pool:", mimUsdcPool);
  
  // Initialize pool at 1:1 price (MIM 18 decimals, sUSDC 6 decimals)
  // Price = token1/token0
  // If MIM is token0 (18 dec) and sUSDC is token1 (6 dec):
  //   price = sUSDC/MIM = 1e6/1e18 = 1e-12
  //   sqrtPriceX96 = sqrt(1e-12) * 2^96 = 1e-6 * 2^96 = 79228162514264
  // If sUSDC is token0 (6 dec) and MIM is token1 (18 dec):
  //   price = MIM/sUSDC = 1e18/1e6 = 1e12
  //   sqrtPriceX96 = sqrt(1e12) * 2^96 = 1e6 * 2^96 = 79228162514264337593543950336000000
  
  const poolContract = await ethers.getContractAt(
    ["function initialize(uint160) external", 
     "function slot0() external view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)"],
    mimUsdcPool,
    deployer
  );
  
  try {
    const slot0 = await poolContract.slot0();
    console.log("   Pool already initialized, tick:", slot0[1]);
  } catch {
    // Pool not initialized, initialize it
    let sqrtPriceX96: ethers.BigNumber;
    
    if (mimAddr.toLowerCase() < usdcAddr.toLowerCase()) {
      // MIM is token0, sUSDC is token1
      // price = sUSDC/MIM = 1e6/1e18 = 1e-12 (for 1:1 dollar parity)
      // sqrtPrice = sqrt(1e-12) = 1e-6
      // sqrtPriceX96 = 1e-6 * 2^96 = 79228162514264
      sqrtPriceX96 = ethers.BigNumber.from("79228162514264");
    } else {
      // sUSDC is token0, MIM is token1
      // price = MIM/sUSDC = 1e18/1e6 = 1e12
      // sqrtPrice = sqrt(1e12) = 1e6
      // sqrtPriceX96 = 1e6 * 2^96
      sqrtPriceX96 = ethers.BigNumber.from("79228162514264337593543950336").mul(1e6);
    }
    
    const initTx = await poolContract.initialize(sqrtPriceX96);
    await initTx.wait();
    console.log("   Pool initialized at 1:1 price");
  }
  
  // Set pool on MIM contract
  const setPoolTx = await mim.setPool(mimUsdcPool);
  await setPoolTx.wait();
  console.log("   MIM pool set");
  
  // ============ 4. Create sWETH/MIM Pool ============
  console.log("\n4. Creating sWETH/MIM Pool...");
  
  const swethAddr = EXISTING_CONTRACTS.sWETH;
  const [token0Weth, token1Weth] = mimAddr.toLowerCase() < swethAddr.toLowerCase() 
    ? [mimAddr, swethAddr] 
    : [swethAddr, mimAddr];
  
  console.log(`   Token0: ${token0Weth}`);
  console.log(`   Token1: ${token1Weth}`);
  
  // Create pool with 0.05% fee (better for large trades)
  let swethMimPool = await factory.getPool(token0Weth, token1Weth, FEE_TIERS.LOW);
  if (swethMimPool === ethers.constants.AddressZero) {
    const tx = await factory.createPool(token0Weth, token1Weth, FEE_TIERS.LOW);
    await tx.wait();
    swethMimPool = await factory.getPool(token0Weth, token1Weth, FEE_TIERS.LOW);
  }
  deployedAddresses.swethMimPool = swethMimPool;
  console.log("   sWETH/MIM Pool:", swethMimPool);
  
  // Initialize pool at ~3000 MIM/sWETH price
  // Both tokens are 18 decimals
  // If MIM is token0 and sWETH is token1:
  //   price = sWETH/MIM = 1/3000 = 0.000333
  //   sqrtPriceX96 = sqrt(0.000333) * 2^96
  // If sWETH is token0 and MIM is token1:
  //   price = MIM/sWETH = 3000
  //   sqrtPriceX96 = sqrt(3000) * 2^96
  
  const swethPoolContract = await ethers.getContractAt(
    ["function initialize(uint160) external", 
     "function slot0() external view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)"],
    swethMimPool,
    deployer
  );
  
  try {
    const slot0 = await swethPoolContract.slot0();
    console.log("   Pool already initialized, tick:", slot0[1]);
  } catch {
    // Calculate sqrtPriceX96 for 3000 MIM/sWETH
    const Q96 = ethers.BigNumber.from(2).pow(96);
    let sqrtPriceX96: ethers.BigNumber;
    
    if (mimAddr.toLowerCase() < swethAddr.toLowerCase()) {
      // MIM is token0, sWETH is token1
      // price = sWETH/MIM = 1/3000 ≈ 0.000333
      // sqrtPrice = sqrt(0.000333) ≈ 0.01825
      // sqrtPriceX96 = 0.01825 * 2^96
      sqrtPriceX96 = Q96.mul(1825).div(100000); // 0.01825 as fraction
    } else {
      // sWETH is token0, MIM is token1
      // price = MIM/sWETH = 3000
      // sqrtPrice = sqrt(3000) ≈ 54.77
      // sqrtPriceX96 = 54.77 * 2^96
      sqrtPriceX96 = Q96.mul(5477).div(100); // 54.77 as fraction
    }
    
    const initTx = await swethPoolContract.initialize(sqrtPriceX96);
    await initTx.wait();
    console.log("   Pool initialized at 3000 MIM/sWETH");
  }
  
  // ============ 5. Deploy OracleAdapter ============
  console.log("\n5. Deploying OracleAdapter...");
  
  const OracleAdapter = await ethers.getContractFactory("contracts/0IL/core/OracleAdapter.sol:OracleAdapter");
  const oracleAdapter = await OracleAdapter.deploy(
    swethMimPool,  // V3 pool for TWAP
    1800           // 30 minute TWAP
  );
  await oracleAdapter.deployed();
  deployedAddresses.oracleAdapter = oracleAdapter.address;
  console.log("   OracleAdapter deployed to:", oracleAdapter.address);
  
  // ============ 6. Deploy V3LPVault ============
  console.log("\n6. Deploying V3LPVault...");
  
  const V3LPVault = await ethers.getContractFactory("contracts/0IL/core/V3LPVault.sol:V3LPVault");
  const v3LPVault = await V3LPVault.deploy(
    EXISTING_CONTRACTS.nonfungiblePositionManager,
    swethMimPool
  );
  await v3LPVault.deployed();
  deployedAddresses.v3LPVault = v3LPVault.address;
  console.log("   V3LPVault deployed to:", v3LPVault.address);
  
  // ============ 7. Deploy LeverageAMM ============
  console.log("\n7. Deploying LeverageAMM...");
  
  const LeverageAMM = await ethers.getContractFactory("contracts/0IL/core/LeverageAMM.sol:LeverageAMM");
  const leverageAMM = await LeverageAMM.deploy(
    EXISTING_CONTRACTS.sWETH,        // Underlying asset (sWETH)
    mim.address,                     // MIM token
    stakingVault.address,            // sMIM vault (debt source)
    v3LPVault.address,               // LP vault
    oracleAdapter.address            // Price oracle
  );
  await leverageAMM.deployed();
  deployedAddresses.leverageAMM = leverageAMM.address;
  console.log("   LeverageAMM deployed to:", leverageAMM.address);
  
  // ============ 8. Deploy WToken (wETH for zero-IL) ============
  console.log("\n8. Deploying WToken (wETH)...");
  
  const WToken = await ethers.getContractFactory("contracts/0IL/core/WToken.sol:WToken");
  const wETH = await WToken.deploy(
    "Zero-IL Wrapped ETH",
    "wETH",
    EXISTING_CONTRACTS.sWETH,        // Underlying is sWETH
    leverageAMM.address,             // LeverageAMM
    v3LPVault.address                // V3LPVault
  );
  await wETH.deployed();
  deployedAddresses.wETH = wETH.address;
  console.log("   WToken (wETH) deployed to:", wETH.address);
  
  // ============ 9. Configure Permissions ============
  console.log("\n9. Configuring permissions...");
  
  // Set LeverageAMM as minter on MIM
  await (await mim.setMinter(leverageAMM.address, ethers.constants.MaxUint256)).wait();
  console.log("   LeverageAMM set as MIM minter");
  
  // Set LeverageAMM as authorized on V3LPVault
  try {
    await (await v3LPVault.setAuthorized(leverageAMM.address, true)).wait();
    console.log("   LeverageAMM authorized on V3LPVault");
  } catch (e) {
    console.log("   V3LPVault authorization skipped (may not have this function)");
  }
  
  // ============ 10. Print Summary ============
  console.log("\n" + "=".repeat(60));
  console.log("0IL PROTOCOL v4 DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log("\nDeployed Addresses:");
  console.log(JSON.stringify(deployedAddresses, null, 2));
  
  console.log("\n--- Frontend Config Update ---");
  console.log(`
// Add to frontend/lib/contracts/config.ts (sonic.contracts):
mim: "${deployedAddresses.mim}",
stakingVault: "${deployedAddresses.stakingVault}",
mimUsdcPool: "${deployedAddresses.mimUsdcPool}",
swethMimPool: "${deployedAddresses.swethMimPool}",
oracleAdapter: "${deployedAddresses.oracleAdapter}",
v3LPVault: "${deployedAddresses.v3LPVault}",
leverageAMM: "${deployedAddresses.leverageAMM}",
wETH: "${deployedAddresses.wETH}",
  `);
  
  return deployedAddresses;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

