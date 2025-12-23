import { ethers } from "hardhat";

const ADDRESSES = {
  wETH: "0x1A7c1D401048B93AA541aDb5511bE2C22813F1B8",
  leverageAMM: "0x433039d1F943E6b7E5248f18d780bD30705FcBA0",
  v3LPVault: "0x9a63d16Ecdf83af6bF56fF7e9cF78284d9CEA0a0",
  oracle: "0xD8680463F66C7bF74C61A2660aF4d7094ee9F749",
};

async function main() {
  const [signer] = await ethers.getSigners();
  
  // Check V3LPVault 
  const v3LPVault = new ethers.Contract(ADDRESSES.v3LPVault, [
    "function getTotalAssets() view returns (uint256, uint256)",
    "function getLayerCount() view returns (uint256)",
    "function layers(uint256) view returns (int24, int24, uint256, uint256, uint128)",
  ], signer);
  
  console.log("V3LPVault:");
  
  try {
    const [amount0, amount1] = await v3LPVault.getTotalAssets();
    console.log("  getTotalAssets():");
    console.log("    amount0 (sWETH):", ethers.utils.formatEther(amount0));
    console.log("    amount1 (MIM):", ethers.utils.formatEther(amount1));
  } catch (e: any) {
    console.log("  getTotalAssets error:", e.message?.slice(0, 100));
  }
  
  const layerCount = await v3LPVault.getLayerCount();
  console.log("  Layer count:", layerCount.toString());
  
  for (let i = 0; i < layerCount.toNumber(); i++) {
    const layer = await v3LPVault.layers(i);
    console.log(`  Layer ${i}:`);
    console.log(`    ticks: [${layer[0]}, ${layer[1]}]`);
    console.log(`    weight: ${layer[2].toString()}`);
    console.log(`    tokenId: ${layer[3].toString()}`);
    console.log(`    liquidity: ${layer[4].toString()}`);
  }
  
  // Check LeverageAMM
  const leverageAMM = new ethers.Contract(ADDRESSES.leverageAMM, [
    "function getTotalDebt() view returns (uint256)",
    "function totalUnderlying() view returns (uint256)",
    "function getPrice() view returns (uint256)",
  ], signer);
  
  console.log("\nLeverageAMM:");
  const totalDebt = await leverageAMM.getTotalDebt();
  const totalUnderlying = await leverageAMM.totalUnderlying();
  const price = await leverageAMM.getPrice();
  
  console.log("  totalDebt:", ethers.utils.formatEther(totalDebt), "MIM");
  console.log("  totalUnderlying:", ethers.utils.formatEther(totalUnderlying), "sWETH");
  console.log("  getPrice:", ethers.utils.formatEther(price), "MIM/sWETH");
  
  // Check WToken value calculation
  const wETH = new ethers.Contract(ADDRESSES.wETH, [
    "function getTotalValue() view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function totalDeposited() view returns (uint256)",
    "function pricePerShare() view returns (uint256)",
  ], signer);
  
  console.log("\nWToken:");
  const totalValue = await wETH.getTotalValue();
  const totalSupply = await wETH.totalSupply();
  const totalDeposited = await wETH.totalDeposited();
  const pricePerShare = await wETH.pricePerShare();
  
  console.log("  getTotalValue():", ethers.utils.formatEther(totalValue), "sWETH");
  console.log("  totalSupply:", ethers.utils.formatEther(totalSupply), "wETH");
  console.log("  totalDeposited:", ethers.utils.formatEther(totalDeposited), "sWETH");
  console.log("  pricePerShare:", ethers.utils.formatEther(pricePerShare));
  
  // Manual calculation
  console.log("\n=== Manual Value Calculation ===");
  try {
    const [amount0, amount1] = await v3LPVault.getTotalAssets();
    const priceNum = parseFloat(ethers.utils.formatEther(price));
    const amount0Num = parseFloat(ethers.utils.formatEther(amount0));
    const amount1Num = parseFloat(ethers.utils.formatEther(amount1));
    const debtNum = parseFloat(ethers.utils.formatEther(totalDebt));
    
    console.log("LP value components:");
    console.log("  amount0 (sWETH):", amount0Num);
    console.log("  amount1 (MIM):", amount1Num);
    console.log("  amount1 in sWETH terms:", amount1Num / priceNum);
    console.log("  Total LP value in sWETH:", amount0Num + amount1Num / priceNum);
    
    console.log("\nDebt:");
    console.log("  totalDebt (MIM):", debtNum);
    console.log("  Debt in sWETH terms:", debtNum / priceNum);
    
    console.log("\nNet value:");
    const lpValueInUnderlying = amount0Num + amount1Num / priceNum;
    const debtInUnderlying = debtNum / priceNum;
    console.log("  LP value - Debt:", lpValueInUnderlying - debtInUnderlying, "sWETH");
    
    // This should equal totalDeposited
    console.log("\nExpected (totalDeposited):", parseFloat(ethers.utils.formatEther(totalDeposited)), "sWETH");
    console.log("Actual (getTotalValue):", parseFloat(ethers.utils.formatEther(totalValue)), "sWETH");
    
  } catch (e: any) {
    console.log("Error:", e.message);
  }
}

main().catch(console.error);

