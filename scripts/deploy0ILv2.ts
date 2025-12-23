/**
 * Deploy 0IL V2 - Fixed Contracts with TestMIM
 * 
 * Deploys:
 * - TestMIM (simple MIM with owner mint)
 * - MIMStakingVaultV2 (sMIM with partial withdrawal fix)
 * - LeverageAMMV2 (with weekly payment init and repayDirect fix)
 * - SimpleOracle
 * - V3LPVault
 * - WToken (wETH)
 */

import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";
const UNISWAP_FACTORY = "0x5ba75c681Fe06fAA1AEBE838BF7aa79169fd7F4A";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║         0IL V2 DEPLOYMENT - FIXED + TEST MIM               ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`\nDeployer: ${deployer.address}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  // ============ 1. Deploy TestMIM ============
  console.log("1. Deploying TestMIM...");
  const TestMIM = await ethers.getContractFactory("TestMIM");
  const mim = await TestMIM.deploy({ gasLimit: 2_000_000 });
  await mim.deployed();
  console.log(`   ✅ TestMIM: ${mim.address}`);

  // ============ 2. Create sWETH/MIM Pool ============
  console.log("\n2. Creating sWETH/MIM pool...");
  const factory = new ethers.Contract(UNISWAP_FACTORY, [
    "function createPool(address,address,uint24) returns (address)",
    "function getPool(address,address,uint24) view returns (address)"
  ], deployer);
  
  let pool;
  const fee = 3000; // 0.3%
  const existingPool = await factory.getPool(SWETH, mim.address, fee);
  
  if (existingPool !== ethers.constants.AddressZero) {
    pool = existingPool;
    console.log(`   Pool already exists: ${pool}`);
  } else {
    const tx = await factory.createPool(SWETH, mim.address, fee, { gasLimit: 5_000_000 });
    const receipt = await tx.wait();
    pool = await factory.getPool(SWETH, mim.address, fee);
    console.log(`   ✅ Pool created: ${pool}`);
    
    // Initialize pool at ~3000 MIM per sWETH
    const poolContract = new ethers.Contract(pool, [
      "function initialize(uint160) external",
      "function token0() view returns (address)"
    ], deployer);
    
    const token0 = await poolContract.token0();
    const swethIsToken0 = token0.toLowerCase() === SWETH.toLowerCase();
    
    // sqrtPriceX96 for 3000 MIM/sWETH
    // If sWETH is token0: price = MIM/sWETH = 3000, sqrtPrice = sqrt(3000) * 2^96
    // If MIM is token0: price = sWETH/MIM = 1/3000, sqrtPrice = sqrt(1/3000) * 2^96
    const sqrtPriceX96 = swethIsToken0 
      ? "4339505445853388212979503104" // ~3000 (sWETH is token0)
      : "1443086784063406861091840"; // ~1/3000 (MIM is token0)
    
    await (await poolContract.initialize(sqrtPriceX96, { gasLimit: 500000 })).wait();
    console.log(`   ✅ Pool initialized (sWETH is token0: ${swethIsToken0})`);
  }

  // ============ 3. Deploy SimpleOracle ============
  console.log("\n3. Deploying SimpleOracle...");
  const SimpleOracle = await ethers.getContractFactory("SimpleOracle");
  const oracle = await SimpleOracle.deploy(pool, { gasLimit: 2_000_000 });
  await oracle.deployed();
  console.log(`   ✅ SimpleOracle: ${oracle.address}`);

  // ============ 4. Deploy MIMStakingVaultV2 ============
  console.log("\n4. Deploying MIMStakingVaultV2...");
  const MIMStakingVaultV2 = await ethers.getContractFactory("MIMStakingVaultV2");
  const stakingVault = await MIMStakingVaultV2.deploy(mim.address, deployer.address, { gasLimit: 4_000_000 });
  await stakingVault.deployed();
  console.log(`   ✅ MIMStakingVaultV2: ${stakingVault.address}`);

  // ============ 5. Deploy V3LPVault ============
  console.log("\n5. Deploying V3LPVault...");
  const V3LPVault = await ethers.getContractFactory("V3LPVault");
  const v3Vault = await V3LPVault.deploy(POSITION_MANAGER, pool, { gasLimit: 4_000_000 });
  await v3Vault.deployed();
  console.log(`   ✅ V3LPVault: ${v3Vault.address}`);
  
  await (await v3Vault.setDefaultLayers({ gasLimit: 500000 })).wait();
  console.log("   ✅ Default layers set");

  // ============ 6. Deploy LeverageAMMV2 ============
  console.log("\n6. Deploying LeverageAMMV2...");
  const LeverageAMMV2 = await ethers.getContractFactory("LeverageAMMV2");
  const leverageAMM = await LeverageAMMV2.deploy(
    SWETH, mim.address, stakingVault.address, v3Vault.address, oracle.address,
    { gasLimit: 4_000_000 }
  );
  await leverageAMM.deployed();
  console.log(`   ✅ LeverageAMMV2: ${leverageAMM.address}`);

  // ============ 7. Deploy WToken ============
  console.log("\n7. Deploying WToken...");
  const WToken = await ethers.getContractFactory("WToken");
  const wToken = await WToken.deploy(
    "Wagmi Zero-IL ETH V2", "wETH", SWETH, leverageAMM.address, v3Vault.address,
    { gasLimit: 3_000_000 }
  );
  await wToken.deployed();
  console.log(`   ✅ WToken: ${wToken.address}`);

  // ============ 8. Configure ============
  console.log("\n8. Configuring contracts...");
  await (await stakingVault.setBorrower(leverageAMM.address, true)).wait();
  await (await leverageAMM.setWToken(wToken.address)).wait();
  await (await leverageAMM.setTreasury(deployer.address)).wait();
  await (await v3Vault.setOperator(leverageAMM.address, true)).wait();
  console.log("   ✅ All configured");

  // ============ 9. Seed Liquidity ============
  console.log("\n9. Seeding liquidity...");
  
  // Mint 1000 MIM
  await (await mim.mint(deployer.address, ethers.utils.parseEther("1000"))).wait();
  console.log("   ✅ Minted 1000 MIM");
  
  // Deposit 500 MIM to StakingVault
  await (await mim.approve(stakingVault.address, ethers.utils.parseEther("500"))).wait();
  await (await stakingVault.deposit(ethers.utils.parseEther("500"), { gasLimit: 500000 })).wait();
  console.log("   ✅ Deposited 500 MIM to StakingVault");
  
  const vaultCash = await stakingVault.getCash();
  console.log(`   StakingVault cash: ${ethers.utils.formatEther(vaultCash)} MIM`);

  // ============ Summary ============
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                 0IL V2 DEPLOYMENT COMPLETE                 ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");
  
  const addresses = {
    mim: mim.address,
    stakingVault: stakingVault.address,
    pool: pool,
    oracle: oracle.address,
    v3Vault: v3Vault.address,
    leverageAMM: leverageAMM.address,
    wToken: wToken.address
  };
  
  console.log("Addresses:");
  console.log(JSON.stringify(addresses, null, 2));
  
  return addresses;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
