import { ethers } from "hardhat";

// v7 vault - largest balance
const V7_WETH = "0xB96651342aE83BfCf509659D16Fd41712B0c58b3";

async function main() {
  const [signer] = await ethers.getSigners();
  
  const wETH = new ethers.Contract(V7_WETH, [
    "function balanceOf(address) view returns (uint256)",
    "function leverageAMM() view returns (address)",
    "function v3LPVault() view returns (address)",
    "function underlyingAsset() view returns (address)",
    "function totalDeposited() view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function pricePerShare() view returns (uint256)",
    "function getTotalValue() view returns (uint256)",
    "function withdraw(uint256,uint256) external returns (uint256)",
  ], signer);
  
  console.log("V7 wETH Vault:", V7_WETH);
  
  const leverageAMM = await wETH.leverageAMM();
  const v3LPVault = await wETH.v3LPVault();
  const underlying = await wETH.underlyingAsset();
  
  console.log("\nDependencies:");
  console.log("  leverageAMM:", leverageAMM);
  console.log("  v3LPVault:", v3LPVault);
  console.log("  underlyingAsset:", underlying);
  
  const balance = await wETH.balanceOf(signer.address);
  const totalSupply = await wETH.totalSupply();
  const totalDeposited = await wETH.totalDeposited();
  
  console.log("\nVault State:");
  console.log("  User balance:", ethers.utils.formatEther(balance));
  console.log("  Total supply:", ethers.utils.formatEther(totalSupply));
  console.log("  Total deposited:", ethers.utils.formatEther(totalDeposited));
  
  try {
    const pps = await wETH.pricePerShare();
    console.log("  Price per share:", ethers.utils.formatEther(pps));
  } catch (e: any) {
    console.log("  Price per share: ERROR -", e.message?.slice(0, 80));
  }
  
  try {
    const totalValue = await wETH.getTotalValue();
    console.log("  Total value:", ethers.utils.formatEther(totalValue));
  } catch (e: any) {
    console.log("  Total value: ERROR -", e.message?.slice(0, 80));
  }
  
  // Check LeverageAMM
  console.log("\nLeverageAMM state:");
  const amm = new ethers.Contract(leverageAMM, [
    "function totalDebt() view returns (uint256)",
    "function totalUnderlying() view returns (uint256)",
    "function v3LPVault() view returns (address)",
    "function oracle() view returns (address)",
    "function wToken() view returns (address)",
  ], signer);
  
  try {
    const wToken = await amm.wToken();
    console.log("  wToken:", wToken);
    console.log("  wToken matches?:", wToken.toLowerCase() === V7_WETH.toLowerCase());
  } catch (e: any) {
    console.log("  wToken: ERROR");
  }
  
  try {
    const totalDebt = await amm.totalDebt();
    console.log("  totalDebt:", ethers.utils.formatEther(totalDebt));
  } catch (e: any) {
    console.log("  totalDebt: ERROR");
  }
  
  try {
    const totalUnderlying = await amm.totalUnderlying();
    console.log("  totalUnderlying:", ethers.utils.formatEther(totalUnderlying));
  } catch (e: any) {
    console.log("  totalUnderlying: ERROR");
  }
  
  // Try simulate withdraw
  console.log("\n=== Trying to simulate withdraw ===");
  try {
    const result = await wETH.callStatic.withdraw(balance, 0, { gasLimit: 3000000 });
    console.log("Simulation success! Would receive:", ethers.utils.formatEther(result), "sWETH");
  } catch (e: any) {
    console.log("Simulation failed:", e.reason || e.message?.slice(0, 200));
    
    // Try to decode error
    if (e.data) {
      console.log("Error data:", e.data);
    }
  }
}

main().catch(console.error);


