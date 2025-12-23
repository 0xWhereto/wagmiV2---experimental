import { ethers } from "hardhat";

const V3LP_VAULT = "0xd612B7C469b246bE3Ee736205bD22eE260Cb4540";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Configuring V3LPVault layers with:", signer.address);
  
  const vault = new ethers.Contract(V3LP_VAULT, [
    "function configureLayers(int24[],uint256[]) external",
    "function getLayerCount() view returns (uint256)",
    "function layers(uint256) view returns (int24,int24,uint256,uint256,uint128)",
  ], signer);
  
  // Configure Curve-style layers: 
  // Layer 1: ±10 tick spacing (tightest, highest weight)
  // Layer 2: ±50 tick spacing
  // Layer 3: ±100 tick spacing
  // Layer 4: ±200 tick spacing (widest, lowest weight)
  const tickRanges = [10, 50, 100, 200]; // in tick spacing units
  const weights = [4000, 3000, 2000, 1000]; // must sum to 10000
  
  console.log("\nConfiguring layers:");
  console.log("  Tick ranges:", tickRanges);
  console.log("  Weights:", weights, "(sum:", weights.reduce((a,b)=>a+b), ")");
  
  try {
    const tx = await vault.configureLayers(tickRanges, weights);
    await tx.wait();
    console.log("\nLayers configured!");
    
    const count = await vault.getLayerCount();
    console.log("Layer count:", count.toString());
    
    for (let i = 0; i < count.toNumber(); i++) {
      const layer = await vault.layers(i);
      console.log(`Layer ${i}: ticks [${layer[0]}, ${layer[1]}], weight ${layer[2].toString()}`);
    }
  } catch (e: any) {
    console.log("Error:", e.reason || e.message);
  }
}

main().catch(console.error);

