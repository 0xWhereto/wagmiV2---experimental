import hardhat, { ethers } from "hardhat";
import { Options } from "@layerzerolabs/lz-v2-utilities";

/**
 * Debug deposit transaction failure
 */

const GATEWAY_ADDRESS = "0xb867d9E9D374E8b1165bcDF6D3f66d1A9AAd2447";
const USER_ADDRESS = "0x4151E05ABe56192e2A6775612C2020509Fd50637"; 

// USDT on Arbitrum
const USDT_ADDRESS = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9";

async function main() {
  const network = hardhat.network.name;
  console.log(`\n========================================`);
  console.log(`Debugging deposit on ${network.toUpperCase()}`);
  console.log(`========================================`);

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const gatewayVault = await ethers.getContractAt("GatewayVault", GATEWAY_ADDRESS);
  
  // Check if USDT is linked
  console.log("\n--- Checking token status ---");
  try {
    const tokenDetail = await gatewayVault.getAllAvailableTokenByAddress(USDT_ADDRESS);
    console.log(`Token: ${tokenDetail.tokenSymbol}`);
    console.log(`Address: ${tokenDetail.tokenAddress}`);
    console.log(`Decimals: ${tokenDetail.tokenDecimals}`);
    console.log(`Paused: ${tokenDetail.onPause}`);
    console.log(`Min Bridge Amount: ${tokenDetail.minBridgeAmt} (raw)`);
    console.log(`Synthetic Address: ${tokenDetail.syntheticTokenAddress}`);
  } catch (e: any) {
    console.log(`Token not found or error: ${e.message?.slice(0, 100)}`);
  }

  // Check user's USDT balance and allowance
  console.log("\n--- Checking user balances & allowances ---");
  const usdt = await ethers.getContractAt("IERC20", USDT_ADDRESS);
  
  try {
    const balance = await usdt.balanceOf(USER_ADDRESS);
    console.log(`User USDT Balance: ${ethers.utils.formatUnits(balance, 6)} USDT`);
    
    const allowance = await usdt.allowance(USER_ADDRESS, GATEWAY_ADDRESS);
    console.log(`Allowance to Gateway: ${ethers.utils.formatUnits(allowance, 6)} USDT`);
    
    if (allowance.eq(0)) {
      console.log(`\n⚠️ USER HAS NOT APPROVED GATEWAY TO SPEND USDT!`);
      console.log(`The user needs to call USDT.approve(${GATEWAY_ADDRESS}, amount) first.`);
    }
  } catch (e: any) {
    console.log(`Error checking balance/allowance: ${e.message?.slice(0, 100)}`);
  }

  // Try to simulate a deposit
  console.log("\n--- Simulating deposit ---");
  const depositAmount = ethers.utils.parseUnits("5", 6); // 5 USDT
  const assets = [{ tokenAddress: USDT_ADDRESS, tokenAmount: depositAmount }];
  const lzOptions = Options.newOptions().addExecutorLzReceiveOption(500000, 0).toHex().toString();

  try {
    // Quote first
    const fee = await gatewayVault.quoteDeposit(USER_ADDRESS, assets, lzOptions);
    console.log(`Quote succeeded: ${ethers.utils.formatEther(fee)} ETH`);

    // Try static call
    console.log("\nAttempting static call...");
    await gatewayVault.callStatic.deposit(USER_ADDRESS, assets, lzOptions, {
      value: fee.mul(150).div(100),
      from: USER_ADDRESS,
    });
    console.log("Static call succeeded - deposit should work if approval is in place");
  } catch (e: any) {
    console.log(`Simulation failed: ${e.message?.slice(0, 200)}`);
    if (e.reason) console.log(`Reason: ${e.reason}`);
  }

  // Check all linked tokens
  console.log("\n--- All linked tokens ---");
  const tokenCount = await gatewayVault.getAvailableTokenLength();
  for (let i = 0; i < tokenCount.toNumber(); i++) {
    const t = await gatewayVault.availableTokens(i);
    console.log(`  Token ${i}:`);
    console.log(`    Address: ${t.tokenAddress}`);
    console.log(`    Synthetic: ${t.syntheticTokenAddress}`);
    console.log(`    Paused: ${t.onPause}`);
    console.log(`    decimalsDelta: ${t.decimalsDelta}`);
    console.log(`    minBridgeAmt: ${t.minBridgeAmt.toString()}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

