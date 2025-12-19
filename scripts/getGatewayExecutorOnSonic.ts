import { ethers } from "hardhat";

// The executor on the Arbitrum side that's configured
const ARB_EXECUTOR = "0x31CAe3B7fB82d847621859fb1585353c5720660D";

async function main() {
  console.log("=== LZ V2 EXECUTOR ARCHITECTURE ===\n");
  
  console.log("In LayerZero V2:");
  console.log("1. User sends tx on source chain (Arbitrum)");
  console.log("2. Source chain executor config determines which executor handles the message");
  console.log("3. The executor SERVICE (off-chain) picks up verified messages");
  console.log("4. Executor calls commitVerification() then lzReceive() on destination");
  console.log("");
  console.log("The executor address on Arbitrum: " + ARB_EXECUTOR);
  console.log("This is NOT a contract that needs to be deployed on Sonic.");
  console.log("It's used by LayerZero's off-chain executor service to know where to relay.");
  console.log("");
  console.log("The issue is likely that LayerZero's executor service isn't actively");
  console.log("monitoring/executing messages for Sonic (chain 146) yet.");
  
  // Check if messages might be executable manually
  const [deployer] = await ethers.getSigners();
  
  console.log("\n=== CHECKING IF MANUAL EXECUTION IS POSSIBLE ===\n");
  
  const LZ_ENDPOINT_SONIC = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
  const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
  const ARB_EID = 30110;
  const ARB_GATEWAY = "0x527f843672C4CD7F45B126f3E1E82D60A741C609";
  
  const endpointAbi = [
    "function executable(tuple(uint32 srcEid, bytes32 sender, uint64 nonce) origin, address receiver) view returns (uint8)",
    "function inboundNonce(address receiver, uint32 srcEid, bytes32 sender) view returns (uint64)",
    "function lazyInboundNonce(address receiver, uint32 srcEid, bytes32 sender) view returns (uint64)",
  ];
  
  const endpoint = new ethers.Contract(LZ_ENDPOINT_SONIC, endpointAbi, deployer);
  
  const senderBytes32 = ethers.utils.hexZeroPad(ARB_GATEWAY, 32);
  
  // Check nonces
  try {
    const inbound = await endpoint.inboundNonce(HUB, ARB_EID, senderBytes32);
    const lazy = await endpoint.lazyInboundNonce(HUB, ARB_EID, senderBytes32);
    console.log(`Inbound nonce: ${inbound} (messages received)`);
    console.log(`Lazy inbound nonce: ${lazy} (messages verified but not executed)`);
    
    // Check if next message is executable
    const nextNonce = inbound.add(1);
    const origin = { srcEid: ARB_EID, sender: senderBytes32, nonce: nextNonce };
    
    try {
      const execStatus = await endpoint.executable(origin, HUB);
      // 0 = NotExecutable, 1 = Executable, 2 = Executed
      const statusMap: Record<number, string> = {0: "NotExecutable", 1: "Executable", 2: "Executed"};
      console.log(`\nNonce ${nextNonce} status: ${statusMap[execStatus] || execStatus}`);
    } catch (e) {
      console.log("Could not check executable status");
    }
  } catch (e: any) {
    console.log(`Error: ${e.message?.substring(0, 80)}`);
  }
}

main().catch(console.error);
