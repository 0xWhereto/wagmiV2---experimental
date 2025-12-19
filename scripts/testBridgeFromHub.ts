import { ethers } from "hardhat";
import { BigNumber } from "ethers";

// Contract addresses
const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const SUSDC_ADDRESS = "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B"; // Synthetic USDC on Sonic
const USER_ADDRESS = "0x4151E05ABe56192e2A6775612C2020509Fd50637";

// Arbitrum EID
const ARBITRUM_EID = 30110;

// Build LZ options
function buildLzOptions(gasLimit: BigNumber): string {
  const optionType = 3;
  const version = 1;
  const optionLength = 17;
  const executorType = 1;
  
  return ethers.utils.solidityPack(
    ['uint16', 'uint8', 'uint16', 'uint8', 'uint128'],
    [optionType, version, optionLength, executorType, gasLimit]
  );
}

async function main() {
  console.log("=== TESTING BRIDGE FROM HUB (SONIC -> ARBITRUM) ===\n");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  
  // Check network
  const network = await ethers.provider.getNetwork();
  console.log(`Network: ${network.name} (chainId: ${network.chainId})`);
  
  if (network.chainId !== 146) {
    console.log("\n⚠️ Not on Sonic network. Run with: npx hardhat run scripts/testBridgeFromHub.ts --network sonic");
    return;
  }
  
  // ABIs
  const hubAbi = [
    "function bridgeTokens(address _recipient, tuple(address tokenAddress, uint256 tokenAmount)[] _assets, uint32 _dstEid, bytes _options) payable returns (tuple(bytes32 guid, uint64 nonce, tuple(uint256 nativeFee, uint256 lzTokenFee) fee))",
    "function quoteBridgeTokens(address _recipient, tuple(address tokenAddress, uint256 tokenAmount)[] _assets, uint32 _dstEid, bytes _options) view returns (uint256 nativeFee, tuple(address tokenAddress, uint256 tokenAmount)[] assetsRemote, uint256[] penalties)",
  ];
  
  const erc20Abi = [
    "function balanceOf(address) view returns (uint256)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
  ];
  
  const hub = new ethers.Contract(HUB_ADDRESS, hubAbi, deployer);
  const susdc = new ethers.Contract(SUSDC_ADDRESS, erc20Abi, deployer);
  
  // Check sUSDC balance
  console.log("\n--- Checking sUSDC Balance ---");
  const balance = await susdc.balanceOf(USER_ADDRESS);
  const decimals = await susdc.decimals();
  const symbol = await susdc.symbol();
  console.log(`${symbol} Balance: ${ethers.utils.formatUnits(balance, decimals)}`);
  
  if (balance.eq(0)) {
    console.log("\n❌ No sUSDC balance to bridge!");
    return;
  }
  
  // Bridge amount: 1 sUSDC (or all if less than 1)
  const amountToBridge = balance.lt(ethers.utils.parseUnits("1", decimals)) 
    ? balance 
    : ethers.utils.parseUnits("1", decimals);
  
  console.log(`\nAmount to bridge: ${ethers.utils.formatUnits(amountToBridge, decimals)} ${symbol}`);
  
  // Build assets array
  const assets = [{ tokenAddress: SUSDC_ADDRESS, tokenAmount: amountToBridge }];
  const lzOptions = buildLzOptions(BigNumber.from(500000));
  
  console.log("\n--- Getting Quote ---");
  try {
    const [nativeFee, assetsRemote, penalties] = await hub.quoteBridgeTokens(
      USER_ADDRESS,
      assets,
      ARBITRUM_EID,
      lzOptions
    );
    
    console.log(`Native Fee: ${ethers.utils.formatEther(nativeFee)} S`);
    console.log(`Assets Remote: ${JSON.stringify(assetsRemote.map((a: any) => ({
      token: a.tokenAddress,
      amount: a.tokenAmount.toString()
    })))}`);
    console.log(`Penalties: ${penalties.map((p: any) => p.toString())}`);
    
    // Add 10% buffer
    const feeWithBuffer = nativeFee.mul(110).div(100);
    console.log(`Fee with 10% buffer: ${ethers.utils.formatEther(feeWithBuffer)} S`);
    
    // Check native balance
    const nativeBalance = await deployer.getBalance();
    console.log(`\nNative balance: ${ethers.utils.formatEther(nativeBalance)} S`);
    
    if (nativeBalance.lt(feeWithBuffer)) {
      console.log("❌ Insufficient native balance for fee!");
      return;
    }
    
    // Check allowance
    console.log("\n--- Checking Allowance ---");
    const allowance = await susdc.allowance(USER_ADDRESS, HUB_ADDRESS);
    console.log(`Current allowance: ${ethers.utils.formatUnits(allowance, decimals)}`);
    
    if (allowance.lt(amountToBridge)) {
      console.log("Approving sUSDC for Hub...");
      const approveTx = await susdc.approve(HUB_ADDRESS, ethers.constants.MaxUint256);
      await approveTx.wait();
      console.log("✅ Approved!");
    } else {
      console.log("✅ Already approved");
    }
    
    // Execute bridge
    console.log("\n--- Executing bridgeTokens ---");
    console.log(`Bridging ${ethers.utils.formatUnits(amountToBridge, decimals)} ${symbol} to Arbitrum...`);
    
    const tx = await hub.bridgeTokens(
      USER_ADDRESS,
      assets,
      ARBITRUM_EID,
      lzOptions,
      { value: feeWithBuffer, gasLimit: 500000 }
    );
    
    console.log(`TX Hash: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ SUCCESS! Gas used: ${receipt.gasUsed.toString()}`);
    
    console.log(`\n📌 Track at: https://layerzeroscan.com/tx/${tx.hash}`);
    
    // Check new balance
    const newBalance = await susdc.balanceOf(USER_ADDRESS);
    console.log(`\nNew ${symbol} Balance: ${ethers.utils.formatUnits(newBalance, decimals)}`);
    
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    if (error.data) {
      console.error("Error data:", error.data);
    }
    if (error.reason) {
      console.error("Reason:", error.reason);
    }
  }
}

main().catch(console.error);

