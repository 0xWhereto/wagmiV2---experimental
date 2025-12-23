import { ethers } from "hardhat";

const OLD_VAULTS = [
  {
    name: "v7",
    v3LPVault: "0xd612B7C469b246bE3Ee736205bD22eE260Cb4540",
  },
  {
    name: "v8c",  
    v3LPVault: "0x9a63d16Ecdf83af6bF56fF7e9cF78284d9CEA0a0",
  },
];

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Deploying rescuer with:", signer.address);
  
  // Check initial balances
  const sWETH = new ethers.Contract(SWETH, [
    "function balanceOf(address) view returns (uint256)",
  ], signer);
  const mim = new ethers.Contract(MIM, [
    "function balanceOf(address) view returns (uint256)",
  ], signer);
  
  const sWETHBefore = await sWETH.balanceOf(signer.address);
  console.log("\nInitial sWETH balance:", ethers.utils.formatEther(sWETHBefore));
  
  // Deploy VaultRescuer
  console.log("\n1. Deploying VaultRescuer...");
  const VaultRescuer = await ethers.getContractFactory("contracts/0IL/helpers/VaultRescuer.sol:VaultRescuer");
  const rescuer = await VaultRescuer.deploy();
  await rescuer.deployed();
  console.log("   VaultRescuer:", rescuer.address);
  
  // Process each old vault
  for (const vault of OLD_VAULTS) {
    console.log(`\n=== Processing ${vault.name} ===`);
    console.log("V3LPVault:", vault.v3LPVault);
    
    const v3LPVault = new ethers.Contract(vault.v3LPVault, [
      "function setOperator(address,bool) external",
      "function isOperator(address) view returns (bool)",
      "function owner() view returns (address)",
      "function getLayerCount() view returns (uint256)",
      "function layers(uint256) view returns (int24,int24,uint256,uint256,uint128)",
    ], signer);
    
    // Check ownership
    const vaultOwner = await v3LPVault.owner();
    console.log("  Owner:", vaultOwner);
    console.log("  We are owner:", vaultOwner.toLowerCase() === signer.address.toLowerCase());
    
    if (vaultOwner.toLowerCase() !== signer.address.toLowerCase()) {
      console.log("  Skipping - not owner");
      continue;
    }
    
    // Set rescuer as operator
    console.log("  Setting rescuer as operator...");
    try {
      await (await v3LPVault.setOperator(rescuer.address, true)).wait();
      console.log("  Operator set!");
    } catch (e: any) {
      console.log("  setOperator failed:", e.message?.slice(0, 50));
      continue;
    }
    
    // Check layers
    const layerCount = await v3LPVault.getLayerCount();
    console.log("  Layers:", layerCount.toString());
    
    // Show layer info
    for (let i = 0; i < layerCount.toNumber(); i++) {
      const layer = await v3LPVault.layers(i);
      console.log(`  Layer ${i}: liquidity = ${layer[4].toString()}`);
    }
    
    // Try to rescue all liquidity at once (100% = 10000 basis points)
    console.log("  Rescuing all liquidity...");
    try {
      const tx = await rescuer.rescueAllLiquidity(vault.v3LPVault, { gasLimit: 2000000 });
      await tx.wait();
      console.log("  ✓ All liquidity rescued!");
    } catch (e: any) {
      console.log(`  ✗ Failed: ${e.reason || e.message?.slice(0, 100)}`);
    }
    
    // Collect any fees
    try {
      await (await rescuer.collectVaultFees(vault.v3LPVault, { gasLimit: 500000 })).wait();
      console.log("  Fees collected");
    } catch (e: any) {
      console.log("  collectFees:", e.message?.slice(0, 50));
    }
  }
  
  // Withdraw rescued tokens from rescuer
  console.log("\n=== Withdrawing rescued tokens ===");
  
  const rescuerSWETH = await sWETH.balanceOf(rescuer.address);
  const rescuerMIM = await mim.balanceOf(rescuer.address);
  console.log("Tokens in rescuer:");
  console.log("  sWETH:", ethers.utils.formatEther(rescuerSWETH));
  console.log("  MIM:", ethers.utils.formatEther(rescuerMIM));
  
  if (rescuerSWETH.gt(0)) {
    await (await rescuer.withdrawToken(SWETH)).wait();
    console.log("  sWETH withdrawn!");
  }
  
  if (rescuerMIM.gt(0)) {
    await (await rescuer.withdrawToken(MIM)).wait();
    console.log("  MIM withdrawn!");
  }
  
  // Final balance
  const sWETHAfter = await sWETH.balanceOf(signer.address);
  console.log("\n=== RESULTS ===");
  console.log("Final sWETH balance:", ethers.utils.formatEther(sWETHAfter));
  console.log("sWETH recovered:", ethers.utils.formatEther(sWETHAfter.sub(sWETHBefore)));
}

main().catch(console.error);
