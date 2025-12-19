import { ethers } from "hardhat";
import { BigNumber } from "ethers";

// Contract addresses
const GATEWAY_ADDRESS = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const USDC_ARB = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const USER_ADDRESS = "0x4151E05ABe56192e2A6775612C2020509Fd50637";

// Build LZ options
function buildLzOptions(gasLimit: BigNumber): string {
  return ethers.utils.solidityPack(
    ['uint16', 'uint8', 'uint16', 'uint8', 'uint128'],
    [3, 1, 17, 1, gasLimit]
  );
}

async function main() {
  console.log("=== TESTING BRIDGE TO HUB (ARBITRUM -> SONIC) ===\n");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  
  const network = await ethers.provider.getNetwork();
  console.log(`Network: chainId ${network.chainId}`);
  
  if (network.chainId !== 42161) {
    console.log("\n⚠️ Not on Arbitrum. Run with: npx hardhat run scripts/testBridgeToHub.ts --network arbitrum");
    return;
  }
  
  const gatewayAbi = [
    "function deposit(address _recepient, tuple(address tokenAddress, uint256 tokenAmount)[] _assets, bytes _options) payable returns (tuple(bytes32 guid, uint64 nonce, tuple(uint256 nativeFee, uint256 lzTokenFee) fee))",
    "function quoteDeposit(address _recepient, tuple(address tokenAddress, uint256 tokenAmount)[] _assets, bytes _options) view returns (uint256 nativeFee)",
  ];
  
  const erc20Abi = [
    "function balanceOf(address) view returns (uint256)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
  ];
  
  const gateway = new ethers.Contract(GATEWAY_ADDRESS, gatewayAbi, deployer);
  const usdc = new ethers.Contract(USDC_ARB, erc20Abi, deployer);
  
  // Check USDC balance
  console.log("\n--- Checking USDC Balance ---");
  const balance = await usdc.balanceOf(USER_ADDRESS);
  const decimals = await usdc.decimals();
  const symbol = await usdc.symbol();
  console.log(`${symbol} Balance: ${ethers.utils.formatUnits(balance, decimals)}`);
  
  // Amount to bridge: 2 USDC
  const amountToBridge = ethers.utils.parseUnits("2", decimals);
  console.log(`Amount to bridge: ${ethers.utils.formatUnits(amountToBridge, decimals)} ${symbol}`);
  
  if (balance.lt(amountToBridge)) {
    console.log("❌ Insufficient balance!");
    return;
  }
  
  // Check allowance
  console.log("\n--- Checking Allowance ---");
  const allowance = await usdc.allowance(USER_ADDRESS, GATEWAY_ADDRESS);
  console.log(`Current allowance: ${ethers.utils.formatUnits(allowance, decimals)} ${symbol}`);
  
  if (allowance.lt(amountToBridge)) {
    console.log("Approving USDC...");
    const approveTx = await usdc.approve(GATEWAY_ADDRESS, ethers.constants.MaxUint256);
    await approveTx.wait();
    console.log("✅ Approved!");
    
    const newAllowance = await usdc.allowance(USER_ADDRESS, GATEWAY_ADDRESS);
    console.log(`New allowance: ${ethers.utils.formatUnits(newAllowance, decimals)} ${symbol}`);
  } else {
    console.log("✅ Already approved");
  }
  
  // Build assets and options
  const assets = [{ tokenAddress: USDC_ARB, tokenAmount: amountToBridge }];
  const lzOptions = buildLzOptions(BigNumber.from(500000));
  
  // Get quote
  console.log("\n--- Getting Quote ---");
  const nativeFee = await gateway.quoteDeposit(USER_ADDRESS, assets, lzOptions);
  const feeWithBuffer = nativeFee.mul(110).div(100);
  console.log(`Native fee: ${ethers.utils.formatEther(nativeFee)} ETH`);
  console.log(`With 10% buffer: ${ethers.utils.formatEther(feeWithBuffer)} ETH`);
  
  // Execute bridge
  console.log("\n--- Executing Bridge ---");
  const tx = await gateway.deposit(USER_ADDRESS, assets, lzOptions, { 
    value: feeWithBuffer, 
    gasLimit: 500000 
  });
  console.log(`TX Hash: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`✅ SUCCESS! Gas used: ${receipt.gasUsed.toString()}`);
  
  console.log(`\n📌 Track at: https://layerzeroscan.com/tx/${tx.hash}`);
}

main().catch(console.error);
