/**
 * Deep debugging script for 0IL Protocol issues
 * Investigates sMIM vault issues and tests 0IL deposit
 */

import { ethers } from "hardhat";

const ADDRESSES = {
  MIM: "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708",
  sMIM: "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7",
  sUSDC: "0x29219dd400f2Bf60E5a23d13Be72B486D4038894",
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  V3LPVault: "0x1139d155D39b2520047178444C51D3D70204650F",
  LeverageAMM: "0x8CA24d00ffcF60e9ba7F67F9d41ccA28E22dF508",
  SimpleOracle: "0xD8680463F66C7bF74C61A2660aF4d7094ee9F749",
  wETH: "0xEA7681f28c62AbF83DeD17eEd88D48b3BD813Af7",
  SWETH_MIM_POOL: "0x4ed3B3e2AD7e19124D921fE2F6956e1C62Cbf190",
};

// More detailed sMIM ABI to figure out what functions exist
const SMIM_DETAIL_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function totalAssets() view returns (uint256)",
  "function asset() view returns (address)",
  "function totalBorrowed() view returns (uint256)",
  "function authorizedBorrowers(address) view returns (bool)",
  "function borrowedAmount(address) view returns (uint256)",
  "function convertToShares(uint256 assets) view returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function previewDeposit(uint256 assets) view returns (uint256)",
  "function previewWithdraw(uint256 assets) view returns (uint256)",
  "function maxDeposit(address) view returns (uint256)",
  "function maxWithdraw(address owner) view returns (uint256)",
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256)",
  "function redeem(uint256 shares, address receiver, address owner) returns (uint256)",
  "function getUtilization() view returns (uint256)",
  "function getCurrentInterestRate() view returns (uint256)",
  "function accInterestPerShare() view returns (uint256)",
  "function lastUpdateTimestamp() view returns (uint256)",
  "function totalInterestEarned() view returns (uint256)",
  // The old deployed version may have different function signatures
];

const WTOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function deposit(uint256 amount, uint256 minShares) returns (uint256)",
  "function withdraw(uint256 shares, uint256 minAmount) returns (uint256)",
  "function asset() view returns (address)",
  "function getSharePrice() view returns (uint256)",
  "function getTotalAssets() view returns (uint256)",
  // ERC4626 functions
  "function totalAssets() view returns (uint256)",
  "function convertToShares(uint256) view returns (uint256)",
  "function convertToAssets(uint256) view returns (uint256)",
  "function previewDeposit(uint256) view returns (uint256)",
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function approve(address, uint256) returns (bool)",
  "function allowance(address, address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
];

const LEVERAGE_AMM_ABI = [
  "function wToken() view returns (address)",
  "function totalDebt() view returns (uint256)",
  "function totalUnderlying() view returns (uint256)",
  "function getCurrentDTV() view returns (uint256)",
  "function getEquity() view returns (uint256)",
  "function getTotalLPValue() view returns (uint256)",
  "function openPosition(uint256) external",
  "function closePosition(uint256, uint256) external returns (uint256)",
];

