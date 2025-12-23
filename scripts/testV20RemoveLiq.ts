import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const V3_VAULT = "0x79e781aF3B8994380a3Ec7Cb8eDD3e70d6F7b2E4";
const LEVERAGE_AMM = "0xB9897871Fb8cBE4767F660a5AE237e37b8b00D2a";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Test V20 removeLiquidity ===\n");
  
  const sweth = new ethers.Contract(SWETH, ["function balanceOf(address) view returns (uint256)"], signer);
  const mim = new ethers.Contract(MIM, ["function balanceOf(address) view returns (uint256)"], signer);
  
  const v3Vault = new ethers.Contract(V3_VAULT, [
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function removeLiquidity(uint256,uint256,uint256) external returns (uint256, uint256)",
    "function isOperator(address) view returns (bool)",
    "function getTotalAssets() view returns (uint256, uint256)"
  ], signer);
  
  console.log("V3LPVault token0:", await v3Vault.token0());
  console.log("V3LPVault token1:", await v3Vault.token1());
  console.log("Expected sWETH:", SWETH);
  console.log("Expected MIM:", MIM);
  console.log("Is LeverageAMM operator:", await v3Vault.isOperator(LEVERAGE_AMM));
  
  const [asset0, asset1] = await v3Vault.getTotalAssets();
  console.log("\nAssets in positions:");
  console.log("  token0 (sWETH):", ethers.utils.formatEther(asset0));
  console.log("  token1 (MIM):", ethers.utils.formatEther(asset1));
  
  // Set owner as operator
  console.log("\nSetting owner as operator...");
  await (await v3Vault.setOperator(signer.address, true)).wait();
  
  // Get balances before
  const swethBefore = await sweth.balanceOf(signer.address);
  const mimBefore = await mim.balanceOf(signer.address);
  console.log("Owner balances before:");
  console.log("  sWETH:", ethers.utils.formatEther(swethBefore));
  console.log("  MIM:", ethers.utils.formatEther(mimBefore));
  
  // Remove 100% liquidity as owner
  console.log("\nRemoving 100% liquidity...");
  try {
    const tx = await v3Vault.removeLiquidity(10000, 0, 0, { gasLimit: 2000000 });
    const receipt = await tx.wait();
    console.log("TX:", receipt.transactionHash);
    console.log("SUCCESS!");
    
    const swethAfter = await sweth.balanceOf(signer.address);
    const mimAfter = await mim.balanceOf(signer.address);
    console.log("\nOwner balances after:");
    console.log("  sWETH:", ethers.utils.formatEther(swethAfter));
    console.log("  MIM:", ethers.utils.formatEther(mimAfter));
    console.log("\nReceived:");
    console.log("  sWETH:", ethers.utils.formatEther(swethAfter.sub(swethBefore)));
    console.log("  MIM:", ethers.utils.formatEther(mimAfter.sub(mimBefore)));
  } catch (err: any) {
    console.log("FAILED:", err.reason || err.message);
  }
}
main().catch(console.error);
