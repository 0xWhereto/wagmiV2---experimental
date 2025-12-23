import { ethers } from "hardhat";

const V3LP_VAULT = "0x1139d155D39b2520047178444C51D3D70204650F";
const LEVERAGE_AMM = "0x8CA24d00ffcF60e9ba7F67F9d41ccA28E22dF508";

async function main() {
  const provider = ethers.provider;
  
  console.log("=== Checking Contract Bytecode ===\n");

  // Get bytecode
  const v3Code = await provider.getCode(V3LP_VAULT);
  const ammCode = await provider.getCode(LEVERAGE_AMM);
  
  console.log("V3LPVault bytecode length:", v3Code.length);
  console.log("LeverageAMM bytecode length:", ammCode.length);
  
  if (v3Code === "0x") {
    console.log("❌ V3LPVault has no bytecode (not deployed or selfdestructed)");
  } else {
    console.log("✅ V3LPVault has bytecode");
  }
  
  if (ammCode === "0x") {
    console.log("❌ LeverageAMM has no bytecode (not deployed or selfdestructed)");
  } else {
    console.log("✅ LeverageAMM has bytecode");
  }

  // Try raw call to layerCount
  console.log("\n--- Raw Call Tests ---");
  
  // layerCount() selector = 0x77f5a5d3
  try {
    const result = await provider.call({
      to: V3LP_VAULT,
      data: "0x77f5a5d3" // layerCount()
    });
    console.log("layerCount() raw result:", result);
  } catch (e: any) {
    console.log("layerCount() raw call failed:", e.message?.slice(0, 100));
  }

  // Check storage slots
  console.log("\n--- Storage Slot Reads ---");
  
  // Read first few storage slots
  for (let i = 0; i < 10; i++) {
    const slot = await provider.getStorageAt(V3LP_VAULT, i);
    if (slot !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      console.log(`Slot ${i}: ${slot}`);
    }
  }
  
  // Also check LeverageAMM storage
  console.log("\n--- LeverageAMM Storage ---");
  for (let i = 0; i < 10; i++) {
    const slot = await provider.getStorageAt(LEVERAGE_AMM, i);
    if (slot !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      console.log(`Slot ${i}: ${slot}`);
    }
  }
}

main().catch(console.error);
