import { ethers } from "hardhat";

// Old working tx
const OLD_TX = "0x3797d3c05dbd236b15fb122bd736c6f3add78cd736db1f01838e0c53b4082fa7";

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  console.log("=== CHECKING OLD WORKING TRANSACTION ===\n");
  
  try {
    const tx = await provider.getTransaction(OLD_TX);
    if (!tx) {
      console.log("Transaction not found on Arbitrum");
      return;
    }
    
    console.log(`To (Gateway): ${tx.to}`);
    console.log(`Block: ${tx.blockNumber}`);
    console.log(`Value: ${ethers.utils.formatEther(tx.value)} ETH`);
    
    // This was sent to the OLD gateway
    console.log("\n=== COMPARING GATEWAY CONFIGS ===");
    
    const OLD_GATEWAY = tx.to; // Should be the old gateway
    const NEW_GATEWAY = "0x527f843672C4CD7F45B126f3E1E82D60A741C609";
    const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
    const SONIC_EID = 30332;
    
    console.log(`OLD Gateway: ${OLD_GATEWAY}`);
    console.log(`NEW Gateway: ${NEW_GATEWAY}`);
    
    // Check if old gateway pointed to same Hub
    const gatewayAbi = [
      "function peers(uint32) view returns (bytes32)",
      "function DST_EID() view returns (uint32)",
    ];
    
    const oldGw = new ethers.Contract(OLD_GATEWAY!, gatewayAbi, provider);
    const newGw = new ethers.Contract(NEW_GATEWAY, gatewayAbi, provider);
    
    const oldPeer = await oldGw.peers(SONIC_EID);
    const newPeer = await newGw.peers(SONIC_EID);
    
    console.log(`\nOLD Gateway peer: ${oldPeer}`);
    console.log(`NEW Gateway peer: ${newPeer}`);
    
    const expectedHub = ethers.utils.hexZeroPad(HUB, 32).toLowerCase();
    console.log(`Expected Hub:     ${expectedHub}`);
    
    if (oldPeer.toLowerCase() === newPeer.toLowerCase()) {
      console.log("\n✅ Both gateways point to the same Hub");
    } else {
      console.log("\n⚠️ Gateways point to different Hubs!");
    }
    
  } catch (e: any) {
    console.log(`Error: ${e.message?.substring(0, 100)}`);
  }
}

main().catch(console.error);
