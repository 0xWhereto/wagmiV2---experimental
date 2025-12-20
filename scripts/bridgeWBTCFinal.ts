import { ethers } from "hardhat";

const OLD_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
const SBTC = "0x2F0324268031E6413280F3B5ddBc4A97639A284a";

// Bridge 0.0001 WBTC (~$10 at current prices)
const BRIDGE_AMOUNT = ethers.utils.parseUnits("0.0001", 8);

async function main() {
  console.log("=== BRIDGING WBTC ===\n");
  
  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);
  
  // Check WBTC balance
  const wbtc = await ethers.getContractAt("IERC20", WBTC);
  const balance = await wbtc.balanceOf(signer.address);
  console.log(`WBTC balance: ${ethers.utils.formatUnits(balance, 8)}`);
  console.log(`Bridging: ${ethers.utils.formatUnits(BRIDGE_AMOUNT, 8)} WBTC`);
  
  if (balance.lt(BRIDGE_AMOUNT)) {
    console.log("❌ Not enough WBTC");
    return;
  }
  
  // Check sWBTC balance before
  const sonicProvider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");
  const sbtc = new ethers.Contract(SBTC, ["function balanceOf(address) view returns (uint256)"], sonicProvider);
  const sbtcBalanceBefore = await sbtc.balanceOf(signer.address);
  console.log(`sWBTC on Sonic: ${ethers.utils.formatUnits(sbtcBalanceBefore, 8)}`);
  
  // Approve
  console.log("\nApproving WBTC...");
  const allowance = await wbtc.allowance(signer.address, OLD_GATEWAY);
  if (allowance.lt(BRIDGE_AMOUNT)) {
    const approveTx = await wbtc.approve(OLD_GATEWAY, ethers.constants.MaxUint256);
    await approveTx.wait();
    console.log("✅ Approved");
  } else {
    console.log("Already approved");
  }
  
  // Quote
  const gateway = await ethers.getContractAt("GatewayVault", OLD_GATEWAY);
  const lzOptions = ethers.utils.solidityPack(
    ["uint16", "uint8", "uint16", "uint8", "uint128"],
    [3, 1, 17, 1, 500000]
  );
  
  const assets = [{ tokenAddress: WBTC, tokenAmount: BRIDGE_AMOUNT }];
  const fee = await gateway.quoteDeposit(signer.address, assets, lzOptions);
  console.log(`\nFee: ${ethers.utils.formatEther(fee)} ETH`);
  
  // Deposit
  console.log("\nDepositing...");
  const tx = await gateway.deposit(signer.address, assets, lzOptions, {
    value: fee.mul(120).div(100),
  });
  console.log(`TX: ${tx.hash}`);
  await tx.wait();
  console.log("✅ Deposit sent!");
  
  console.log("\n========================================");
  console.log("WBTC Bridge TX: " + tx.hash);
  console.log("LayerZero: https://layerzeroscan.com/tx/" + tx.hash);
  console.log("========================================");
  console.log("\nWait 1-2 minutes, then check sWBTC balance on Sonic.");
}

main().catch(console.error);
