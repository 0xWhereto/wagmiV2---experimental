import { ethers } from "hardhat";

const TX_HASH = "0x7ad307b40580482d27d3a2513a412028e3d8ab76b636d836706af97ee664f0c1";

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  const receipt = await provider.getTransactionReceipt(TX_HASH);
  
  console.log("=== ALL LOGS ===\n");
  
  for (let i = 0; i < receipt.logs.length; i++) {
    const log = receipt.logs[i];
    console.log(`Log ${i}:`);
    console.log(`  Contract: ${log.address}`);
    console.log(`  Topics: ${log.topics.length}`);
    for (let j = 0; j < log.topics.length; j++) {
      console.log(`    [${j}]: ${log.topics[j]}`);
    }
    console.log(`  Data: ${log.data.slice(0, 66)}...`);
    console.log();
  }
  
  // The first log should be the USDC transfer
  if (receipt.logs.length > 0) {
    const transferLog = receipt.logs[0];
    if (transferLog.topics.length >= 3) {
      const to = "0x" + transferLog.topics[2].slice(26);
      const amount = ethers.BigNumber.from(transferLog.data);
      console.log("=== USDC TRANSFER ===");
      console.log(`To: ${to}`);
      console.log(`Amount: ${ethers.utils.formatUnits(amount, 6)} USDC`);
      
      // Now check this address's USDC balance
      const usdc = new ethers.Contract("0xaf88d065e77c8cC2239327C5EDb3A432268e5831", ["function balanceOf(address) view returns (uint256)"], provider);
      const balance = await usdc.balanceOf(to);
      console.log(`Current balance at ${to}: ${ethers.utils.formatUnits(balance, 6)} USDC`);
    }
  }
}

main().catch(console.error);
