import { ethers } from "hardhat";

const TX_HASH = "0x7ad307b40580482d27d3a2513a412028e3d8ab76b636d836706af97ee664f0c1";

async function main() {
  console.log("=== DECODING BRIDGE TX ===\n");
  
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  const tx = await provider.getTransaction(TX_HASH);
  const receipt = await provider.getTransactionReceipt(TX_HASH);
  
  console.log(`Value sent: ${ethers.utils.formatEther(tx.value)} ETH`);
  
  // Decode the transaction data
  const gatewayAbi = [
    "function deposit(address _recipient, tuple(address tokenAddress, uint256 tokenAmount)[] _assets, bytes _options) payable"
  ];
  const iface = new ethers.utils.Interface(gatewayAbi);
  
  try {
    const decoded = iface.parseTransaction({ data: tx.data, value: tx.value });
    console.log(`\nRecipient: ${decoded.args._recipient}`);
    console.log(`Assets:`);
    for (const asset of decoded.args._assets) {
      console.log(`  Token: ${asset.tokenAddress}`);
      console.log(`  Amount: ${ethers.utils.formatUnits(asset.tokenAmount, 6)} (raw: ${asset.tokenAmount})`);
    }
  } catch (e) {
    console.log("Could not decode");
  }
  
  // Decode logs
  console.log("\n=== LOGS ===");
  const transferTopic = ethers.utils.id("Transfer(address,address,uint256)");
  
  for (const log of receipt.logs) {
    if (log.topics[0] === transferTopic) {
      const from = ethers.utils.getAddress("0x" + log.topics[1].slice(26));
      const to = ethers.utils.getAddress("0x" + log.topics[2].slice(26));
      const amount = ethers.BigNumber.from(log.data);
      console.log(`Transfer: ${from.slice(0,10)}... -> ${to.slice(0,10)}... : ${ethers.utils.formatUnits(amount, 6)}`);
    }
  }
}

main().catch(console.error);
