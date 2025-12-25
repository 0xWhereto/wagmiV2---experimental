import { ethers } from "hardhat";

// Addresses
const ARB_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const ARB_WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=== BRIDGE $3 WETH FROM ARBITRUM ===\n");
  console.log(`User: ${deployer.address}`);
  
  // Check native balance for gas
  const nativeBalance = await deployer.getBalance();
  console.log(`Native balance: ${ethers.utils.formatEther(nativeBalance)} ETH`);
  
  // Check WETH balance
  const erc20Abi = [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address, uint256) returns (bool)",
    "function allowance(address, address) view returns (uint256)",
  ];
  
  const weth = new ethers.Contract(ARB_WETH, erc20Abi, deployer);
  const balance = await weth.balanceOf(deployer.address);
  console.log(`WETH balance: ${ethers.utils.formatEther(balance)} WETH`);
  
  // $3 worth of WETH at ~$3500/ETH = 0.000857 WETH
  // But minBridge is 0.001, so let's use 0.001
  const amount = ethers.utils.parseEther("0.001");
  console.log(`Amount to bridge: ${ethers.utils.formatEther(amount)} WETH (~$3.50)`);
  
  if (balance.lt(amount)) {
    console.log("❌ Insufficient WETH balance!");
    return;
  }
  
  // Gateway ABI
  const gatewayAbi = [
    "function quoteDeposit(address _recepient, tuple(address tokenAddress, uint256 tokenAmount)[] _assets, bytes _options) view returns (uint256 nativeFee)",
    "function deposit(address _recepient, tuple(address tokenAddress, uint256 tokenAmount)[] _assets, bytes _options) payable returns (tuple(bytes32 guid, uint64 nonce, tuple(uint256 nativeFee, uint256 lzTokenFee) fee))",
  ];
  
  const gateway = new ethers.Contract(ARB_GATEWAY, gatewayAbi, deployer);
  
  // Build assets array
  const assets = [{ tokenAddress: ARB_WETH, tokenAmount: amount }];
  
  // LayerZero options: type 3, worker 1, gas 200000
  const options = ethers.utils.arrayify("0x00030100110100000000000000000000000000030d40");
  
  // Quote the deposit
  console.log("\nQuoting deposit...");
  try {
    const nativeFee = await gateway.quoteDeposit(deployer.address, assets, options);
    console.log(`LayerZero fee: ${ethers.utils.formatEther(nativeFee)} ETH`);
    
    // Check allowance
    const allowance = await weth.allowance(deployer.address, ARB_GATEWAY);
    if (allowance.lt(amount)) {
      console.log("\nApproving WETH...");
      const approveTx = await weth.approve(ARB_GATEWAY, ethers.constants.MaxUint256);
      await approveTx.wait();
      console.log("✅ Approved");
    } else {
      console.log("✅ Already approved");
    }
    
    // Execute deposit
    console.log("\nExecuting bridge...");
    const tx = await gateway.deposit(deployer.address, assets, options, {
      value: nativeFee,
      gasLimit: 400000,
    });
    console.log(`TX: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`✅ SUCCESS! Gas used: ${receipt.gasUsed.toString()}`);
    
    console.log(`\n📌 Track at: https://layerzeroscan.com/tx/${tx.hash}`);
    
  } catch (e: any) {
    console.log(`❌ Error: ${e.message?.slice(0, 300)}`);
    
    // Try to decode error
    if (e.error?.data) {
      console.log(`Error data: ${e.error.data}`);
    }
    if (e.reason) {
      console.log(`Reason: ${e.reason}`);
    }
  }
}

main().catch(console.error);


