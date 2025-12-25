import { ethers } from "hardhat";

const V3LP_VAULT = "0x31dd8EC6773f29e361d77e51B7eEDaCaB72A2999";

async function main() {
  const [signer] = await ethers.getSigners();
  
  const vault = new ethers.Contract(V3LP_VAULT, [
    "function configureLayers(uint24[]) external",
    "function getLayerCount() view returns (uint256)",
    "function pool() view returns (address)",
  ], signer);
  
  console.log("V3LPVault:");
  
  try {
    const pool = await vault.pool();
    console.log("  pool:", pool);
  } catch (e: any) {
    console.log("  pool error:", e.message.slice(0, 100));
  }
  
  try {
    const count = await vault.getLayerCount();
    console.log("  layer count:", count.toString());
  } catch (e: any) {
    console.log("  layer count error:", e.message.slice(0, 100));
  }
  
  console.log("\nConfiguring layers with gas limit...");
  try {
    const tx = await vault.configureLayers([10, 50, 100, 200], { gasLimit: 500000 });
    await tx.wait();
    console.log("Configured!");
  } catch (e: any) {
    console.log("Error:", e.reason || e.message.slice(0, 200));
  }
}

main().catch(console.error);


