import { ethers } from "hardhat";

const TX_HASH = "0x60fd06596278c2939375b373bed1f8b1f674a62226254bd8ae231932b76cc991";

async function main() {
  console.log("Debugging failed withdrawal transaction...\n");

  const provider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");
  
  // Get transaction
  const tx = await provider.getTransaction(TX_HASH);
  console.log("Transaction:");
  console.log(`  From: ${tx?.from}`);
  console.log(`  To: ${tx?.to}`);
  console.log(`  Value: ${tx?.value ? ethers.utils.formatEther(tx.value) : 0} S`);
  console.log(`  Data length: ${tx?.data?.length}`);
  
  // Get receipt
  const receipt = await provider.getTransactionReceipt(TX_HASH);
  console.log(`\nReceipt:`);
  console.log(`  Status: ${receipt?.status === 1 ? "SUCCESS" : "FAILED"}`);
  console.log(`  Gas Used: ${receipt?.gasUsed?.toString()}`);
  console.log(`  Logs: ${receipt?.logs?.length || 0}`);

  if (receipt?.status === 0) {
    console.log("\n❌ Transaction REVERTED");
    
    // Try to get revert reason
    try {
      const code = await provider.call({
        to: tx?.to,
        from: tx?.from,
        data: tx?.data,
        value: tx?.value,
      }, tx?.blockNumber);
      console.log("Call result:", code);
    } catch (e: any) {
      console.log("\nRevert reason:", e.reason || e.message);
      
      // Try to decode error
      if (e.data) {
        console.log("Error data:", e.data);
      }
    }
  }

  // Decode the transaction data
  if (tx?.data) {
    console.log("\n--- Decoding Transaction Data ---");
    
    // Check function selector
    const selector = tx.data.slice(0, 10);
    console.log(`Function selector: ${selector}`);
    
    // Common Hub function selectors
    const selectors: Record<string, string> = {
      "0x7b0a47ee": "withdrawTo",
      "0x4d66a6c6": "swap",
      "0x095ea7b3": "approve",
    };
    
    console.log(`Function: ${selectors[selector] || "Unknown"}`);
  }

  // Check Hub configuration
  console.log("\n--- Hub Configuration Check ---");
  const HUB_ADDRESS = tx?.to;
  
  const hubAbi = [
    "function owner() view returns (address)",
    "function peers(uint32) view returns (bytes32)",
  ];
  
  if (HUB_ADDRESS) {
    const hub = new ethers.Contract(HUB_ADDRESS, hubAbi, provider);
    
    try {
      const owner = await hub.owner();
      console.log(`Hub owner: ${owner}`);
    } catch (e) {
      console.log("Could not read Hub owner");
    }

    // Check peers for common gateway chains
    const chainEids = [30110, 30101, 30184]; // Arbitrum, Ethereum, Base
    const chainNames = ["Arbitrum", "Ethereum", "Base"];
    
    for (let i = 0; i < chainEids.length; i++) {
      try {
        const peer = await hub.peers(chainEids[i]);
        const peerAddress = "0x" + peer.slice(-40);
        console.log(`Peer for ${chainNames[i]} (${chainEids[i]}): ${peerAddress}`);
      } catch (e) {
        console.log(`Could not read peer for ${chainNames[i]}`);
      }
    }
  }
}

main().catch(console.error);

