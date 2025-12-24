import { ethers } from "hardhat";

const TX_HASH = "0x4f4ee4b23fbfc87f5f1d39fea6c729165792adb5b1e73c27521c22cdd431fa48";

async function main() {
  console.log("=== Review Transaction ===");
  console.log("TX:", TX_HASH);
  
  const receipt = await ethers.provider.getTransactionReceipt(TX_HASH);
  const tx = await ethers.provider.getTransaction(TX_HASH);
  
  console.log("\nFrom:", receipt.from);
  console.log("To:", receipt.to);
  console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
  console.log("Gas used:", receipt.gasUsed.toString());
  console.log("Logs:", receipt.logs.length);
  
  // Decode logs
  console.log("\n--- Events ---");
  
  // Common event signatures
  const TRANSFER_SIG = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const MINT_SIG = "0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f"; // Uniswap Mint
  const INCREASE_LIQ_SIG = "0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f"; // IncreaseLiquidity
  
  for (let i = 0; i < receipt.logs.length; i++) {
    const log = receipt.logs[i];
    console.log(`\n[${i}] Address: ${log.address}`);
    console.log(`    Topics[0]: ${log.topics[0]?.slice(0, 20)}...`);
    
    if (log.topics[0] === TRANSFER_SIG) {
      // Transfer event
      const from = "0x" + log.topics[1]?.slice(26);
      const to = "0x" + log.topics[2]?.slice(26);
      const amount = ethers.BigNumber.from(log.data);
      console.log(`    TRANSFER: ${from} -> ${to}`);
      console.log(`    Amount: ${amount.toString()}`);
    }
    
    if (log.topics[0] === INCREASE_LIQ_SIG) {
      console.log(`    INCREASE_LIQUIDITY event found!`);
      // Decode: tokenId, liquidity, amount0, amount1
      try {
        const decoded = ethers.utils.defaultAbiCoder.decode(
          ['uint256', 'uint128', 'uint256', 'uint256'],
          log.data
        );
        console.log(`    TokenId: ${decoded[0]?.toString()}`);
        console.log(`    Liquidity: ${decoded[1]?.toString()}`);
        console.log(`    Amount0: ${decoded[2]?.toString()}`);
        console.log(`    Amount1: ${decoded[3]?.toString()}`);
      } catch (e) {
        console.log(`    Could not decode`);
      }
    }
  }
  
  // Check what contract was called
  console.log("\n--- Contract Analysis ---");
  
  // Check if it was the MIM contract
  const MIM_ADDRESS = "0x9ea06883EE9aA5F93d68fb3E85C4Cf44f4C01073";
  if (receipt.to?.toLowerCase() === MIM_ADDRESS.toLowerCase()) {
    console.log("Transaction was to MIM contract!");
    
    // Decode input data
    const mimABI = [
      "function mintWithUSDC(uint256 amount)",
      "function redeemForUSDC(uint256 amount)"
    ];
    const iface = new ethers.utils.Interface(mimABI);
    try {
      const decoded = iface.parseTransaction({ data: tx.data });
      console.log("Function:", decoded.name);
      console.log("Args:", decoded.args.map((a: any) => a.toString()));
    } catch (e) {
      console.log("Could not decode MIM function");
    }
  }
}

main().catch(console.error);
