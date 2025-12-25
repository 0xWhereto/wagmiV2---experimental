import { ethers } from "hardhat";

const ADDRESSES = {
  mim: "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708",
  stakingVault: "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7",
};

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Debugging staking with:", signer.address);
  
  const mim = new ethers.Contract(ADDRESSES.mim, [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256) external returns (bool)",
  ], signer);
  
  const stakingVault = new ethers.Contract(ADDRESSES.stakingVault, [
    "function deposit(uint256,address) external returns (uint256)",
    "function mim() view returns (address)",
    "function asset() view returns (address)",
    "function totalAssets() view returns (uint256)",
    "function getCash() view returns (uint256)",
    "function convertToShares(uint256) view returns (uint256)",
    "function previewDeposit(uint256) view returns (uint256)",
  ], signer);
  
  // Check MIM balance and allowance
  const balance = await mim.balanceOf(signer.address);
  const allowance = await mim.allowance(signer.address, ADDRESSES.stakingVault);
  console.log("\nMIM balance:", ethers.utils.formatEther(balance));
  console.log("MIM allowance:", ethers.utils.formatEther(allowance));
  
  // Check vault config
  console.log("\nStakingVault config:");
  try {
    const mimAddr = await stakingVault.mim();
    console.log("  mim():", mimAddr);
    console.log("  Matches:", mimAddr.toLowerCase() === ADDRESSES.mim.toLowerCase());
  } catch (e) {
    console.log("  mim(): N/A");
  }
  
  try {
    const asset = await stakingVault.asset();
    console.log("  asset():", asset);
  } catch (e) {
    console.log("  asset(): N/A");
  }
  
  const totalAssets = await stakingVault.totalAssets();
  const cash = await stakingVault.getCash();
  console.log("  totalAssets:", ethers.utils.formatEther(totalAssets));
  console.log("  getCash:", ethers.utils.formatEther(cash));
  
  // Try preview
  const testAmount = ethers.utils.parseEther("1");
  try {
    const shares = await stakingVault.convertToShares(testAmount);
    console.log("\n  convertToShares(1 MIM):", ethers.utils.formatEther(shares), "sMIM");
  } catch (e: any) {
    console.log("  convertToShares failed:", e.message?.slice(0, 80));
  }
  
  try {
    const preview = await stakingVault.previewDeposit(testAmount);
    console.log("  previewDeposit(1 MIM):", ethers.utils.formatEther(preview), "sMIM");
  } catch (e: any) {
    console.log("  previewDeposit failed:", e.message?.slice(0, 80));
  }
  
  // Approve if needed
  if (allowance.lt(balance)) {
    console.log("\nApproving MIM...");
    await (await mim.approve(ADDRESSES.stakingVault, ethers.constants.MaxUint256)).wait();
    console.log("Approved!");
  }
  
  // Try deposit with small amount
  console.log("\n=== Trying deposit of 1 MIM ===");
  try {
    const tx = await stakingVault.deposit(testAmount, signer.address, { gasLimit: 500000 });
    const receipt = await tx.wait();
    console.log("✓ Success! Gas:", receipt.gasUsed.toString());
    console.log("New cash:", ethers.utils.formatEther(await stakingVault.getCash()), "MIM");
  } catch (e: any) {
    console.log("✗ Failed:", e.reason || e.message?.slice(0, 200));
    
    // Try static call for more info
    try {
      await stakingVault.callStatic.deposit(testAmount, signer.address, { gasLimit: 500000 });
    } catch (e2: any) {
      console.log("Static call error:", e2.reason || e2.message?.slice(0, 200));
    }
  }
}

main().catch(console.error);


