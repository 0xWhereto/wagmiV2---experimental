import { ethers } from "hardhat";

const OLD_TX = "0x3797d3c05dbd236b15fb122bd736c6f3add78cd736db1f01838e0c53b4082fa7";

async function main() {
  console.log("=== SEARCHING FOR OLD WORKING TX ===\n");
  
  const chains = [
    { name: "Ethereum", rpc: "https://ethereum-rpc.publicnode.com" },
    { name: "Arbitrum", rpc: "https://arb1.arbitrum.io/rpc" },
    { name: "Base", rpc: "https://mainnet.base.org" },
    { name: "Sonic", rpc: "https://rpc.soniclabs.com" },
  ];
  
  for (const chain of chains) {
    const provider = new ethers.providers.JsonRpcProvider(chain.rpc);
    try {
      const tx = await provider.getTransaction(OLD_TX);
      if (tx) {
        console.log(`Found on ${chain.name}!`);
        console.log(`  To: ${tx.to}`);
        console.log(`  From: ${tx.from}`);
        console.log(`  Block: ${tx.blockNumber}`);
        
        const receipt = await provider.getTransactionReceipt(OLD_TX);
        console.log(`  Status: ${receipt?.status === 1 ? "Success" : "Failed"}`);
        return;
      }
    } catch (e) {
      // Not found on this chain
    }
  }
  
  console.log("Transaction not found on any chain");
}

main().catch(console.error);
