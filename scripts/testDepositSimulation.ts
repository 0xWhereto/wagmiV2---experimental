import { ethers } from "hardhat";

const ARBITRUM_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const WETH_ARBITRUM = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Testing WETH Deposit Simulation ===\n");
  console.log(`Signer: ${signer.address}`);
  
  const gateway = await ethers.getContractAt(
    [
      "function quoteDeposit(address _recepient, tuple(address tokenAddress, uint256 tokenAmount)[] _assets, bytes _options) view returns (uint256)",
      "function deposit(address _recepient, tuple(address tokenAddress, uint256 tokenAmount)[] _assets, bytes _options) external payable returns (tuple(bytes32 guid, uint64 nonce, tuple(uint256 nativeFee, uint256 lzTokenFee) fee))"
    ],
    ARBITRUM_GATEWAY,
    signer
  );

  const weth = await ethers.getContractAt(
    [
      "function balanceOf(address) view returns (uint256)",
      "function allowance(address, address) view returns (uint256)",
      "function approve(address, uint256) returns (bool)"
    ],
    WETH_ARBITRUM,
    signer
  );

  // Test parameters
  const recipient = signer.address;
  const depositAmount = ethers.utils.parseEther("0.007");
  
  // LZ Options - using same format as UI
  const gasLimit = BigInt(1500000);
  const gasHex = gasLimit.toString(16).padStart(32, '0');
  const lzOptions = `0x000301001101${gasHex}`;
  
  console.log(`\nDeposit amount: 0.007 WETH`);
  console.log(`LZ Options: ${lzOptions}`);

  const assets = [{
    tokenAddress: WETH_ARBITRUM,
    tokenAmount: depositAmount
  }];

  // Check balances
  const wethBalance = await weth.balanceOf(signer.address);
  const wethAllowance = await weth.allowance(signer.address, ARBITRUM_GATEWAY);
  console.log(`\nWETH Balance: ${ethers.utils.formatEther(wethBalance)} WETH`);
  console.log(`WETH Allowance: ${ethers.utils.formatEther(wethAllowance)} WETH`);

  // Get quote
  console.log("\n=== Getting Quote ===");
  try {
    const quote = await gateway.quoteDeposit(recipient, assets, lzOptions);
    console.log(`✅ Quote: ${ethers.utils.formatEther(quote)} ETH`);

    // Try static call
    console.log("\n=== Static Call Simulation ===");
    
    if (wethAllowance.lt(depositAmount)) {
      console.log("⚠️ Need approval first. Approving...");
      const approveTx = await weth.approve(ARBITRUM_GATEWAY, ethers.constants.MaxUint256);
      await approveTx.wait();
      console.log("✅ Approved!");
    }

    if (wethBalance.lt(depositAmount)) {
      console.log("❌ Insufficient WETH balance for simulation");
    } else {
      await gateway.callStatic.deposit(
        recipient,
        assets,
        lzOptions,
        { value: quote }
      );
      console.log("✅ Deposit simulation SUCCESSFUL!");
      console.log("\nThe bridge should work now. Try it in the UI!");
    }
  } catch (e: any) {
    console.log(`❌ FAILED: ${e.reason || e.message}`);
    
    // More details
    if (e.error?.message) {
      console.log(`Error message: ${e.error.message}`);
    }
    if (e.transaction) {
      console.log(`Transaction data length: ${e.transaction.data?.length}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


