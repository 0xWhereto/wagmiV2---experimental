import { ethers } from "hardhat";

const CORRECT_POOL = "0xf86E66E4FC1BB30594b9B2134175529fC075d3b1";
const MIM = "0x9dEb5301967DD118D9F37181EB971d1136a72635";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const STAKING_VAULT = "0xdeF5851B6C14559c47bf7cC98BACBeC9D31eb968";
const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=== Redeploy V2 Components with Correct Pool ===\n");
  
  // 1. Deploy new SimpleOracle
  console.log("1. Deploying SimpleOracle...");
  const SimpleOracle = await ethers.getContractFactory("SimpleOracle");
  const oracle = await SimpleOracle.deploy(CORRECT_POOL, { gasLimit: 2_000_000 });
  await oracle.deployed();
  console.log("   ✓ SimpleOracle:", oracle.address);
  
  // Verify price
  const price = await oracle.getPrice();
  console.log("   Price:", ethers.utils.formatEther(price), "MIM per sWETH");
  
  // 2. Deploy new V3LPVault
  console.log("\n2. Deploying V3LPVault...");
  const V3LPVault = await ethers.getContractFactory("V3LPVault");
  const v3Vault = await V3LPVault.deploy(POSITION_MANAGER, CORRECT_POOL, { gasLimit: 4_000_000 });
  await v3Vault.deployed();
  console.log("   ✓ V3LPVault:", v3Vault.address);
  
  await (await v3Vault.setDefaultLayers({ gasLimit: 500000 })).wait();
  console.log("   ✓ Default layers set");
  
  // 3. Deploy new LeverageAMMV2
  console.log("\n3. Deploying LeverageAMMV2...");
  const LeverageAMMV2 = await ethers.getContractFactory("LeverageAMMV2");
  const leverageAMM = await LeverageAMMV2.deploy(
    SWETH, MIM, STAKING_VAULT, v3Vault.address, oracle.address,
    { gasLimit: 4_000_000 }
  );
  await leverageAMM.deployed();
  console.log("   ✓ LeverageAMMV2:", leverageAMM.address);
  
  // 4. Deploy new WToken
  console.log("\n4. Deploying WToken...");
  const WToken = await ethers.getContractFactory("WToken");
  const wToken = await WToken.deploy(
    "Wagmi Zero-IL ETH V2", "wETH", SWETH, leverageAMM.address, v3Vault.address,
    { gasLimit: 3_000_000 }
  );
  await wToken.deployed();
  console.log("   ✓ WToken:", wToken.address);
  
  // 5. Configure
  console.log("\n5. Configuring...");
  const stakingVault = (await ethers.getContractFactory("MIMStakingVaultV2")).attach(STAKING_VAULT);
  
  await (await stakingVault.setBorrower(leverageAMM.address, true)).wait();
  await (await leverageAMM.setWToken(wToken.address)).wait();
  await (await leverageAMM.setTreasury(deployer.address)).wait();
  await (await v3Vault.setOperator(leverageAMM.address, true)).wait();
  console.log("   ✓ All configured");
  
  // 6. Test deposit
  console.log("\n6. Testing deposit...");
  const sweth = new ethers.Contract(SWETH, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)"
  ], deployer);
  
  const depositAmount = ethers.utils.parseEther("0.0001");
  await (await sweth.approve(wToken.address, depositAmount)).wait();
  
  try {
    const tx = await wToken.deposit(depositAmount, 0, { gasLimit: 2000000 });
    await tx.wait();
    console.log("   ✓ Deposit succeeded!");
    console.log("   wETH balance:", ethers.utils.formatEther(await wToken.balanceOf(deployer.address)));
    
    // Test withdrawal
    console.log("\n7. Testing withdrawal...");
    const wethBal = await wToken.balanceOf(deployer.address);
    const swethBefore = await sweth.balanceOf(deployer.address);
    
    const tx2 = await wToken.withdraw(wethBal, 0, { gasLimit: 3000000 });
    await tx2.wait();
    console.log("   ✓ Withdrawal succeeded!");
    const swethAfter = await sweth.balanceOf(deployer.address);
    console.log("   sWETH received:", ethers.utils.formatEther(swethAfter.sub(swethBefore)));
    
    console.log("\n✅ V2 FULLY WORKING!");
    
  } catch (e: any) {
    console.log("   ✗ Failed:", e.reason || e.message?.slice(0, 200));
  }
  
  console.log("\n=== Final V2 Addresses ===");
  console.log(JSON.stringify({
    mim: MIM,
    stakingVault: STAKING_VAULT,
    pool: CORRECT_POOL,
    oracle: oracle.address,
    v3Vault: v3Vault.address,
    leverageAMM: leverageAMM.address,
    wToken: wToken.address
  }, null, 2));
}
main().catch(console.error);
