import { ethers } from "hardhat";

const txHashes = [
  "0x665f3d56325d8860917e524e04390bc64a6aba1adbaa55284d92851855f1987f", // sWETH
  "0x5c2907e822cf4224090185b029a32646c49819acbef10b996f93577c41910cc3", // sBTC
  "0xb54c8fb264030dd425ba6df7c463c367bb0cb4c5e21f58d18f4a1bda960f81bc", // sUSDC
  "0x38dcca0d1922fa45cd715f887545956c16ab900326c86ec794f3c969e15e19f7", // sUSDT
];

const names = ["sWETH", "sBTC", "sUSDC", "sUSDT"];

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");
  
  console.log("Fetching synthetic token addresses from transaction logs...\n");

  for (let i = 0; i < txHashes.length; i++) {
    const receipt = await provider.getTransactionReceipt(txHashes[i]);
    
    // The first log's address is typically the created token
    // Or parse the SyntheticTokenCreated event
    if (receipt && receipt.logs.length > 0) {
      // Look for the token address in the event - the first topic after the signature is the indexed address
      for (const log of receipt.logs) {
        // SyntheticTokenCreated event signature
        if (log.topics.length >= 2) {
          // First indexed param is the token address
          const tokenAddress = "0x" + log.topics[1].slice(26);
          console.log(`${names[i]}: "${ethers.utils.getAddress(tokenAddress)}",`);
          break;
        }
      }
    }
  }
}

main().catch(console.error);
