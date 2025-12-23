import { ethers } from "hardhat";

const LEVERAGE_AMM = "0xa883C4f63b203D59769eE75900fBfE992A358f3D";
const V3LP_VAULT = "0x31dd8EC6773f29e361d77e51B7eEDaCaB72A2999";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Configuring V3LPVault with:", signer.address);
  
  const vault = new ethers.Contract(V3LP_VAULT, [
    "function setOperator(address,bool) external",
    "function isOperator(address) view returns (bool)",
    "function configureLayers(uint24[]) external",
  ], signer);
  
  console.log("isOperator(LeverageAMM):", await vault.isOperator(LEVERAGE_AMM));
  
  console.log("Setting LeverageAMM as operator...");
  const tx = await vault.setOperator(LEVERAGE_AMM, true);
  await tx.wait();
  
  console.log("After:", await vault.isOperator(LEVERAGE_AMM));
  
  // Configure default layers (Curve-style distribution)
  console.log("\nConfiguring liquidity layers...");
  // tickRanges: [1, 2, 4, 8] means layers at ±tickSpacing, ±2*tickSpacing, etc.
  try {
    const layersTx = await vault.configureLayers([1, 2, 4, 8]);
    await layersTx.wait();
    console.log("Layers configured!");
  } catch (e: any) {
    console.log("Layers config error (may already be set):", e.message?.slice(0, 100));
  }
  
  console.log("Done!");
}

main().catch(console.error);

