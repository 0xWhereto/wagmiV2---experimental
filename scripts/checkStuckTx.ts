import { ethers } from "hardhat";

// The stuck transactions
const TX_HASHES = [
  "0x1962b0ed824a4d9da40b6fe4f8d8ce0aaeab0cbe10ca2055dcd5523949c1e85b",
  "0x04c5e609b43b43e899b0640882bce2bf31b17777c615d2616b67843241f2ecd6",
];

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  console.log("=== ANALYZING STUCK TRANSACTIONS ===\n");
  
  for (const txHash of TX_HASHES) {
    console.log(`\nTX: ${txHash.substring(0, 20)}...`);
    
    try {
      const tx = await provider.getTransaction(txHash);
      const receipt = await provider.getTransactionReceipt(txHash);
      
      if (!tx) {
        console.log("  Not found on Arbitrum");
        continue;
      }
      
      console.log(`  To: ${tx.to}`);
      console.log(`  Value: ${ethers.utils.formatEther(tx.value)} ETH`);
      console.log(`  Status: ${receipt?.status === 1 ? "✅ Success" : "❌ Failed"}`);
      console.log(`  Block: ${tx.blockNumber}`);
      
      // Decode the options from the tx data
      const Gateway = await ethers.getContractFactory("GatewayVault");
      const iface = Gateway.interface;
      
      try {
        const decoded = iface.parseTransaction({ data: tx.data, value: tx.value });
        console.log(`  Function: ${decoded.name}`);
        
        if (decoded.args.length >= 3) {
          const options = decoded.args[2];
          console.log(`  LZ Options: ${options}`);
          
          // Decode the options
          if (options && options.length > 10) {
            // Type 3 options format: 0x0003 + worker options
            const optionType = options.slice(0, 6);
            console.log(`  Option type: ${optionType}`);
            
            // The gas limit is in the last 16 bytes of the options
            if (options.length >= 46) {
              const gasHex = "0x" + options.slice(-32);
              const gasLimit = ethers.BigNumber.from(gasHex);
              console.log(`  Gas limit for lzReceive: ${gasLimit.toString()}`);
            }
          }
        }
      } catch (e) {
        console.log(`  Could not decode: ${e}`);
      }
      
    } catch (e: any) {
      console.log(`  Error: ${e.message?.substring(0, 80)}`);
    }
  }
}

main().catch(console.error);