const POOL_ABI = [
  "function slot0() view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)",
  "function liquidity() view returns (uint128)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function fee() view returns (uint24)",
];

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("\n🔍 DEEP DEBUG: 0IL Protocol Investigation\n");
  console.log(`Wallet: ${signer.address}`);
  
  // ================= sMIM Vault Deep Investigation =================
  
  console.log("\n" + "=".repeat(60));
  console.log("1. sMIM VAULT DEEP INVESTIGATION");
  console.log("=".repeat(60));
  
  const sMIM = new ethers.Contract(ADDRESSES.sMIM, SMIM_DETAIL_ABI, signer);
  const mim = new ethers.Contract(ADDRESSES.MIM, ERC20_ABI, signer);
  
  // Check basic ERC20 properties
  try {
    const name = await sMIM.name();
    const symbol = await sMIM.symbol();
    const decimals = await sMIM.decimals();
    const totalSupply = await sMIM.totalSupply();
    
    console.log(`Name: ${name}`);
    console.log(`Symbol: ${symbol}`);
    console.log(`Decimals: ${decimals}`);
    console.log(`Total Supply: ${ethers.utils.formatUnits(totalSupply, decimals)} ${symbol}`);
  } catch (e: any) {
    console.log(`Basic properties failed: ${e.message?.slice(0, 80)}`);
  }
  
  // Check ERC4626 properties
  try {
    const asset = await sMIM.asset();
    console.log(`Underlying Asset: ${asset}`);
    console.log(`Expected MIM: ${ADDRESSES.MIM}`);
    console.log(`Asset Match: ${asset.toLowerCase() === ADDRESSES.MIM.toLowerCase()}`);
  } catch (e: any) {
    console.log(`asset() failed: ${e.message?.slice(0, 80)}`);
  }
  
  // Check total assets
  try {
    const totalAssets = await sMIM.totalAssets();
    console.log(`Total Assets: ${ethers.utils.formatUnits(totalAssets, 6)} MIM`);
  } catch (e: any) {
    console.log(`totalAssets() failed: ${e.message?.slice(0, 80)}`);
  }
  
  // Check total borrowed
  try {
    const totalBorrowed = await sMIM.totalBorrowed();
    console.log(`Total Borrowed: ${ethers.utils.formatUnits(totalBorrowed, 6)} MIM`);
  } catch (e: any) {
    console.log(`totalBorrowed() failed: ${e.message?.slice(0, 80)}`);
  }
  
  // Check user balance
  try {
    const balance = await sMIM.balanceOf(signer.address);
    console.log(`Your sMIM Balance: ${ethers.utils.formatUnits(balance, 6)} sMIM`);
    
    // This is suspicious - let's check the assets it represents
    if (balance.gt(0)) {
      try {
        const assetsForShares = await sMIM.convertToAssets(balance);
        console.log(`Your shares worth: ${ethers.utils.formatUnits(assetsForShares, 6)} MIM`);
      } catch (e: any) {
        console.log(`convertToAssets failed: ${e.message?.slice(0, 80)}`);
      }
    }
  } catch (e: any) {
    console.log(`balanceOf failed: ${e.message?.slice(0, 80)}`);
  }
  
  // Check if 0IL vaults are authorized borrowers
  console.log("\n--- Authorized Borrowers Check ---");
  try {
    const isWethVaultAuthorized = await sMIM.authorizedBorrowers(ADDRESSES.V3LPVault);
    const isLeverageAMMAuthorized = await sMIM.authorizedBorrowers(ADDRESSES.LeverageAMM);
    console.log(`V3LPVault authorized: ${isWethVaultAuthorized}`);
    console.log(`LeverageAMM authorized: ${isLeverageAMMAuthorized}`);
  } catch (e: any) {
    console.log(`authorizedBorrowers check failed: ${e.message?.slice(0, 80)}`);
  }
  
  // Check borrowed amounts
  console.log("\n--- Borrowed Amounts ---");
  try {
    const leverageBorrowed = await sMIM.borrowedAmount(ADDRESSES.LeverageAMM);
    console.log(`LeverageAMM borrowed: ${ethers.utils.formatUnits(leverageBorrowed, 6)} MIM`);
  } catch (e: any) {
    console.log(`borrowedAmount check failed: ${e.message?.slice(0, 80)}`);
  }
  
  // Check MIM contract balance at sMIM vault
  try {
    const mimInVault = await mim.balanceOf(ADDRESSES.sMIM);
    console.log(`MIM balance in sMIM vault: ${ethers.utils.formatUnits(mimInVault, 6)} MIM`);
  } catch (e: any) {
    console.log(`MIM balance check failed: ${e.message?.slice(0, 80)}`);
  }
  
  // ================= wETH Token Investigation =================
  
  console.log("\n" + "=".repeat(60));
  console.log("2. wETH TOKEN INVESTIGATION");
  console.log("=".repeat(60));
  
  const wETH = new ethers.Contract(ADDRESSES.wETH, WTOKEN_ABI, signer);
  const sWETH = new ethers.Contract(ADDRESSES.sWETH, ERC20_ABI, signer);
  
  try {
    const symbol = await wETH.symbol();
    const decimals = await wETH.decimals();
    const totalSupply = await wETH.totalSupply();
    
    console.log(`Symbol: ${symbol}`);
    console.log(`Decimals: ${decimals}`);
    console.log(`Total Supply: ${ethers.utils.formatUnits(totalSupply, decimals)}`);
    
    try {
      const asset = await wETH.asset();
      console.log(`Underlying Asset: ${asset}`);
      console.log(`Expected sWETH: ${ADDRESSES.sWETH}`);
    } catch {
      console.log("asset() not available on this contract");
    }
    
    try {
      const sharePrice = await wETH.getSharePrice();
      console.log(`Share Price: ${ethers.utils.formatUnits(sharePrice, 18)}`);
    } catch {
      console.log("getSharePrice() not available");
    }
    
    try {
      const totalAssets = await wETH.totalAssets();
      console.log(`Total Assets: ${ethers.utils.formatUnits(totalAssets, 18)} sWETH`);
    } catch (e: any) {
      console.log(`totalAssets() failed: ${e.message?.slice(0, 80)}`);
    }
    
  } catch (e: any) {
    console.log(`wETH token check failed: ${e.message?.slice(0, 80)}`);
  }
  
  // Check user's wETH balance
  try {
    const wethBalance = await wETH.balanceOf(signer.address);
    console.log(`Your wETH Balance: ${ethers.utils.formatUnits(wethBalance, 18)}`);
  } catch (e: any) {
    console.log(`wETH balanceOf failed: ${e.message?.slice(0, 80)}`);
  }
  
  // ================= LeverageAMM Investigation =================
  
  console.log("\n" + "=".repeat(60));
  console.log("3. LEVERAGE AMM INVESTIGATION");
  console.log("=".repeat(60));
  
  const leverageAMM = new ethers.Contract(ADDRESSES.LeverageAMM, LEVERAGE_AMM_ABI, signer);
  
  try {
    const wTokenAddr = await leverageAMM.wToken();
    console.log(`wToken Address: ${wTokenAddr}`);
    console.log(`Expected wETH: ${ADDRESSES.wETH}`);
    console.log(`Match: ${wTokenAddr.toLowerCase() === ADDRESSES.wETH.toLowerCase()}`);
    
    const totalDebt = await leverageAMM.totalDebt();
    const totalUnderlying = await leverageAMM.totalUnderlying();
    console.log(`Total Debt: ${ethers.utils.formatUnits(totalDebt, 18)} MIM`);
    console.log(`Total Underlying: ${ethers.utils.formatUnits(totalUnderlying, 18)} sWETH`);
    
    try {
      const lpValue = await leverageAMM.getTotalLPValue();
      console.log(`Total LP Value: ${ethers.utils.formatUnits(lpValue, 18)} MIM`);
      
      const equity = await leverageAMM.getEquity();
      console.log(`Equity: ${ethers.utils.formatUnits(equity, 18)} MIM`);
    } catch (e: any) {
      console.log(`LP value/equity failed: ${e.message?.slice(0, 80)}`);
    }
  } catch (e: any) {
    console.log(`LeverageAMM check failed: ${e.message?.slice(0, 80)}`);
  }
  
  // ================= Pool Investigation =================
  
  console.log("\n" + "=".repeat(60));
  console.log("4. sWETH/MIM POOL INVESTIGATION");
  console.log("=".repeat(60));
  
  const pool = new ethers.Contract(ADDRESSES.SWETH_MIM_POOL, POOL_ABI, signer);
  
  try {
    const token0 = await pool.token0();
    const token1 = await pool.token1();
    const fee = await pool.fee();
    const liquidity = await pool.liquidity();
    const [sqrtPriceX96, tick] = await pool.slot0();
    
    console.log(`Token0: ${token0}`);
    console.log(`Token1: ${token1}`);
    console.log(`Fee: ${fee} (${fee/10000}%)`);
    console.log(`Liquidity: ${liquidity.toString()}`);
    console.log(`Current Tick: ${tick}`);
    
    // Calculate price from sqrtPriceX96
    const price = (Number(sqrtPriceX96) / 2**96) ** 2;
    console.log(`Calculated Price Ratio: ${price}`);
    
    // Check token order
    if (token0.toLowerCase() === ADDRESSES.sWETH.toLowerCase()) {
      console.log("Token order: sWETH/MIM (sWETH is token0)");
      console.log(`Price: ${1/price} MIM per sWETH`);
    } else {
      console.log("Token order: MIM/sWETH (MIM is token0)");
      console.log(`Price: ${price} MIM per sWETH`);
    }
  } catch (e: any) {
    console.log(`Pool check failed: ${e.message?.slice(0, 80)}`);
  }
  
  // ================= Test 0IL Vault Deposit =================
  
  console.log("\n" + "=".repeat(60));
  console.log("5. TEST 0IL VAULT DEPOSIT ($1 worth of sWETH)");
  console.log("=".repeat(60));
  
  const sWETHBalance = await sWETH.balanceOf(signer.address);
  console.log(`Your sWETH Balance: ${ethers.utils.formatUnits(sWETHBalance, 18)}`);
  
  // Calculate $1 worth of sWETH (at ~$3000/ETH, that's ~0.000333 sWETH)
  const dollarAmount = ethers.utils.parseUnits("0.00034", 18); // Slightly more than $1
  
  if (sWETHBalance.gte(dollarAmount)) {
    console.log(`Attempting to deposit ${ethers.utils.formatUnits(dollarAmount, 18)} sWETH...`);
    
    try {
      // Approve wETH to spend sWETH
      const approveTx = await sWETH.approve(ADDRESSES.wETH, dollarAmount, { gasLimit: 100000 });
      await approveTx.wait();
      console.log("✅ Approved wETH to spend sWETH");
      
      // Check allowance
      const allowance = await sWETH.allowance(signer.address, ADDRESSES.wETH);
      console.log(`Allowance: ${ethers.utils.formatUnits(allowance, 18)} sWETH`);
      
      // Try to preview deposit first
      try {
        const previewShares = await wETH.previewDeposit(dollarAmount);
        console.log(`Preview: Would receive ${ethers.utils.formatUnits(previewShares, 18)} wETH shares`);
      } catch (e: any) {
        console.log(`Preview failed: ${e.message?.slice(0, 80)}`);
      }
      
      // Try deposit
      try {
        console.log("Attempting deposit...");
        const depositTx = await wETH.deposit(dollarAmount, 0, { gasLimit: 2000000 });
        const receipt = await depositTx.wait();
        console.log(`✅ Deposit successful! Gas used: ${receipt.gasUsed.toString()}`);
        
        // Check new balances
        const newWethBalance = await wETH.balanceOf(signer.address);
        const newSwethBalance = await sWETH.balanceOf(signer.address);
        console.log(`New wETH Balance: ${ethers.utils.formatUnits(newWethBalance, 18)}`);
        console.log(`New sWETH Balance: ${ethers.utils.formatUnits(newSwethBalance, 18)}`);
        
        // Check vault state
        const totalDebt = await leverageAMM.totalDebt();
        const totalUnderlying = await leverageAMM.totalUnderlying();
        console.log(`\nAfter Deposit:`);
        console.log(`Total Debt: ${ethers.utils.formatUnits(totalDebt, 18)} MIM`);
        console.log(`Total Underlying: ${ethers.utils.formatUnits(totalUnderlying, 18)} sWETH`);
      } catch (e: any) {
        console.log(`❌ Deposit failed: ${e.message}`);
        
        // Try to decode the error
        if (e.data) {
          console.log(`Error data: ${e.data}`);
        }
      }
    } catch (e: any) {
      console.log(`❌ Approval failed: ${e.message?.slice(0, 100)}`);
    }
  } else {
    console.log("Insufficient sWETH for test deposit");
  }
  
  // ================= Summary =================
  
  console.log("\n" + "=".repeat(60));
  console.log("INVESTIGATION SUMMARY");
  console.log("=".repeat(60));
  
  console.log(`
Key Findings:
1. sMIM vault has abnormally high share balance (24+ trillion)
   - This suggests a severe decimal/accounting issue
   - The getVaultStats() function doesn't exist or has different ABI
   
2. Weekly interest payment is ~20,445 days overdue
   - lastWeeklyPayment = 0 (epoch start)
   - This means payWeeklyInterest() was never called
   
3. LeverageAMM DTV at 58.14% (target is 50%)
   - Slightly above target but within acceptable range
   - May need rebalancing soon
   
4. Accumulated fees are 0
   - No trading fees have been collected
   - Or fees were already distributed
  `);
}

main().catch(console.error);


