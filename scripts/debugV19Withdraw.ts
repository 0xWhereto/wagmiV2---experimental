import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const WTOKEN = "0x998E56B74e0c0D94c4315aD2EfC79a99868c67A3";
const LEVERAGE_AMM = "0x897074004705Ca3C578e403090F1FF397A7807Bb";
const V3_VAULT = "0x64B933Ce0536f5508cf9Ccec9628E969434dc8E1";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Debug V19 Withdrawal ===\n");
  
  const wToken = new ethers.Contract(WTOKEN, [
    "function balanceOf(address) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function withdraw(uint256 shares, uint256 minAmount) external returns (uint256)"
  ], signer);
  
  const leverageAMM = new ethers.Contract(LEVERAGE_AMM, [
    "function totalDebt() view returns (uint256)",
    "function totalUnderlying() view returns (uint256)",
    "function getCurrentDTV() view returns (uint256)"
  ], signer);
  
  const v3Vault = new ethers.Contract(V3_VAULT, [
    "function getTotalAssets() view returns (uint256, uint256)",
    "function getLayerCount() view returns (uint256)",
    "function layers(uint256) view returns (int24,int24,uint256,uint256,uint128)"
  ], signer);
  
  const mim = new ethers.Contract(MIM, ["function balanceOf(address) view returns (uint256)"], signer);
  const sweth = new ethers.Contract(SWETH, ["function balanceOf(address) view returns (uint256)"], signer);
  
  // Check state
  const wTokenBal = await wToken.balanceOf(signer.address);
  const totalSupply = await wToken.totalSupply();
  console.log("User wETH balance:", ethers.utils.formatEther(wTokenBal));
  console.log("Total wETH supply:", ethers.utils.formatEther(totalSupply));
  
  const totalDebt = await leverageAMM.totalDebt();
  const totalUnderlying = await leverageAMM.totalUnderlying();
  console.log("\nLeverageAMM state:");
  console.log("  totalDebt:", ethers.utils.formatEther(totalDebt), "MIM");
  console.log("  totalUnderlying:", ethers.utils.formatEther(totalUnderlying), "sWETH");
  console.log("  DTV:", ethers.utils.formatEther(await leverageAMM.getCurrentDTV()));
  
  const [amount0, amount1] = await v3Vault.getTotalAssets();
  console.log("\nV3LPVault assets:");
  console.log("  sWETH (token0):", ethers.utils.formatEther(amount0));
  console.log("  MIM (token1):", ethers.utils.formatEther(amount1));
  
  // Check layers
  console.log("\nV3 Layers:");
  const layerCount = await v3Vault.getLayerCount();
  for (let i = 0; i < layerCount; i++) {
    const layer = await v3Vault.layers(i);
    console.log(`  Layer ${i}: tokenId=${layer[3].toString()}, liquidity=${layer[4].toString()}`);
  }
  
  // Check MIM in LeverageAMM
  console.log("\nMIM in LeverageAMM:", ethers.utils.formatEther(await mim.balanceOf(LEVERAGE_AMM)));
  console.log("sWETH in LeverageAMM:", ethers.utils.formatEther(await sweth.balanceOf(LEVERAGE_AMM)));
  
  // Simulate withdrawal
  console.log("\nSimulating withdrawal...");
  try {
    const result = await wToken.callStatic.withdraw(wTokenBal, 0, { gasLimit: 2000000 });
    console.log("Simulation SUCCESS! Would receive:", ethers.utils.formatEther(result), "sWETH");
  } catch (err: any) {
    console.log("Simulation FAILED:", err.reason || err.message);
  }
}
main().catch(console.error);
