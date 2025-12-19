import hardhat, { ethers } from "hardhat";

/**
 * Check for pending/failed LayerZero messages on the Hub
 */

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const LZ_ENDPOINT = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
const ARBITRUM_EID = 30110;
const ARBITRUM_GATEWAY = "0xb867d9E9D374E8b1165bcDF6D3f66d1A9AAd2447";

// EndpointV2 ABI for checking message status
const ENDPOINT_ABI = [
  // Nonces
  "function inboundNonce(address receiver, uint32 srcEid, bytes32 sender) view returns (uint64)",
  "function lazyInboundNonce(address receiver, uint32 srcEid, bytes32 sender) view returns (uint64)",
  // Payload hash (for failed messages)
  "function inboundPayloadHash(address receiver, uint32 srcEid, bytes32 sender, uint64 nonce) view returns (bytes32)",
];

function addressToBytes32(address: string): string {
  return ethers.utils.hexZeroPad(address, 32);
}

async function main() {
  const network = hardhat.network.name;
  if (network !== "sonic") {
    console.log("This script should be run on Sonic network");
    return;
  }

  console.log(`\n========================================`);
  console.log(`Checking Pending Messages on SONIC Hub`);
  console.log(`========================================`);

  const endpoint = await ethers.getContractAt(ENDPOINT_ABI, LZ_ENDPOINT);
  const senderBytes32 = addressToBytes32(ARBITRUM_GATEWAY);

  // Get current nonces
  const inboundNonce = await endpoint.inboundNonce(HUB_ADDRESS, ARBITRUM_EID, senderBytes32);
  const lazyNonce = await endpoint.lazyInboundNonce(HUB_ADDRESS, ARBITRUM_EID, senderBytes32);
  
  console.log(`\nInbound nonce: ${inboundNonce}`);
  console.log(`Lazy inbound nonce: ${lazyNonce}`);
  
  // Check payload hashes for each nonce
  console.log("\n--- Checking payload hashes for each message ---");
  
  for (let nonce = 1n; nonce <= inboundNonce; nonce++) {
    try {
      const payloadHash = await endpoint.inboundPayloadHash(HUB_ADDRESS, ARBITRUM_EID, senderBytes32, nonce);
      console.log(`\nNonce ${nonce}:`);
      console.log(`  Payload hash: ${payloadHash}`);
      
      if (payloadHash === ethers.constants.HashZero) {
        console.log(`  Status: ✓ Successfully executed (no pending payload)`);
      } else {
        console.log(`  Status: ⚠️ PENDING/FAILED - Has stored payload hash!`);
        console.log(`  This message needs to be retried or cleared.`);
      }
    } catch (e: any) {
      console.log(`\nNonce ${nonce}: Error - ${e.message?.slice(0, 80)}`);
    }
  }

  // Diagnosis
  console.log("\n========================================");
  console.log("DIAGNOSIS:");
  if (inboundNonce > lazyNonce) {
    console.log(`There are ${Number(inboundNonce) - Number(lazyNonce)} messages that haven't been fully processed.`);
  }
  console.log("\nIf payload hash is non-zero, the message execution failed.");
  console.log("Options:");
  console.log("1. Fix the issue and retry the message via lzReceive");
  console.log("2. Skip the message (skip the nonce)");
  console.log("3. Clear the message (requires the original payload)");
  console.log("\nTo retry failed messages, you need to call lzReceive with:");
  console.log("- origin (srcEid, sender, nonce)");
  console.log("- guid");
  console.log("- original message payload");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

