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
  console.log("0IL PROTOCOL DIAGNOSTIC");
  console.log("========================================\n");

  const [deployer] = await ethers.getSigners();
  console.log(`Checking from: ${deployer.address}\n`);

  // 1. Check MIM contract
  console.log("1. MIM Token Status:");
  const mim = await ethers.getContractAt("MIM", ADDRESSES.mim);
  const mimTotalSupply = await mim.totalSupply();
  // MIM has 6 decimals (to match sUSDC)
  console.log(`   Total Supply: ${ethers.utils.formatUnits(mimTotalSupply, 6)} MIM`);
  
  // Check sUSDC backing
  const sUSDC = await ethers.getContractAt("IERC20", ADDRESSES.sUSDC);
  const sUSDCInMIM = await sUSDC.balanceOf(ADDRESSES.mim);
  console.log(`   sUSDC Backing: ${ethers.utils.formatUnits(sUSDCInMIM, 6)} sUSDC`);
  
  // Check user's MIM balance
  const userMIM = await mim.balanceOf(deployer.address);
  console.log(`   Your MIM Balance: ${ethers.utils.formatUnits(userMIM, 6)} MIM`);

  // 2. Check MIMStakingVault
  console.log("\n2. MIMStakingVault (sMIM) Status:");
  const stakingVault = await ethers.getContractAt("MIMStakingVault", ADDRESSES.stakingVault);
  const smimTotalSupply = await stakingVault.totalSupply();
  const cash = await stakingVault.getCash();
  const totalBorrows = await stakingVault.totalBorrows();
  const isLeverageAMMBorrower = await stakingVault.isBorrower(ADDRESSES.leverageAMM);
  // sMIM also has 6 decimals
  console.log(`   Total sMIM Supply: ${ethers.utils.formatUnits(smimTotalSupply, 6)}`);
  // Cash is MIM balance in vault (6 decimals)
  console.log(`   Cash (Available to borrow): ${ethers.utils.formatUnits(cash, 6)} MIM`);
  console.log(`   Total Borrows: ${ethers.utils.formatUnits(totalBorrows, 6)} MIM`);
  console.log(`   LeverageAMM authorized as borrower: ${isLeverageAMMBorrower}`);

  // 3. Check Oracle
  console.log("\n3. Oracle Status:");
  const oracle = await ethers.getContractAt("OracleAdapter", ADDRESSES.oracleAdapter);
  try {
    const price = await oracle.getPrice();
    console.log(`   Current Price: ${ethers.utils.formatUnits(price, 18)} MIM per sWETH`);
  } catch (error: any) {
    console.log(`   ❌ Oracle getPrice() FAILED: ${error.message || error}`);
    
    // Try spot price
    try {
      const spotPrice = await oracle.getSpotPrice();
      console.log(`   Spot Price: ${ethers.utils.formatUnits(spotPrice, 18)} MIM per sWETH`);
    } catch (e2: any) {
      console.log(`   ❌ Spot price also failed: ${e2.message || e2}`);
    }
  }

  // 4. Check Pool
  console.log("\n4. sWETH/MIM Pool Status:");
  const pool = await ethers.getContractAt("contracts/0IL/interfaces/IUniswapV3.sol:IUniswapV3Pool", ADDRESSES.swethMimPool);
  try {
    const slot0 = await pool.slot0();
    console.log(`   sqrtPriceX96: ${slot0[0]}`);
    console.log(`   Current Tick: ${slot0[1]}`);
    console.log(`   Observation Index: ${slot0[2]}`);
    console.log(`   Observation Cardinality: ${slot0[3]}`);
    console.log(`   Observation Cardinality Next: ${slot0[4]}`);
    
    const liquidity = await pool.liquidity();
    console.log(`   Liquidity: ${liquidity}`);
    
    if (liquidity === 0n) {
      console.log(`   ⚠️  WARNING: Pool has NO LIQUIDITY!`);
    }
  } catch (error: any) {
    console.log(`   ❌ Pool query failed: ${error.message || error}`);
  }

  // 5. Check LeverageAMM
  console.log("\n5. LeverageAMM Status:");
  const leverageAMM = await ethers.getContractAt("LeverageAMM", ADDRESSES.leverageAMM);
  const wToken = await leverageAMM.wToken();
  const totalDebt = await leverageAMM.getTotalDebt();
  const treasury = await leverageAMM.treasury();
  console.log(`   WToken set: ${wToken}`);
  console.log(`   WToken correct: ${wToken.toLowerCase() === ADDRESSES.wETH.toLowerCase()}`);
  console.log(`   Total Debt: ${ethers.utils.formatUnits(totalDebt, 18)}`);
  console.log(`   Treasury: ${treasury}`);

  // 6. Check V3LPVault
  console.log("\n6. V3LPVault Status:");
  const v3LPVault = await ethers.getContractAt("V3LPVault", ADDRESSES.v3LPVault);
  const isOperator = await v3LPVault.operators(ADDRESSES.leverageAMM);
  console.log(`   LeverageAMM is operator: ${isOperator}`);

  // 7. Check WToken
  console.log("\n7. WToken (wETH) Status:");
  const wETH = await ethers.getContractAt("WToken", ADDRESSES.wETH);
  const wethTotalSupply = await wETH.totalSupply();
  const depositsPaused = await wETH.depositsPaused();
  const withdrawalsPaused = await wETH.withdrawalsPaused();
  console.log(`   Total Supply: ${ethers.utils.formatUnits(wethTotalSupply, 18)}`);
  console.log(`   Deposits Paused: ${depositsPaused}`);
  console.log(`   Withdrawals Paused: ${withdrawalsPaused}`);

  // 8. User Check
  console.log("\n8. User Check (deployer):");
  const sWETH = await ethers.getContractAt("IERC20", ADDRESSES.sWETH);
  const userSWETH = await sWETH.balanceOf(deployer.address);
  const userSWETHAllowance = await sWETH.allowance(deployer.address, ADDRESSES.wETH);
  console.log(`   sWETH Balance: ${ethers.utils.formatUnits(userSWETH, 18)}`);
  console.log(`   sWETH Allowance to WToken: ${ethers.utils.formatUnits(userSWETHAllowance, 18)}`);

  console.log("\n========================================");
  console.log("DIAGNOSIS SUMMARY");
  console.log("========================================\n");

  const issues: string[] = [];

  if (mimTotalSupply === 0n) {
    issues.push("❌ No MIM minted - need to mint MIM first by depositing sUSDC");
  }
  if (cash === 0n) {
    issues.push("❌ MIMStakingVault has no MIM - need to deposit MIM to create liquidity for borrowing");
  }
  if (!isLeverageAMMBorrower) {
    issues.push("❌ LeverageAMM not authorized as borrower");
  }
  if (!isOperator) {
    issues.push("❌ LeverageAMM not authorized as V3LPVault operator");
  }
  if (wToken.toLowerCase() !== ADDRESSES.wETH.toLowerCase()) {
    issues.push("❌ WToken not set correctly in LeverageAMM");
  }

  if (issues.length === 0) {
    console.log("✅ All configurations look correct!");
    console.log("\nIf deposit still fails, the issue is likely:");
    console.log("   - User didn't approve sWETH to WToken");
    console.log("   - Pool has no liquidity (TWAP fails)");
    console.log("   - MIMStakingVault has no MIM to lend");
  } else {
    console.log("Issues found:");
    issues.forEach(issue => console.log(`   ${issue}`));
  }

  console.log("\n📋 REQUIRED SETUP STEPS:");
  console.log("1. Mint MIM: Call mim.mint(amount) with sUSDC");
  console.log("2. Deposit MIM to StakingVault: Call stakingVault.deposit(amount)");
  console.log("3. Add initial liquidity to sWETH/MIM pool");
  console.log("4. Only then can users deposit sWETH to get wETH");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

