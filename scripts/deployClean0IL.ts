import { ethers } from "hardhat";

// Existing infrastructure on Sonic
const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";
const FACTORY = "0x3a1713B6C3734cfC883A3897647f3128Fe789f39";
const sUSDC = "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B";
const sWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=== Clean 0IL Protocol Deployment ===");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.utils.formatEther(await deployer.getBalance()), "S\n");
  
  const deployed: Record<string, string> = {};
  
  // ============ Step 1: Deploy MIM Token ============
  console.log("1. Deploying MIM Token (full version with USDC backing)...");
  const MIM = await ethers.getContractFactory("MIM");
  const mim = await MIM.deploy(sUSDC, POSITION_MANAGER, { gasLimit: 5_000_000 });
  await mim.deployed();
  deployed.mim = mim.address;
  console.log("   ✓ MIM:", mim.address);
  
  // ============ Step 2: Create MIM/sUSDC Pool ============
  console.log("\n2. Creating MIM/sUSDC pool (0.01% fee)...");
  const factory = new ethers.Contract(FACTORY, [
    "function createPool(address,address,uint24) returns (address)",
    "function getPool(address,address,uint24) view returns (address)"
  ], deployer);
  
  let mimUsdcPool = await factory.getPool(sUSDC, mim.address, 100);
  if (mimUsdcPool === ethers.constants.AddressZero) {
    await (await factory.createPool(sUSDC, mim.address, 100, { gasLimit: 5_000_000 })).wait();
    mimUsdcPool = await factory.getPool(sUSDC, mim.address, 100);
  }
  deployed.mimUsdcPool = mimUsdcPool;
  console.log("   ✓ MIM/sUSDC Pool:", mimUsdcPool);
  
  // Initialize pool with correct price (1:1 accounting for decimals)
  // sUSDC (6 decimals) vs MIM (18 decimals)
  // Price = 1e12 (MIM per sUSDC when both are $1)
  // sqrtPriceX96 = sqrt(1e12) * 2^96 = 1e6 * 2^96 = 79228162514264337593543950336000000
  const pool = new ethers.Contract(mimUsdcPool, [
    "function initialize(uint160) external",
    "function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)",
    "function token0() view returns (address)"
  ], deployer);
  
  try {
    const token0 = await pool.token0();
    // If sUSDC is token0, price = MIM/sUSDC = 1e12
    // If MIM is token0, price = sUSDC/MIM = 1e-12
    const usdcIsToken0 = token0.toLowerCase() === sUSDC.toLowerCase();
    const sqrtPriceX96 = usdcIsToken0 
      ? "79228162514264337593543950336000000" // sqrt(1e12) * 2^96
      : "79228162514264"; // sqrt(1e-12) * 2^96
    
    await (await pool.initialize(sqrtPriceX96)).wait();
    console.log("   ✓ Pool initialized (sUSDC is token0:", usdcIsToken0, ")");
  } catch (e: any) {
    console.log("   Pool already initialized");
  }
  
  // Set pool in MIM contract
  await (await mim.setPool(mimUsdcPool)).wait();
  console.log("   ✓ Pool set in MIM contract");
  
  // ============ Step 3: Create sWETH/MIM Pool ============
  console.log("\n3. Creating sWETH/MIM pool (0.01% fee)...");
  let swethMimPool = await factory.getPool(sWETH, mim.address, 100);
  if (swethMimPool === ethers.constants.AddressZero) {
    await (await factory.createPool(sWETH, mim.address, 100, { gasLimit: 5_000_000 })).wait();
    swethMimPool = await factory.getPool(sWETH, mim.address, 100);
  }
  deployed.swethMimPool = swethMimPool;
  console.log("   ✓ sWETH/MIM Pool:", swethMimPool);
  
  // Initialize with correct price (~3000 MIM per sWETH)
  const swethPool = new ethers.Contract(swethMimPool, [
    "function initialize(uint160) external",
    "function token0() view returns (address)"
  ], deployer);
  
  try {
    const token0 = await swethPool.token0();
    const swethIsToken0 = token0.toLowerCase() === sWETH.toLowerCase();
    // For 3000 MIM per sWETH:
    // sqrtPriceX96 = sqrt(3000) * 2^96 = 4339505179874779672736325173248
    const sqrtPriceX96 = swethIsToken0 
      ? "4339505179874779672736325173248"  // sqrt(3000) * 2^96
      : "1448501726624926557578775057"; // sqrt(1/3000) * 2^96
    
    await (await swethPool.initialize(sqrtPriceX96)).wait();
    console.log("   ✓ Pool initialized at ~3000 MIM/sWETH (sWETH is token0:", swethIsToken0, ")");
  } catch (e: any) {
    console.log("   Pool already initialized");
  }
  
  // ============ Step 4: Deploy MIMStakingVaultV2 ============
  console.log("\n4. Deploying MIMStakingVaultV2...");
  const StakingVault = await ethers.getContractFactory("MIMStakingVaultV2");
  const stakingVault = await StakingVault.deploy(mim.address, deployer.address, { gasLimit: 5_000_000 });
  await stakingVault.deployed();
  deployed.stakingVault = stakingVault.address;
  console.log("   ✓ MIMStakingVaultV2:", stakingVault.address);
  
  // ============ Step 5: Deploy SimpleOracle ============
  console.log("\n5. Deploying SimpleOracle...");
  const SimpleOracle = await ethers.getContractFactory("SimpleOracle");
  const oracle = await SimpleOracle.deploy(swethMimPool, { gasLimit: 2_000_000 });
  await oracle.deployed();
  deployed.oracle = oracle.address;
  console.log("   ✓ SimpleOracle:", oracle.address);
  
  // ============ Step 6: Deploy V3LPVault ============
  console.log("\n6. Deploying V3LPVault...");
  const V3LPVault = await ethers.getContractFactory("V3LPVault");
  const v3Vault = await V3LPVault.deploy(POSITION_MANAGER, swethMimPool, { gasLimit: 5_000_000 });
  await v3Vault.deployed();
  deployed.v3Vault = v3Vault.address;
  console.log("   ✓ V3LPVault:", v3Vault.address);
  
  // Set default layers
  await (await v3Vault.setDefaultLayers({ gasLimit: 500000 })).wait();
  console.log("   ✓ Default layers set");
  
  // ============ Step 7: Deploy LeverageAMMV2 ============
  console.log("\n7. Deploying LeverageAMMV2...");
  const LeverageAMM = await ethers.getContractFactory("LeverageAMMV2");
  const leverageAMM = await LeverageAMM.deploy(
    sWETH,
    mim.address,
    stakingVault.address,
    v3Vault.address,
    oracle.address,
    { gasLimit: 5_000_000 }
  );
  await leverageAMM.deployed();
  deployed.leverageAMM = leverageAMM.address;
  console.log("   ✓ LeverageAMMV2:", leverageAMM.address);
  
  // ============ Step 8: Deploy WToken ============
  console.log("\n8. Deploying WToken...");
  const WToken = await ethers.getContractFactory("WToken");
  const wToken = await WToken.deploy(
    "Wagmi Zero-IL ETH", 
    "wETH",
    sWETH,
    leverageAMM.address,
    v3Vault.address,
    { gasLimit: 5_000_000 }
  );
  await wToken.deployed();
  deployed.wToken = wToken.address;
  console.log("   ✓ WToken:", wToken.address);
  
  // ============ Step 9: Deploy HubRescuer ============
  console.log("\n9. Deploying HubRescuer...");
  const HubRescuer = await ethers.getContractFactory("HubRescuer");
  const hubRescuer = await HubRescuer.deploy(HUB, { gasLimit: 2_000_000 });
  await hubRescuer.deployed();
  deployed.hubRescuer = hubRescuer.address;
  console.log("   ✓ HubRescuer:", hubRescuer.address);
  
  // ============ Step 10: Configure All Contracts ============
  console.log("\n10. Configuring contracts...");
  
  // Set borrower in StakingVault
  await (await stakingVault.setBorrower(leverageAMM.address, true)).wait();
  console.log("   ✓ LeverageAMM authorized as borrower");
  
  // Set wToken in LeverageAMM
  await (await leverageAMM.setWToken(wToken.address)).wait();
  console.log("   ✓ WToken set in LeverageAMM");
  
  // Set treasury
  await (await leverageAMM.setTreasury(deployer.address)).wait();
  console.log("   ✓ Treasury set");
  
  // Set operator in V3LPVault
  await (await v3Vault.setOperator(leverageAMM.address, true)).wait();
  console.log("   ✓ LeverageAMM authorized as V3LPVault operator");
  
  // ============ Step 11: Seed Initial Liquidity ============
  console.log("\n11. Seeding initial liquidity...");
  
  // Mint MIM as owner for testing (using authorized minter pattern)
  await (await mim.setMinter(deployer.address, ethers.utils.parseEther("10000"))).wait();
  await (await mim.mint(deployer.address, ethers.utils.parseEther("1000"))).wait();
  console.log("   ✓ Minted 1000 MIM for initial liquidity");
  
  // Deposit some MIM to staking vault
  await (await mim.approve(stakingVault.address, ethers.constants.MaxUint256)).wait();
  await (await stakingVault.deposit(ethers.utils.parseEther("500"))).wait();
  console.log("   ✓ Deposited 500 MIM to StakingVault");
  
  // ============ Summary ============
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT COMPLETE!");
  console.log("=".repeat(60));
  console.log(JSON.stringify(deployed, null, 2));
  
  console.log("\n=== Frontend Config ===");
  console.log(`
Update frontend/lib/contracts/config.ts:
  mim: "${deployed.mim}",
  stakingVault: "${deployed.stakingVault}",
  mimUsdcPool: "${deployed.mimUsdcPool}",
  swethMimPool: "${deployed.swethMimPool}",
  oracleAdapter: "${deployed.oracle}",
  v3LPVault: "${deployed.v3Vault}",
  leverageAMM: "${deployed.leverageAMM}",
  wETH: "${deployed.wToken}",
`);
}

main().catch(console.error);

