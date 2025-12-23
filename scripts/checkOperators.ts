import { ethers } from "hardhat";

const V3LP_VAULT = "0x1139d155D39b2520047178444C51D3D70204650F";
const LEVERAGE_AMM = "0x8CA24d00ffcF60e9ba7F67F9d41ccA28E22dF508";

async function main() {
  const provider = ethers.provider;
  const [signer] = await ethers.getSigners();
  
  console.log("=== Checking V3LPVault Operators ===\n");

  // isOperator is a mapping, let's calculate the storage slot
  // mapping(address => bool) at slot X
  // For isOperator[LEVERAGE_AMM], slot = keccak256(LEVERAGE_AMM . slot_of_mapping)
  
  // First, let's check with a direct contract call
  // Try raw call with isOperator(address) selector
  const isOperatorSelector = ethers.utils.id("isOperator(address)").slice(0, 10);
  const encodedAMM = ethers.utils.defaultAbiCoder.encode(["address"], [LEVERAGE_AMM]).slice(2);
  
  try {
    const result = await provider.call({
      to: V3LP_VAULT,
      data: isOperatorSelector + encodedAMM
    });
    console.log("isOperator(LeverageAMM) raw result:", result);
    const isOperator = ethers.BigNumber.from(result).gt(0);
    console.log("LeverageAMM is operator:", isOperator);
  } catch (e: any) {
    console.log("isOperator call failed:", e.message?.slice(0, 100));
  }

  // Check owner
  const ownerSelector = ethers.utils.id("owner()").slice(0, 10);
  try {
    const result = await provider.call({
      to: V3LP_VAULT,
      data: ownerSelector
    });
    const owner = ethers.utils.getAddress("0x" + result.slice(-40));
    console.log("\nV3LPVault owner:", owner);
    console.log("Owner is signer:", owner.toLowerCase() === signer.address.toLowerCase());
  } catch (e: any) {
    console.log("owner() failed:", e.message?.slice(0, 100));
  }

  // Let's also check the layers array length
  // layers is a dynamic array, so slot contains length
  // Let's find which slot it's in
  console.log("\n--- Checking V3LPVault Storage ---");
  for (let i = 0; i < 20; i++) {
    const slot = await provider.getStorageAt(V3LP_VAULT, i);
    if (slot !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      console.log(`Slot ${i}: ${slot}`);
    }
  }
}

main().catch(console.error);
