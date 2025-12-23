import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";
// Use ethers.utils.getAddress for proper checksum
const UNISWAP_FACTORY = "0x3a1713B6C3734cfC883A3897647f3128Fe789f39";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=== Deploy V2 Final ===\n");
  console.log("Deployer:", deployer.address);

  // 1. Deploy TestMIM
  console.log("\n1. Deploying TestMIM...");
  const TestMIM = await ethers.getContractFactory("TestMIM");
  const mim = await TestMIM.deploy({ gasLimit: 2_000_000 });
  await mim.deployed();
  console.log("   TestMIM:", mim.address);

  // 2. Create pool
  console.log("\n2. Creating sWETH/MIM pool...");
  const factory = new ethers.Contract(UNISWAP_FACTORY, [
    "function createPool(address,address,uint24) returns (address)",
    "function getPool(address,address,uint24) view returns (address)"
  ], deployer);
  
  const fee = 3000;
  
  // Check if pool exists first
  let pool = await factory.getPool(SWETH, mim.address, fee);
  if (pool === ethers.constants.AddressZero) {
    const createTx = await factory.createPool(SWETH, mim.address, fee, { gasLimit: 5_000_000 });
    await createTx.wait();
    pool = await factory.getPool(SWETH, mim.address, fee);
    
    // Initialize pool
    const poolContract = new ethers.Contract(pool, [
      "function initialize(uint160) external",
      "function token0() view returns (address)"
    ], deployer);
    
    const token0 = await poolContract.token0();
    const swethIsToken0 = token0.toLowerCase() === SWETH.toLowerCase();
    const sqrtPriceX96 = swethIsToken0 
      ? "4339505445853388212979503104"
      : "1443086784063406861091840";
    await (await poolContract.initialize(sqrtPriceX96)).wait();
    console.log("   Pool created and initialized:", pool);
  } else {
    console.log("   Pool exists:", pool);
  }

  // 3. Deploy SimpleOracle
  console.log("\n3. Deploying SimpleOracle...");
  const SimpleOracle = await ethers.getContractFactory("SimpleOracle");
  const oracle = await SimpleOracle.deploy(pool, { gasLimit: 2_000_000 });
  await oracle.deployed();
  console.log("   SimpleOracle:", oracle.address);

  // 4. Deploy MIMStakingVaultV2
  console.log("\n4. Deploying MIMStakingVaultV2...");
  const MIMStakingVaultV2 = await ethers.getContractFactory("MIMStakingVaultV2");
  const stakingVault = await MIMStakingVaultV2.deploy(mim.address, deployer.address, { gasLimit: 4_000_000 });
  await stakingVault.deployed();
  console.log("   MIMStakingVaultV2:", stakingVault.address);

  // 5. Deploy V3LPVault
  console.log("\n5. Deploying V3LPVault...");
  const V3LPVault = await ethers.getContractFactory("V3LPVault");
  const v3Vault = await V3LPVault.deploy(POSITION_MANAGER, pool, { gasLimit: 4_000_000 });
  await v3Vault.deployed();
  await (await v3Vault.setDefaultLayers({ gasLimit: 500000 })).wait();
  console.log("   V3LPVault:", v3Vault.address);

  // 6. Deploy LeverageAMMV2
  console.log("\n6. Deploying LeverageAMMV2...");
  const LeverageAMMV2 = await ethers.getContractFactory("LeverageAMMV2");
  const leverageAMM = await LeverageAMMV2.deploy(
    SWETH, mim.address, stakingVault.address, v3Vault.address, oracle.address,
    { gasLimit: 4_000_000 }
  );
  await leverageAMM.deployed();
  console.log("   LeverageAMMV2:", leverageAMM.address);

  // 7. Deploy WToken
  console.log("\n7. Deploying WToken...");
  const WToken = await ethers.getContractFactory("WToken");
  const wToken = await WToken.deploy(
    "Wagmi Zero-IL ETH V2", "wETH", SWETH, leverageAMM.address, v3Vault.address,
    { gasLimit: 3_000_000 }
  );
  await wToken.deployed();
  console.log("   WToken:", wToken.address);

  // 8. Configure
  console.log("\n8. Configuring...");
  await (await stakingVault.setBorrower(leverageAMM.address, true)).wait();
  await (await leverageAMM.setWToken(wToken.address)).wait();
  await (await leverageAMM.setTreasury(deployer.address)).wait();
  await (await v3Vault.setOperator(leverageAMM.address, true)).wait();
  console.log("   ✓ All configured");

  // 9. Seed liquidity
  console.log("\n9. Seeding liquidity...");
  await (await mim.mint(deployer.address, ethers.utils.parseEther("1000"), { gasLimit: 100000 })).wait();
  console.log("   ✓ Minted 1000 MIM");
  
  await (await mim.approve(stakingVault.address, ethers.utils.parseEther("500"))).wait();
  await (await stakingVault.deposit(ethers.utils.parseEther("500"), { gasLimit: 500000 })).wait();
  console.log("   ✓ Deposited 500 MIM to vault");
  console.log("   Vault cash:", ethers.utils.formatEther(await stakingVault.getCash()));

  // 10. Test deposit/withdraw
  console.log("\n10. Testing deposit/withdraw...");
  const sweth = new ethers.Contract(SWETH, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)"
  ], deployer);
  
  const swethBal = await sweth.balanceOf(deployer.address);
  console.log("   sWETH balance:", ethers.utils.formatEther(swethBal));
  
  if (swethBal.gt(ethers.utils.parseEther("0.0001"))) {
    const depositAmount = ethers.utils.parseEther("0.0001");
    await (await sweth.approve(wToken.address, depositAmount)).wait();
    
    try {
      await (await wToken.deposit(depositAmount, 0, { gasLimit: 2000000 })).wait();
      console.log("   ✓ Deposit succeeded! wETH:", ethers.utils.formatEther(await wToken.balanceOf(deployer.address)));
      
      const wethBal = await wToken.balanceOf(deployer.address);
      const swethBefore = await sweth.balanceOf(deployer.address);
      
      await (await wToken.withdraw(wethBal, 0, { gasLimit: 3000000 })).wait();
      console.log("   ✓ Withdraw succeeded! sWETH received:", 
        ethers.utils.formatEther((await sweth.balanceOf(deployer.address)).sub(swethBefore)));
    } catch (e: any) {
      console.log("   ✗ Test failed:", e.reason || e.message?.slice(0, 200));
    }
  }

  // Summary
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║             V2 DEPLOYMENT COMPLETE                         ║");
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
  
  console.log(JSON.stringify(addresses, null, 2));
}

main().catch(console.error);
