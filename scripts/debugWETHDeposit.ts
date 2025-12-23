import { ethers } from "hardhat";

const MIM_ADDRESS = "0x0462c2926DCb2e80891Bf31d28383C9b63bEcF8D";
const STAKING_VAULT_ADDRESS = "0x5E0453350dA7F94259FA84BcF140606A2e86706B";
const SWETH_ADDRESS = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const WETH_TOKEN_ADDRESS = "0x94a3b6B5DFf4F862985b38AD673541D5a50E0fB7";
const LEVERAGE_AMM_ADDRESS = "0xc1d12c80a36d235f858E749c1D2FC18cc933ae32";
const ORACLE_ADDRESS = "0x7C431B67d912a7a4937c936d17fAE30A6003Be37";
const V3LP_VAULT_ADDRESS = "0x590EE27e4dCECdf484c5dDbC2b7047164E65dB04";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`\n========================================`);
  console.log(`Debug wETH Deposit Flow`);
  console.log(`========================================\n`);

  const sWETH = await ethers.getContractAt("IERC20", SWETH_ADDRESS);
  const mim = await ethers.getContractAt("IERC20", MIM_ADDRESS);
  const stakingVault = await ethers.getContractAt("MIMStakingVault", STAKING_VAULT_ADDRESS);
  const wETH = await ethers.getContractAt("WToken", WETH_TOKEN_ADDRESS);
  const leverageAMM = await ethers.getContractAt("LeverageAMM", LEVERAGE_AMM_ADDRESS);
  const oracle = await ethers.getContractAt("OracleAdapter", ORACLE_ADDRESS);
  const v3LPVault = await ethers.getContractAt("V3LPVault", V3LP_VAULT_ADDRESS);

  console.log("1. Checking prerequisites:");
  console.log(`   sWETH balance: ${ethers.utils.formatUnits(await sWETH.balanceOf(deployer.address), 18)}`);
  console.log(`   StakingVault cash: ${ethers.utils.formatUnits(await stakingVault.getCash(), 18)} MIM`);
  console.log(`   Oracle price: ${ethers.utils.formatUnits(await oracle.getPrice(), 18)} MIM/sWETH`);

  const depositAmount = ethers.utils.parseUnits("0.001", 18);
  const price = await oracle.getPrice();
  const underlyingValue = depositAmount.mul(price).div(ethers.utils.parseUnits("1", 18));
  const borrowAmount = underlyingValue; // Same as value for 2x leverage
  
  console.log(`\n2. Deposit calculation:`);
  console.log(`   Deposit amount: ${ethers.utils.formatUnits(depositAmount, 18)} sWETH`);
  console.log(`   Underlying value: ${ethers.utils.formatUnits(underlyingValue, 18)} MIM`);
  console.log(`   Borrow amount needed: ${ethers.utils.formatUnits(borrowAmount, 18)} MIM`);

  // Check if borrow would succeed
  const cash = await stakingVault.getCash();
  const maxUtilization = ethers.utils.parseUnits("0.9", 18); // 90%
  const totalBorrows = await stakingVault.totalBorrows();
  const newBorrows = totalBorrows.add(borrowAmount);
  const newUtil = newBorrows.mul(ethers.utils.parseUnits("1", 18)).div(cash.add(newBorrows));
  
  console.log(`\n3. Utilization check:`);
  console.log(`   Current borrows: ${ethers.utils.formatUnits(totalBorrows, 18)} MIM`);
  console.log(`   New borrows would be: ${ethers.utils.formatUnits(newBorrows, 18)} MIM`);
  console.log(`   New utilization: ${ethers.utils.formatUnits(newUtil.mul(100), 18)}%`);
  console.log(`   Max utilization: 90%`);
  console.log(`   Would succeed: ${newUtil.lte(maxUtilization)}`);

  // Check V3LPVault layers
  console.log(`\n4. V3LPVault layers:`);
  const layerCount = await v3LPVault.getLayerCount();
  console.log(`   Layer count: ${layerCount}`);
  
  // Check authorizations
  console.log(`\n5. Authorizations:`);
  console.log(`   LeverageAMM is borrower: ${await stakingVault.isBorrower(LEVERAGE_AMM_ADDRESS)}`);
  console.log(`   LeverageAMM is operator: ${await v3LPVault.isOperator(LEVERAGE_AMM_ADDRESS)}`);
  console.log(`   WToken is set in LeverageAMM: ${(await leverageAMM.wToken()).toLowerCase() === WETH_TOKEN_ADDRESS.toLowerCase()}`);

  // Check allowances
  console.log(`\n6. Allowances:`);
  const sWETHAllowance = await sWETH.allowance(WETH_TOKEN_ADDRESS, LEVERAGE_AMM_ADDRESS);
  console.log(`   WToken->LeverageAMM sWETH allowance: ${ethers.utils.formatUnits(sWETHAllowance, 18)}`);
  
  // Try to simulate the borrow directly
  console.log(`\n7. Simulating borrow from StakingVault...`);
  try {
    // This won't work since we're not LeverageAMM, but let's see what error we get
    await stakingVault.callStatic.borrow(borrowAmount);
    console.log(`   ✅ Borrow would succeed (simulated)`);
  } catch (e: any) {
    console.log(`   ❌ Borrow simulation failed: ${e.reason || e.message?.slice(0, 100)}`);
  }

  // Check if the pool has been initialized for liquidity
  console.log(`\n8. V3 Pool initialization:`);
  for (let i = 0; i < layerCount; i++) {
    const layer = await v3LPVault.getLayer(i);
    console.log(`   Layer ${i}: tickLower=${layer.tickLower}, tickUpper=${layer.tickUpper}, tokenId=${layer.tokenId}, liquidity=${layer.liquidity}`);
  }

  console.log(`\n========================================`);
  console.log(`DEBUG COMPLETE`);
  console.log(`========================================\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

