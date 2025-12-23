import { ethers } from "hardhat";

// Contract addresses from deployment
const ADDRESSES = {
  mim: "0xBeE5b0106d4DFc1AFcc9d105bd8dbeE3c4E53FA9",
  stakingVault: "0xcdAF377e386a491235Ba4c6021E648BeF2f58573",
  swethMimPool: "0x0cA7Fb576143EB5900205bd634798E0724d303c7",
  oracleAdapter: "0xC6b68711F3b4D43B1f32a6897FC5238bDBe7eC34",
  v3LPVault: "0x0d138451cE5E1d70966f5eFB891324Eb0C4c5243",
  leverageAMM: "0xEA7EC4745580235781f1E20202602d6D56510de5",
  wETH: "0xcab1b99679490663C55c4135B8736b3053A73AA0",
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  sUSDC: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B",
};

async function main() {
  console.log("\n========================================");
  console.log("0IL PROTOCOL BOOTSTRAP");
  console.log("========================================\n");

  const [deployer] = await ethers.getSigners();
  console.log(`Bootstrapping from: ${deployer.address}\n`);

  // Check sUSDC balance
  const sUSDC = await ethers.getContractAt("IERC20", ADDRESSES.sUSDC);
  const sUSDCBalance = await sUSDC.balanceOf(deployer.address);
  console.log(`sUSDC Balance: ${ethers.utils.formatUnits(sUSDCBalance, 6)}`);

  if (sUSDCBalance.eq(0)) {
    console.log("❌ No sUSDC available to bootstrap. Need sUSDC first.");
    return;
  }

  // Amount to use for bootstrapping (use 50% of balance, max 1000 sUSDC)
  const maxBootstrap = ethers.utils.parseUnits("1000", 6); // 1000 sUSDC
  const halfBalance = sUSDCBalance.div(2);
  const bootstrapAmount = halfBalance.lt(maxBootstrap) ? halfBalance : maxBootstrap;
  
  console.log(`Using ${ethers.utils.formatUnits(bootstrapAmount, 6)} sUSDC for bootstrap`);

  // 1. Approve MIM contract to spend sUSDC
  console.log("\n1. Approving MIM contract to spend sUSDC...");
  const mim = await ethers.getContractAt("MIM", ADDRESSES.mim);
  
  const currentAllowance = await sUSDC.allowance(deployer.address, ADDRESSES.mim);
  if (currentAllowance.lt(bootstrapAmount)) {
    const approveTx = await sUSDC.approve(ADDRESSES.mim, ethers.constants.MaxUint256);
    await approveTx.wait();
    console.log("   ✅ Approved");
  } else {
    console.log("   ✅ Already approved");
  }

  // 2. Mint MIM by depositing sUSDC (using mintWithSUSDC for 1:1 conversion)
  console.log("\n2. Minting MIM with sUSDC...");
  const mimBefore = await mim.balanceOf(deployer.address);
  console.log(`   MIM before: ${ethers.utils.formatUnits(mimBefore, 6)}`);
  
  try {
    // MIM uses mintWithSUSDC for 1:1 sUSDC -> MIM conversion
    const mintTx = await mim.mintWithSUSDC(bootstrapAmount);
    await mintTx.wait();
    
    const mimAfter = await mim.balanceOf(deployer.address);
    console.log(`   MIM after: ${ethers.utils.formatUnits(mimAfter, 6)}`);
    console.log("   ✅ Minted MIM successfully");
  } catch (error: any) {
    console.log(`   ❌ Mint failed: ${error.message || error}`);
    return;
  }

  // 3. Approve StakingVault to spend MIM
  console.log("\n3. Approving StakingVault to spend MIM...");
  const stakingVault = await ethers.getContractAt("MIMStakingVault", ADDRESSES.stakingVault);
  
  const mimAllowance = await mim.allowance(deployer.address, ADDRESSES.stakingVault);
  if (mimAllowance.lt(bootstrapAmount)) {
    const approveMimTx = await mim.approve(ADDRESSES.stakingVault, ethers.constants.MaxUint256);
    await approveMimTx.wait();
    console.log("   ✅ Approved");
  } else {
    console.log("   ✅ Already approved");
  }

  // 4. Deposit MIM to StakingVault (get sMIM)
  console.log("\n4. Depositing MIM to StakingVault...");
  const mimBalance = await mim.balanceOf(deployer.address);
  console.log(`   MIM to deposit: ${ethers.utils.formatUnits(mimBalance, 6)}`);
  
  try {
    // MIM has 6 decimals, sMIM also has 6 decimals
    const depositTx = await stakingVault.deposit(mimBalance);
    await depositTx.wait();
    
    const smimBalance = await stakingVault.balanceOf(deployer.address);
    console.log(`   sMIM received: ${ethers.utils.formatUnits(smimBalance, 6)}`);
    console.log("   ✅ Deposited to StakingVault");
  } catch (error: any) {
    console.log(`   ❌ Deposit failed: ${error.message || error}`);
    return;
  }

  // 5. Verify StakingVault now has liquidity
  console.log("\n5. Verifying StakingVault liquidity...");
  const cash = await stakingVault.getCash();
  console.log(`   Cash available for borrowing: ${ethers.utils.formatUnits(cash, 6)} MIM`);

  console.log("\n========================================");
  console.log("BOOTSTRAP COMPLETE");
  console.log("========================================\n");
  
  console.log("✅ The 0IL protocol now has MIM liquidity!");
  console.log("✅ Users can now deposit sWETH to get wETH tokens.");
  console.log("\nNext steps:");
  console.log("1. Test deposit of sWETH to wETH vault");
  console.log("2. Add initial liquidity to sWETH/MIM pool (for better TWAP)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

