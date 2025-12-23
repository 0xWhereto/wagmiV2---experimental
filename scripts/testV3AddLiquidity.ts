import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const V3_VAULT = "0x64B933Ce0536f5508cf9Ccec9628E969434dc8E1";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Test V3LPVault addLiquidity ===\n");
  
  const sweth = new ethers.Contract(SWETH, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)",
    "function transfer(address,uint256)"
  ], signer);
  
  const mim = new ethers.Contract(MIM, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)",
    "function transfer(address,uint256)"
  ], signer);
  
  const v3Vault = new ethers.Contract(V3_VAULT, [
    "function addLiquidity(uint256,uint256,uint256,uint256) external returns (uint128)",
    "function setOperator(address,bool) external",
    "function isOperator(address) view returns (bool)",
    "function token0() view returns (address)",
    "function token1() view returns (address)"
  ], signer);
  
  // Check token order
  console.log("token0:", await v3Vault.token0());
  console.log("token1:", await v3Vault.token1());
  
  // Set deployer as operator
  console.log("\nSetting deployer as operator...");
  await (await v3Vault.setOperator(signer.address, true)).wait();
  console.log("Is operator:", await v3Vault.isOperator(signer.address));
  
  // Transfer tokens to V3Vault
  const swethAmount = ethers.utils.parseEther("0.0001");
  const mimAmount = ethers.utils.parseEther("0.3");
  
  console.log("\nTransferring tokens to V3Vault...");
  console.log("  sWETH:", ethers.utils.formatEther(swethAmount));
  console.log("  MIM:", ethers.utils.formatEther(mimAmount));
  
  const swethBal = await sweth.balanceOf(signer.address);
  const mimBal = await mim.balanceOf(signer.address);
  console.log("  User sWETH:", ethers.utils.formatEther(swethBal));
  console.log("  User MIM:", ethers.utils.formatEther(mimBal));
  
  if (swethBal.lt(swethAmount)) {
    console.log("Not enough sWETH!");
    return;
  }
  if (mimBal.lt(mimAmount)) {
    console.log("Not enough MIM! Need", ethers.utils.formatEther(mimAmount));
    return;
  }
  
  // Approve
  await (await sweth.approve(V3_VAULT, ethers.constants.MaxUint256)).wait();
  await (await mim.approve(V3_VAULT, ethers.constants.MaxUint256)).wait();
  
  // Transfer (V3Vault needs tokens in its balance to add liquidity)
  await (await sweth.transfer(V3_VAULT, swethAmount)).wait();
  await (await mim.transfer(V3_VAULT, mimAmount)).wait();
  
  console.log("  V3Vault sWETH:", ethers.utils.formatEther(await sweth.balanceOf(V3_VAULT)));
  console.log("  V3Vault MIM:", ethers.utils.formatEther(await mim.balanceOf(V3_VAULT)));
  
  // Try addLiquidity
  console.log("\nCalling addLiquidity...");
  try {
    const tx = await v3Vault.addLiquidity(swethAmount, mimAmount, 0, 0, { gasLimit: 2000000 });
    const receipt = await tx.wait();
    console.log("SUCCESS! TX:", receipt.transactionHash);
  } catch (err: any) {
    console.log("FAILED:", err.reason || err.message);
  }
}
main().catch(console.error);
