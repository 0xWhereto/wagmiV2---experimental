import { ethers } from "hardhat";

// v2 Contract Addresses (FINAL Deployment with correct oracle)
const MIM_ADDRESS = "0x0462c2926DCb2e80891Bf31d28383C9b63bEcF8D";
const STAKING_VAULT_ADDRESS = "0x5E0453350dA7F94259FA84BcF140606A2e86706B";
const SWETH_ADDRESS = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const WETH_TOKEN_ADDRESS = "0xc76a818e2e3B198aDe9766c3319981b657840758"; // NEW - fixed token ordering
const LEVERAGE_AMM_ADDRESS = "0x8b4a77F392c197F91c6f43fd173b92371b522a39"; // NEW - fixed token ordering
const ORACLE_ADDRESS = "0x7C431B67d912a7a4937c936d17fAE30A6003Be37";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`\n========================================`);
  console.log(`0IL Protocol v2 Full Flow Test`);
  console.log(`========================================\n`);
  console.log(`Wallet: ${deployer.address}`);

  const mim = await ethers.getContractAt("MIM", MIM_ADDRESS);
  const stakingVault = await ethers.getContractAt("MIMStakingVault", STAKING_VAULT_ADDRESS);
  const sWETH = await ethers.getContractAt("IERC20", SWETH_ADDRESS);
  const wETH = await ethers.getContractAt("WToken", WETH_TOKEN_ADDRESS);
  const oracle = await ethers.getContractAt("OracleAdapter", ORACLE_ADDRESS);

  // 1. Check MIM balance
  const mimBalance = await mim.balanceOf(deployer.address);
  console.log(`\n1. Current MIM Balance: ${ethers.utils.formatUnits(mimBalance, 18)}`);

  // 2. Stake MIM to get sMIM
  if (mimBalance.gt(0)) {
    const stakeAmount = mimBalance.div(2); // Stake half
    console.log(`\n2. Staking ${ethers.utils.formatUnits(stakeAmount, 18)} MIM...`);
    
    // Approve
    const approveTx = await mim.approve(STAKING_VAULT_ADDRESS, stakeAmount);
    await approveTx.wait();
    console.log(`   ✅ Approved`);
    
    // Deposit
    try {
      const depositTx = await stakingVault.deposit(stakeAmount, { gasLimit: 500000 });
      await depositTx.wait();
      console.log(`   ✅ Deposited to StakingVault`);
      
      const smimBalance = await stakingVault.balanceOf(deployer.address);
      console.log(`   sMIM received: ${ethers.utils.formatUnits(smimBalance, 18)}`);
    } catch (e: any) {
      console.log(`   ❌ Deposit failed: ${e.message}`);
    }
  }

  // 3. Check StakingVault state
  console.log(`\n3. StakingVault State:`);
  const cash = await stakingVault.getCash();
  const totalBorrows = await stakingVault.totalBorrows();
  console.log(`   Cash (available): ${ethers.utils.formatUnits(cash, 18)} MIM`);
  console.log(`   Total Borrows: ${ethers.utils.formatUnits(totalBorrows, 18)} MIM`);

  // 4. Check Oracle
  console.log(`\n4. Oracle Price:`);
  try {
    const price = await oracle.getPrice();
    console.log(`   getPrice(): ${ethers.utils.formatUnits(price, 18)} MIM per sWETH`);
  } catch (e: any) {
    console.log(`   ⚠️ Could not get price: ${e.message?.slice(0, 50)}`);
  }
  try {
    const spotPrice = await oracle.getSpotPrice();
    console.log(`   Raw Spot Price: ${ethers.utils.formatUnits(spotPrice, 18)} (before inversion)`);
  } catch (e: any) {
    console.log(`   ⚠️ Could not get spot price: ${e.message?.slice(0, 50)}`);
  }

  // 5. Check sWETH balance and try to deposit to wETH vault
  const swethBalance = await sWETH.balanceOf(deployer.address);
  console.log(`\n5. sWETH Balance: ${ethers.utils.formatUnits(swethBalance, 18)}`);

  if (swethBalance.gt(0)) {
    const depositAmount = ethers.utils.parseUnits("0.001", 18); // Small test amount
    
    if (swethBalance.gte(depositAmount)) {
      console.log(`\n6. Testing wETH Vault Deposit (${ethers.utils.formatUnits(depositAmount, 18)} sWETH)...`);
      
      // Approve
      const approveTx = await sWETH.approve(WETH_TOKEN_ADDRESS, depositAmount);
      await approveTx.wait();
      console.log(`   ✅ Approved sWETH`);
      
      // Deposit
      try {
        const depositTx = await wETH.deposit(depositAmount, 0, { gasLimit: 2000000 });
        await depositTx.wait();
        console.log(`   ✅ Deposited to wETH Vault!`);
        
        const wethBalance = await wETH.balanceOf(deployer.address);
        console.log(`   wETH received: ${ethers.utils.formatUnits(wethBalance, 18)}`);
      } catch (e: any) {
        console.log(`   ❌ Deposit failed: ${e.message}`);
        
        // Debug info
        const leverageAMM = await ethers.getContractAt("LeverageAMM", LEVERAGE_AMM_ADDRESS);
        console.log(`\n   Debug Info:`);
        console.log(`   - wToken set: ${await leverageAMM.wToken()}`);
        console.log(`   - Expected: ${WETH_TOKEN_ADDRESS}`);
        console.log(`   - Total Debt: ${ethers.utils.formatUnits(await leverageAMM.totalDebt(), 18)}`);
      }
    } else {
      console.log(`   Not enough sWETH for test deposit`);
    }
  }

  console.log(`\n========================================`);
  console.log(`TEST COMPLETE`);
  console.log(`========================================\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

