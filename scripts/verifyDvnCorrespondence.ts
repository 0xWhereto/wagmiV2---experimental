import { ethers } from "hardhat";

// DVNs used
const ARB_DVN = "0x2f55C492897526677C5B68fb199ea31E2c126416";  // Gateway sends with this
const OLD_SONIC_DVN = "0x6788f52439ACA6BFF597d3eeC2DC9a44B8FEE842";  // OLD Hub expects this
const WRONG_SONIC_DVN = "0x282b3386571f7f794450d5789911a9804FA346b4";  // NEW Hub expected this (wrong)

async function main() {
  console.log("=== DVN CORRESPONDENCE CHECK ===\n");
  
  console.log("Gateway (Arbitrum) sends with: " + ARB_DVN);
  console.log("OLD Hub (Sonic) expected:      " + OLD_SONIC_DVN);
  console.log("NEW Hub (Sonic) was expecting: " + WRONG_SONIC_DVN);
  console.log("\nWe just changed NEW Hub to expect: " + OLD_SONIC_DVN);
  
  // In LayerZero V2, the DVN addresses on different chains can be different
  // but they are part of the same DVN network. Let me check both DVN contracts.
  
  const [deployer] = await ethers.getSigners();
  
  console.log("\n=== CHECKING DVN CONTRACTS ON SONIC ===");
  
  for (const [name, dvn] of [["OLD (correct)", OLD_SONIC_DVN], ["WRONG", WRONG_SONIC_DVN]]) {
    const code = await deployer.provider!.getCode(dvn);
    console.log(`${name}: ${dvn}`);
    console.log(`  Has code: ${code.length > 2}`);
  }
  
  // Now let's verify the pending messages will be delivered
  console.log("\n=== CHECKING PENDING MESSAGE STATUS ===");
  
  const NEW_HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
  const LZ_ENDPOINT = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
  const NEW_ARB_GW = "0x527f843672C4CD7F45B126f3E1E82D60A741C609";
  const ARB_EID = 30110;
  
  const endpointAbi = [
    "function inboundNonce(address, uint32, bytes32) view returns (uint64)",
    "function lazyInboundNonce(address, uint32, bytes32) view returns (uint64)",
  ];
  
  const endpoint = new ethers.Contract(LZ_ENDPOINT, endpointAbi, deployer);
  const senderBytes = ethers.utils.hexZeroPad(NEW_ARB_GW, 32);
  
  const inbound = await endpoint.inboundNonce(NEW_HUB, ARB_EID, senderBytes);
  const lazy = await endpoint.lazyInboundNonce(NEW_HUB, ARB_EID, senderBytes);
  
  console.log(`Inbound nonce (executed): ${inbound}`);
  console.log(`Lazy inbound nonce (verified but not executed): ${lazy}`);
  
  if (lazy.gt(inbound)) {
    console.log(`\n✅ ${lazy.sub(inbound)} messages are VERIFIED and waiting to be EXECUTED!`);
    console.log("The executor should pick them up now that DVN is fixed.");
  } else {
    console.log("\n⚠️ No verified-but-unexecuted messages.");
    console.log("Messages may need to be re-verified with the correct DVN.");
  }
}

main().catch(console.error);
