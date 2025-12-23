import { ethers } from "hardhat";

/**
 * Deploy 0IL Protocol v2
 * - MIM: 18 decimals, auto-LP creation in MIM/sUSDC pool
 * - MIMStakingVault: sMIM vault for earning interest
 * - V3LPVault: Multi-layer Curve-style LP management
 * - OracleAdapter: TWAP oracle for sWETH/MIM
 * - LeverageAMM: 2x leverage engine
 * - WToken: wETH receipt token for zero-IL positions
 */

// Existing contract addresses on Sonic
const SUSDC_ADDRESS = "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B";
const SWETH_ADDRESS = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const SWBTC_ADDRESS = "0x2F0324268031E6413280F3B5ddBc4A97639A284a";
const UNISWAP_V3_FACTORY = "0x3a1713B6C3734cfC883A3897647f3128Fe789f39";
const NONFUNGIBLE_POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("\n========================================");
  console.log("DEPLOYING 0IL PROTOCOL v2");
  console.log("========================================\n");
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(await ethers.provider.getBalance(deployer.address))} S`);

  // --- 1. Deploy MIM (18 decimals, with LP integration) ---
  console.log("\n1. Deploying MIM (18 decimals, auto-LP)...");
  const MIM = await ethers.getContractFactory("MIM");
  const mim = await MIM.deploy(SUSDC_ADDRESS, NONFUNGIBLE_POSITION_MANAGER);
  await mim.deployed();
  console.log(`   ✅ MIM deployed to: ${mim.address}`);

  // --- 2. Deploy MIMStakingVault (sMIM) ---
  console.log("\n2. Deploying MIMStakingVault (sMIM)...");
  const MIMStakingVault = await ethers.getContractFactory("MIMStakingVault");
  const stakingVault = await MIMStakingVault.deploy(mim.address, deployer.address);
  await stakingVault.deployed();
  console.log(`   ✅ MIMStakingVault deployed to: ${stakingVault.address}`);

  // --- 3. Create MIM/sUSDC V3 Pool (for MIM peg) ---
  console.log("\n3. Creating MIM/sUSDC pool (for peg stability)...");
  const factory = await ethers.getContractAt("contracts/testHelp/interfaces/IMinimalUniswapV3Factory.sol:IUniswapV3Factory", UNISWAP_V3_FACTORY);
  
  let mimUsdcPoolAddress = await factory.getPool(mim.address, SUSDC_ADDRESS, 500); // 0.05% fee tier for stables
  
  if (mimUsdcPoolAddress === ethers.constants.AddressZero) {
    console.log("   Creating MIM/sUSDC pool (0.05% fee tier)...");
    const createPoolTx = await factory.createPool(mim.address, SUSDC_ADDRESS, 500);
    const receipt = await createPoolTx.wait();
    
    // Find PoolCreated event
    const poolCreatedEvent = receipt.events?.find((e: any) => e.event === 'PoolCreated');
    if (poolCreatedEvent && poolCreatedEvent.args) {
      mimUsdcPoolAddress = poolCreatedEvent.args.pool;
    } else {
      mimUsdcPoolAddress = await factory.getPool(mim.address, SUSDC_ADDRESS, 500);
    }
    console.log(`   ✅ MIM/sUSDC pool created at: ${mimUsdcPoolAddress}`);
    
    // Initialize pool at 1:1 peg (MIM 18 decimals, sUSDC 6 decimals)
    // For token0=sUSDC, token1=MIM: price = MIM/sUSDC = 1e18/1e6 = 1e12
    // sqrtPriceX96 = sqrt(1e12) * 2^96 = 1e6 * 2^96
    const pool = await ethers.getContractAt("contracts/testHelp/interfaces/IMinimalUniswapV3Pool.sol:IUniswapV3Pool", mimUsdcPoolAddress);
    const token0 = await pool.token0();
    
    let sqrtPriceX96;
    if (token0.toLowerCase() === SUSDC_ADDRESS.toLowerCase()) {
      // token0 = sUSDC, token1 = MIM
      // price = MIM/sUSDC (in raw terms) = 1e18/1e6 = 1e12
      sqrtPriceX96 = ethers.BigNumber.from("79228162514264337593543950336000000"); // sqrt(1e12) * 2^96
    } else {
      // token0 = MIM, token1 = sUSDC  
      // price = sUSDC/MIM = 1e6/1e18 = 1e-12
      sqrtPriceX96 = ethers.BigNumber.from("79228162514264"); // sqrt(1e-12) * 2^96
    }
    
    try {
      const initPoolTx = await pool.initialize(sqrtPriceX96);
      await initPoolTx.wait();
      console.log("   ✅ Pool initialized at 1:1 peg");
    } catch (e: any) {
      console.log(`   ⚠️ Pool init skipped (will init with first mint): ${e.message?.slice(0, 50)}`);
    }
  } else {
    console.log(`   MIM/sUSDC pool already exists at: ${mimUsdcPoolAddress}`);
  }
  
  // Set pool in MIM contract
  console.log("   Setting pool in MIM contract...");
  const setPoolTx = await mim.setPool(mimUsdcPoolAddress);
  await setPoolTx.wait();
  console.log("   ✅ Pool set in MIM contract");

  // --- 4. Create sWETH/MIM V3 Pool (for 0IL vaults) ---
  console.log("\n4. Creating sWETH/MIM pool (for 0IL)...");
  // Using 0.3% fee tier (3000) - standard for volatile pairs
  let swethMimPoolAddress = await factory.getPool(SWETH_ADDRESS, mim.address, 3000); // 0.3% fee tier
  
  if (swethMimPoolAddress === ethers.constants.AddressZero) {
    console.log("   Creating sWETH/MIM pool (0.3% fee tier)...");
    const createPoolTx = await factory.createPool(SWETH_ADDRESS, mim.address, 3000);
    await createPoolTx.wait();
    
    // Wait a bit for state to propagate, then get pool address
    await new Promise(resolve => setTimeout(resolve, 2000));
    swethMimPoolAddress = await factory.getPool(SWETH_ADDRESS, mim.address, 3000);
    
    if (swethMimPoolAddress === ethers.constants.AddressZero) {
      throw new Error("Failed to create sWETH/MIM pool - got zero address after create");
    }
    
    console.log(`   ✅ sWETH/MIM pool created at: ${swethMimPoolAddress}`);
    
    // Initialize pool at ~3000 MIM per sWETH
    // sqrtPriceX96 = sqrt(price) * 2^96
    // For 3000 MIM per sWETH: sqrt(3000) * 2^96 ≈ 4.339e48
    const pool = await ethers.getContractAt("contracts/testHelp/interfaces/IMinimalUniswapV3Pool.sol:IUniswapV3Pool", swethMimPoolAddress);
    const token0 = await pool.token0();
    
    let sqrtPriceX96;
    // 2^96 = 79228162514264337593543950336
    // For 3000 MIM per sWETH:
    //   sqrt(3000) = 54.772255750516612
    //   sqrt(1/3000) = 0.018257418583505536
    if (token0.toLowerCase() === SWETH_ADDRESS.toLowerCase()) {
      // token0 = sWETH, token1 = MIM  
      // price = MIM/sWETH = 3000
      // sqrtPriceX96 = sqrt(3000) * 2^96 = 4339533621839104296108967988122
      sqrtPriceX96 = ethers.BigNumber.from("4339533621839104296108967988122");
    } else {
      // token0 = MIM, token1 = sWETH  
      // price = sWETH/MIM = 1/3000 = 0.000333...
      // sqrtPriceX96 = sqrt(1/3000) * 2^96 = 1446837612412420668315048649
      sqrtPriceX96 = ethers.BigNumber.from("1446837612412420668315048649");
    }
    
    try {
      const initPoolTx = await pool.initialize(sqrtPriceX96);
      await initPoolTx.wait();
      console.log("   ✅ Pool initialized at ~3000 MIM per sWETH");
    } catch (e: any) {
      if (e.message.includes("AI")) {
        console.log("   Pool already initialized");
      } else {
        console.log(`   ⚠️ Pool initialization failed: ${e.message}`);
      }
    }
  } else {
    console.log(`   sWETH/MIM pool already exists at: ${swethMimPoolAddress}`);
  }

  // --- 5. Deploy OracleAdapter ---
  console.log("\n5. Deploying OracleAdapter...");
  const OracleAdapter = await ethers.getContractFactory("OracleAdapter");
  const oracleAdapter = await OracleAdapter.deploy(swethMimPoolAddress, 900); // 15 min TWAP
  await oracleAdapter.deployed();
  console.log(`   ✅ OracleAdapter deployed to: ${oracleAdapter.address}`);
  
  // Set invertPrice=true since sWETH is token1 in the pool
  // This makes getPrice() return MIM per sWETH instead of sWETH per MIM
  console.log("   Setting invertPrice=true (sWETH is token1)...");
  const pool = await ethers.getContractAt("contracts/testHelp/interfaces/IMinimalUniswapV3Pool.sol:IUniswapV3Pool", swethMimPoolAddress);
  const token0 = await pool.token0();
  if (token0.toLowerCase() !== SWETH_ADDRESS.toLowerCase()) {
    // sWETH is token1, so we need to invert
    await (await oracleAdapter.setInvertPrice(true)).wait();
    console.log("   ✅ Price inversion enabled (returns MIM per sWETH)");
  } else {
    console.log("   ✅ No inversion needed (sWETH is token0)");
  }

  // --- 6. Deploy V3LPVault ---
  console.log("\n6. Deploying V3LPVault...");
  const V3LPVault = await ethers.getContractFactory("V3LPVault");
  const v3LPVault = await V3LPVault.deploy(NONFUNGIBLE_POSITION_MANAGER, swethMimPoolAddress);
  await v3LPVault.deployed();
  console.log(`   ✅ V3LPVault deployed to: ${v3LPVault.address}`);
  
  console.log("   Setting default Curve-style layers...");
  const setLayersTx = await v3LPVault.setDefaultLayers();
  await setLayersTx.wait();
  console.log("   ✅ Default layers configured (±0.5%, ±1%, ±2%, ±5%)");

  // --- 7. Deploy LeverageAMM ---
  console.log("\n7. Deploying LeverageAMM...");
  const LeverageAMM = await ethers.getContractFactory("LeverageAMM");
  const leverageAMM = await LeverageAMM.deploy(
    SWETH_ADDRESS,
    mim.address,
    stakingVault.address,
    v3LPVault.address,
    oracleAdapter.address
  );
  await leverageAMM.deployed();
  console.log(`   ✅ LeverageAMM deployed to: ${leverageAMM.address}`);
  
  console.log("   Setting treasury...");
  await (await leverageAMM.setTreasury(deployer.address)).wait();
  console.log("   ✅ Treasury set to deployer");

  // --- 8. Deploy WToken (wETH) ---
  console.log("\n8. Deploying WToken (wETH for 0IL)...");
  const WToken = await ethers.getContractFactory("WToken");
  const wETH = await WToken.deploy(
    "Wrapped ETH (0IL)",
    "wETH",
    SWETH_ADDRESS,
    leverageAMM.address,
    v3LPVault.address
  );
  await wETH.deployed();
  console.log(`   ✅ WToken (wETH) deployed to: ${wETH.address}`);

  // --- 9. Wire contracts together ---
  console.log("\n9. Wiring contracts together...");
  
  console.log("   Setting WToken in LeverageAMM...");
  await (await leverageAMM.setWToken(wETH.address)).wait();
  console.log("   ✅ WToken set");
  
  console.log("   Setting LeverageAMM as V3LPVault operator...");
  await (await v3LPVault.setOperator(leverageAMM.address, true)).wait();
  console.log("   ✅ LeverageAMM authorized as operator");
  
  console.log("   Setting LeverageAMM as StakingVault borrower...");
  await (await stakingVault.setBorrower(leverageAMM.address, true)).wait();
  console.log("   ✅ LeverageAMM authorized as borrower");

  // --- 10. Set MIM minter for StakingVault (for interest) ---
  console.log("\n10. Setting MIM minter allowance for StakingVault...");
  const minterAllowance = ethers.utils.parseUnits("1000000000", 18); // 1B MIM
  await (await mim.setMinter(stakingVault.address, minterAllowance)).wait();
  console.log("   ✅ StakingVault authorized as MIM minter");

  console.log("\n========================================");
  console.log("0IL PROTOCOL v2 DEPLOYMENT COMPLETE");
  console.log("========================================\n");

  const addresses = {
    mim: mim.address,
    stakingVault: stakingVault.address,
    mimUsdcPool: mimUsdcPoolAddress,
    swethMimPool: swethMimPoolAddress,
    oracleAdapter: oracleAdapter.address,
    v3LPVault: v3LPVault.address,
    leverageAMM: leverageAMM.address,
    wETH: wETH.address,
  };

  console.log("Contract Addresses:");
  console.log("─────────────────────────────────────────");
  console.log(`MIM (18 decimals):       ${mim.address}`);
  console.log(`MIMStakingVault (sMIM):  ${stakingVault.address}`);
  console.log(`MIM/sUSDC Pool (peg):    ${mimUsdcPoolAddress}`);
  console.log(`sWETH/MIM Pool (0IL):    ${swethMimPoolAddress}`);
  console.log(`OracleAdapter:           ${oracleAdapter.address}`);
  console.log(`V3LPVault:               ${v3LPVault.address}`);
  console.log(`LeverageAMM:             ${leverageAMM.address}`);
  console.log(`WToken (wETH):           ${wETH.address}`);
  console.log("─────────────────────────────────────────");

  console.log("\n📋 Next Steps:");
  console.log("1. Mint MIM by depositing sUSDC (creates LP in MIM/sUSDC pool)");
  console.log("2. Stake MIM to get sMIM");
  console.log("3. Deposit sWETH to get wETH (zero-IL tokens)");
  console.log("4. Update frontend config with new addresses");

  console.log("\n📝 Addresses for config.ts:");
  console.log(JSON.stringify(addresses, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

