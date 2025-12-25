import { ethers } from "hardhat";

const V7_LEVERAGE_AMM = "0xF42441EBdc79D15252fBa87Df7682FA543a508A6";
const V7_V3LP_VAULT = "0xd612B7C469b246bE3Ee736205bD22eE260Cb4540";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Emergency rescue with:", signer.address);
  
  const sWETH = new ethers.Contract(SWETH, [
    "function balanceOf(address) view returns (uint256)",
  ], signer);
  
  const mim = new ethers.Contract(MIM, [
    "function balanceOf(address) view returns (uint256)",
  ], signer);
  
  const sWETHBefore = await sWETH.balanceOf(signer.address);
  const mimBefore = await mim.balanceOf(signer.address);
  console.log("\nBefore:");
  console.log("  sWETH:", ethers.utils.formatEther(sWETHBefore));
  console.log("  MIM:", ethers.utils.formatEther(mimBefore));
  
  // Option 1: Try emergencyDeleverage on LeverageAMM
  console.log("\n=== Trying emergencyDeleverage ===");
  const leverageAMM = new ethers.Contract(V7_LEVERAGE_AMM, [
    "function emergencyDeleverage() external",
    "function owner() view returns (address)",
  ], signer);
  
  try {
    const tx = await leverageAMM.emergencyDeleverage({ gasLimit: 3000000 });
    await tx.wait();
    console.log("emergencyDeleverage succeeded!");
  } catch (e: any) {
    console.log("emergencyDeleverage failed:", e.reason || e.message?.slice(0, 150));
  }
  
  // Option 2: Try to decrease liquidity directly from V3LPVault
  console.log("\n=== Checking V3LPVault direct access ===");
  const v3LPVault = new ethers.Contract(V7_V3LP_VAULT, [
    "function layers(uint256) view returns (int24,int24,uint256,uint256,uint128)",
    "function decreaseLiquidity(uint256,uint128) external returns (uint256,uint256)",
    "function collectFees() external returns (uint256,uint256)",
    "function owner() view returns (address)",
  ], signer);
  
  // Try collecting fees first
  try {
    const feeTx = await v3LPVault.collectFees({ gasLimit: 1000000 });
    await feeTx.wait();
    console.log("Fees collected!");
  } catch (e: any) {
    console.log("collectFees failed:", e.reason || e.message?.slice(0, 100));
  }
  
  // Try decreasing liquidity from layer 0
  try {
    const layer = await v3LPVault.layers(0);
    const tokenId = layer[3];
    const liquidity = layer[4];
    console.log(`\nLayer 0: tokenId=${tokenId}, liquidity=${liquidity.toString()}`);
    
    if (liquidity.gt(0)) {
      console.log("Trying to decrease liquidity...");
      const decTx = await v3LPVault.decreaseLiquidity(tokenId, liquidity, { gasLimit: 1000000 });
      await decTx.wait();
      console.log("Liquidity decreased!");
    }
  } catch (e: any) {
    console.log("decreaseLiquidity failed:", e.reason || e.message?.slice(0, 100));
  }
  
  const sWETHAfter = await sWETH.balanceOf(signer.address);
  const mimAfter = await mim.balanceOf(signer.address);
  console.log("\nAfter:");
  console.log("  sWETH:", ethers.utils.formatEther(sWETHAfter));
  console.log("  MIM:", ethers.utils.formatEther(mimAfter));
  console.log("\nRecovered:");
  console.log("  sWETH:", ethers.utils.formatEther(sWETHAfter.sub(sWETHBefore)));
  console.log("  MIM:", ethers.utils.formatEther(mimAfter.sub(mimBefore)));
}

main().catch(console.error);


