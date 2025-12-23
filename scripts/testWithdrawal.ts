import { ethers } from "hardhat";

const ADDRESSES = {
  MIM: "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708",
  SMIM: "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7"
};

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Testing sMIM Withdrawal ===\n");

  const mim = await ethers.getContractAt("IERC20", ADDRESSES.MIM);
  const smimVault = new ethers.Contract(ADDRESSES.SMIM, [
    "function balanceOf(address) view returns (uint256)",
    "function totalAssets() view returns (uint256)",
    "function getCash() view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function withdraw(uint256 assets, address receiver, address owner) returns (uint256)",
    "function redeem(uint256 shares, address receiver, address owner) returns (uint256)",
    "function convertToAssets(uint256 shares) view returns (uint256)",
    "function convertToShares(uint256 assets) view returns (uint256)",
    "function previewRedeem(uint256 shares) view returns (uint256)",
    "function previewWithdraw(uint256 assets) view returns (uint256)",
    "function maxRedeem(address owner) view returns (uint256)",
    "function maxWithdraw(address owner) view returns (uint256)"
  ], signer);

  // Current state
  const userShares = await smimVault.balanceOf(signer.address);
  const totalAssets = await smimVault.totalAssets();
  const totalSupply = await smimVault.totalSupply();
  const cash = await smimVault.getCash();
  const mimBefore = await mim.balanceOf(signer.address);

  console.log("User sMIM shares:", ethers.utils.formatUnits(userShares, 18));
  console.log("Total Assets:", ethers.utils.formatUnits(totalAssets, 18), "MIM");
  console.log("Total Supply:", ethers.utils.formatUnits(totalSupply, 18), "sMIM");
  console.log("Cash (available MIM):", ethers.utils.formatUnits(cash, 18), "MIM");
  console.log("User MIM before:", ethers.utils.formatUnits(mimBefore, 18));

  // Test ERC4626 view functions
  console.log("\n--- Testing ERC4626 View Functions ---");
  
  try {
    const maxRedeem = await smimVault.maxRedeem(signer.address);
    console.log("✅ maxRedeem():", ethers.utils.formatUnits(maxRedeem, 18), "shares");
  } catch (e: any) {
    console.log("❌ maxRedeem() REVERTS");
  }

  try {
    const maxWithdraw = await smimVault.maxWithdraw(signer.address);
    console.log("✅ maxWithdraw():", ethers.utils.formatUnits(maxWithdraw, 18), "MIM");
  } catch (e: any) {
    console.log("❌ maxWithdraw() REVERTS");
  }

  try {
    const toAssets = await smimVault.convertToAssets(userShares);
    console.log("✅ convertToAssets():", ethers.utils.formatUnits(toAssets, 18), "MIM");
  } catch (e: any) {
    console.log("❌ convertToAssets() REVERTS");
  }

  try {
    const previewRedeem = await smimVault.previewRedeem(userShares.div(10));
    console.log("✅ previewRedeem(10%):", ethers.utils.formatUnits(previewRedeem, 18), "MIM");
  } catch (e: any) {
    console.log("❌ previewRedeem() REVERTS");
  }

  // Try a small redeem
  console.log("\n--- Testing Small Redeem ---");
  const smallShares = ethers.utils.parseUnits("0.1", 18); // Redeem 0.1 sMIM
  
  if (userShares.gte(smallShares)) {
    try {
      console.log("Attempting to redeem 0.1 sMIM...");
      const tx = await smimVault.redeem(smallShares, signer.address, signer.address);
      console.log("TX Hash:", tx.hash);
      const receipt = await tx.wait();
      console.log("✅ Redeem successful! Gas used:", receipt.gasUsed.toString());
      
      const mimAfter = await mim.balanceOf(signer.address);
      const mimReceived = mimAfter.sub(mimBefore);
      console.log("MIM received:", ethers.utils.formatUnits(mimReceived, 18));
    } catch (e: any) {
      console.log("❌ Redeem failed:", e.message?.slice(0, 200));
    }
  } else {
    console.log("⚠️ User has insufficient sMIM for test");
  }
}

main().catch(console.error);
