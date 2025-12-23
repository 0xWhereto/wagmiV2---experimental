import { ethers } from "hardhat";

const DEPLOYED = {
  MIM: "0x0462c2926DCb2e80891Bf31d28383C9b63bEcF8D",
  STAKING_VAULT: "0x5E0453350dA7F94259FA84BcF140606A2e86706B",
  SWETH_MIM_POOL: "0xF6126331eb757475e2B29D858770cBb3D902D91c",
  ORACLE: "0x7C431B67d912a7a4937c936d17fAE30A6003Be37",
  V3LP_VAULT: "0x590EE27e4dCECdf484c5dDbC2b7047164E65dB04",
  LEVERAGE_AMM: "0x8b4a77F392c197F91c6f43fd173b92371b522a39", // NEW
  WETH: "0xc76a818e2e3B198aDe9766c3319981b657840758", // NEW
  SWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
};

async function main() {
  console.log("========================================");
  console.log("Trace wETH Deposit Flow");
  console.log("========================================\n");
  
  const [signer] = await ethers.getSigners();
  console.log(`Using signer: ${signer.address}\n`);

  // Load contracts
  const wToken = await ethers.getContractAt("WToken", DEPLOYED.WETH);
  const leverageAMM = await ethers.getContractAt("LeverageAMM", DEPLOYED.LEVERAGE_AMM);
  const stakingVault = await ethers.getContractAt("MIMStakingVault", DEPLOYED.STAKING_VAULT);
  const oracle = await ethers.getContractAt("OracleAdapter", DEPLOYED.ORACLE);
  const sWETH = await ethers.getContractAt("IERC20", DEPLOYED.SWETH);

  // Get balances and state
  const depositAmount = ethers.utils.parseEther("0.001");
  console.log(`Deposit amount: ${ethers.utils.formatEther(depositAmount)} sWETH\n`);

  // 1. Check sWETH allowance to WToken
  const allowance = await sWETH.allowance(signer.address, DEPLOYED.WETH);
  console.log(`1. sWETH allowance to WToken: ${ethers.utils.formatEther(allowance)}`);
  
  if (allowance.lt(depositAmount)) {
    console.log("   ⚠️ Insufficient allowance - approving...");
    const approveTx = await sWETH.approve(DEPLOYED.WETH, ethers.constants.MaxUint256);
    await approveTx.wait();
    console.log("   ✅ Approved");
  }

  // 2. Check sWETH balance
  const sWETHBalance = await sWETH.balanceOf(signer.address);
  console.log(`2. sWETH balance: ${ethers.utils.formatEther(sWETHBalance)}`);
  
  if (sWETHBalance.lt(depositAmount)) {
    console.log("   ❌ Insufficient sWETH balance");
    return;
  }

  // 3. Check oracle price
  const oraclePrice = await oracle.getPrice();
  console.log(`3. Oracle price: ${ethers.utils.formatEther(oraclePrice)} MIM/sWETH`);

  // 4. Calculate MIM needed
  const WAD = ethers.utils.parseEther("1");
  const mimNeeded = depositAmount.mul(oraclePrice).div(WAD);
  console.log(`4. MIM needed (2x deposit value): ${ethers.utils.formatEther(mimNeeded)}`);

  // 5. Check staking vault liquidity
  const vaultCash = await stakingVault.getCash();
  console.log(`5. StakingVault cash: ${ethers.utils.formatEther(vaultCash)} MIM`);
  
  if (vaultCash.lt(mimNeeded)) {
    console.log("   ❌ Insufficient vault liquidity");
    return;
  }

  // 6. Check LeverageAMM is borrower
  const isBorrower = await stakingVault.isBorrower(DEPLOYED.LEVERAGE_AMM);
  console.log(`6. LeverageAMM is borrower: ${isBorrower}`);

  // 7. Check utilization after borrow
  const totalBorrows = await stakingVault.totalBorrows();
  const newBorrows = totalBorrows.add(mimNeeded);
  const newUtilization = newBorrows.mul(WAD).div(vaultCash.add(newBorrows));
  console.log(`7. New utilization after borrow: ${ethers.utils.formatEther(newUtilization.mul(100))}%`);

  // 8. Check WToken configuration
  console.log(`\n8. WToken configuration:`);
  const wTokenUnderlying = await wToken.underlyingAsset();
  const wTokenLeverageAMM = await wToken.leverageAMM();
  console.log(`   underlyingAsset: ${wTokenUnderlying}`);
  console.log(`   leverageAMM: ${wTokenLeverageAMM}`);
  console.log(`   expected sWETH: ${DEPLOYED.SWETH}`);
  console.log(`   underlying matches: ${wTokenUnderlying.toLowerCase() === DEPLOYED.SWETH.toLowerCase()}`);
  console.log(`   leverageAMM matches: ${wTokenLeverageAMM.toLowerCase() === DEPLOYED.LEVERAGE_AMM.toLowerCase()}`);

  // 9. Check LeverageAMM configuration
  console.log(`\n9. LeverageAMM configuration:`);
  try {
    const leverageOracle = await leverageAMM.oracle();
    const leverageStaking = await leverageAMM.stakingVault();
    const leverageV3Vault = await leverageAMM.v3LPVault();
    const leverageMIM = await leverageAMM.mim();
    const leverageUnderlying = await leverageAMM.underlying();
    const leverageWToken = await leverageAMM.wToken();
    console.log(`   oracle: ${leverageOracle} (expected: ${DEPLOYED.ORACLE})`);
    console.log(`   stakingVault: ${leverageStaking} (expected: ${DEPLOYED.STAKING_VAULT})`);
    console.log(`   v3LPVault: ${leverageV3Vault} (expected: ${DEPLOYED.V3LP_VAULT})`);
    console.log(`   mim: ${leverageMIM} (expected: ${DEPLOYED.MIM})`);
    console.log(`   underlying: ${leverageUnderlying} (expected: ${DEPLOYED.SWETH})`);
    console.log(`   wToken: ${leverageWToken} (expected: ${DEPLOYED.WETH})`);
    console.log(`   wToken configured: ${leverageWToken !== ethers.constants.AddressZero}`);
  } catch (e: any) {
    console.log(`   Error reading LeverageAMM config: ${e.message}`);
  }

  // 10. Check LeverageAMM allowances
  console.log(`\n10. LeverageAMM allowances:`);
  const mimToken = await ethers.getContractAt("IERC20", DEPLOYED.MIM);
  const ammMimAllowance = await mimToken.allowance(DEPLOYED.LEVERAGE_AMM, DEPLOYED.V3LP_VAULT);
  const ammSwethAllowance = await sWETH.allowance(DEPLOYED.LEVERAGE_AMM, DEPLOYED.V3LP_VAULT);
  console.log(`   MIM allowance to V3LPVault: ${ethers.utils.formatEther(ammMimAllowance)}`);
  console.log(`   sWETH allowance to V3LPVault: ${ethers.utils.formatEther(ammSwethAllowance)}`);

  // 11. Try the deposit
  console.log(`\n11. Attempting deposit...`);
  
  // Calculate expected shares
  const expectedShares = await wToken.convertToShares(depositAmount);
  console.log(`   Expected shares: ${ethers.utils.formatEther(expectedShares)}`);
  
  // Use 0 for minShares (no slippage protection for test)
  const minShares = 0;
  console.log(`   Min shares (slippage protection): ${minShares}`);
  
  try {
    // Estimate gas first
    console.log("   Estimating gas...");
    const gasEstimate = await wToken.estimateGas.deposit(depositAmount, minShares);
    console.log(`   Gas estimate: ${gasEstimate.toString()}`);
    
    const tx = await wToken.deposit(depositAmount, minShares, { gasLimit: gasEstimate.mul(2) });
    console.log(`   TX submitted: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`   ✅ Deposit successful! Gas used: ${receipt?.gasUsed}`);
    
    // Check final balances
    const wTokenBalance = await wToken.balanceOf(signer.address);
    console.log(`   wETH balance: ${ethers.utils.formatEther(wTokenBalance)}`);
  } catch (error: any) {
    console.log(`   ❌ Deposit failed:`);
    console.log(`   Error: ${error.message}`);
    if (error.data) {
      console.log(`   Error data: ${error.data}`);
    }
    // Try to decode the error
    if (error.reason) {
      console.log(`   Reason: ${error.reason}`);
    }
    if (error.code) {
      console.log(`   Code: ${error.code}`);
    }
    // Check if we can get more details
    if (error.transaction) {
      console.log(`   Transaction to: ${error.transaction.to}`);
    }
  }

  console.log("\n========================================");
  console.log("TRACE COMPLETE");
  console.log("========================================");
}

main().catch(console.error);

