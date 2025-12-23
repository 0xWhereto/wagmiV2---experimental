import { ethers } from "hardhat";

const RESCUER = "0xa8C0904Cc7252Aa3F36d297239AeDcEeF069d6AE";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

const VAULTS_WITH_STUCK_TOKENS = [
  { name: "v7", address: "0xd612B7C469b246bE3Ee736205bD22eE260Cb4540" },
  { name: "v8a", address: "0xAc2fCBDdaDe5BD1920909054B03Ad4641f971b8E" },
  { name: "v8c", address: "0x9a63d16Ecdf83af6bF56fF7e9cF78284d9CEA0a0" },
];

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Rescuing with:", signer.address);
  
  const sWETH = new ethers.Contract(SWETH, [
    "function balanceOf(address) view returns (uint256)",
  ], signer);
  
  const sWETHBefore = await sWETH.balanceOf(signer.address);
  console.log("\nInitial sWETH balance:", ethers.utils.formatEther(sWETHBefore));
  
  // Deploy a new V3LPVault with rescueTokens function to use as implementation
  console.log("\n1. Deploying new V3LPVault with rescueTokens...");
  const V3LPVault = await ethers.getContractFactory("contracts/0IL/core/V3LPVault.sol:V3LPVault");
  
  // We need a valid pool for the constructor - use the current pool
  const newV3LP = await V3LPVault.deploy(
    "0x5826e10B513C891910032F15292B2F1b3041C3Df", // positionManager
    "0x4ed3B3e2AD7e19124D921fE2F6956e1C62Cbf190"  // pool
  );
  await newV3LP.deployed();
  console.log("   New V3LPVault:", newV3LP.address);
  
  // For each old vault, we can try calling rescueTokens directly since the NEW code has it
  // Wait - that won't work. The old deployed contracts don't have rescueTokens.
  
  // Let's check each vault
  for (const vault of VAULTS_WITH_STUCK_TOKENS) {
    console.log(`\n=== ${vault.name} ===`);
    
    const v3LPVault = new ethers.Contract(vault.address, [
      "function owner() view returns (address)",
      "function rescueTokens(address,uint256) external",
      "function getLayerCount() view returns (uint256)",
      "function layers(uint256) view returns (int24,int24,uint256,uint256,uint128)",
      "function removeLiquidity(uint256,uint256,uint256) external returns (uint256,uint256)",
    ], signer);
    
    const vaultSWETH = await sWETH.balanceOf(vault.address);
    console.log("  sWETH stuck:", ethers.utils.formatEther(vaultSWETH));
    
    // Check if there's remaining liquidity
    const layerCount = await v3LPVault.getLayerCount();
    let totalLiq = ethers.BigNumber.from(0);
    for (let i = 0; i < layerCount.toNumber(); i++) {
      const layer = await v3LPVault.layers(i);
      totalLiq = totalLiq.add(layer[4]);
    }
    console.log("  Total liquidity:", totalLiq.toString());
    
    // If there's liquidity, try to remove it
    if (totalLiq.gt(0)) {
      console.log("  Trying removeLiquidity...");
      try {
        const tx = await v3LPVault.removeLiquidity(10000, 0, 0, { gasLimit: 2000000 });
        await tx.wait();
        console.log("  ✓ Liquidity removed!");
      } catch (e: any) {
        console.log("  ✗ Failed:", e.message?.slice(0, 80));
      }
    }
    
    // Try rescueTokens (will fail on old contracts, but let's see)
    if (vaultSWETH.gt(0)) {
      console.log("  Trying rescueTokens...");
      try {
        const tx = await v3LPVault.rescueTokens(SWETH, 0, { gasLimit: 500000 });
        await tx.wait();
        console.log("  ✓ Tokens rescued!");
      } catch (e: any) {
        console.log("  ✗ rescueTokens not available on this contract");
      }
    }
  }
  
  // Check final balance
  const sWETHAfter = await sWETH.balanceOf(signer.address);
  console.log("\n=== RESULTS ===");
  console.log("Final sWETH balance:", ethers.utils.formatEther(sWETHAfter));
  console.log("sWETH recovered:", ethers.utils.formatEther(sWETHAfter.sub(sWETHBefore)));
}

main().catch(console.error);

