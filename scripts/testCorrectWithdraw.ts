import { ethers } from "hardhat";

const ADDRESSES = {
  MIM: "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708",
  SMIM: "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7"
};

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Testing Correct Withdrawal Function ===\n");

  const mim = await ethers.getContractAt("IERC20", ADDRESSES.MIM);
  
  // Use the CORRECT function signature from the actual contract
  const smimVault = new ethers.Contract(ADDRESSES.SMIM, [
    "function balanceOf(address) view returns (uint256)",
    "function getCash() view returns (uint256)",
    "function totalAssets() view returns (uint256)",
    "function convertToAssets(uint256 shares) view returns (uint256)",
    "function withdraw(uint256 shares) returns (uint256 assets)"  // Correct signature!
  ], signer);

  // Current state
  const userShares = await smimVault.balanceOf(signer.address);
  const cash = await smimVault.getCash();
  const mimBefore = await mim.balanceOf(signer.address);

  console.log("User sMIM shares:", ethers.utils.formatUnits(userShares, 18));
  console.log("Available cash:", ethers.utils.formatUnits(cash, 18), "MIM");
  console.log("User MIM before:", ethers.utils.formatUnits(mimBefore, 18));

  // Calculate what we'll get for 0.1 shares
  const testShares = ethers.utils.parseUnits("0.1", 18);
  try {
    const expectedAssets = await smimVault.convertToAssets(testShares);
    console.log("\nExpected MIM for 0.1 sMIM:", ethers.utils.formatUnits(expectedAssets, 18));
  } catch (e: any) {
    console.log("convertToAssets failed:", e.message?.slice(0, 100));
  }

  // Try the correct withdraw function
  console.log("\n--- Testing withdraw(shares) ---");
  
  if (userShares.gte(testShares)) {
    try {
      console.log("Attempting to withdraw 0.1 sMIM shares...");
      const tx = await smimVault.withdraw(testShares);
      console.log("TX Hash:", tx.hash);
      const receipt = await tx.wait();
      console.log("✅ Withdrawal successful! Gas used:", receipt.gasUsed.toString());
      
      const mimAfter = await mim.balanceOf(signer.address);
      const mimReceived = mimAfter.sub(mimBefore);
      console.log("MIM received:", ethers.utils.formatUnits(mimReceived, 18));
      console.log("\n✅ BUG-004 is NOT CONFIRMED - withdrawals work with correct function!");
    } catch (e: any) {
      console.log("❌ Withdrawal failed:", e.message?.slice(0, 300));
      
      // Check if it's InsufficientLiquidity
      if (e.message?.includes("InsufficientLiquidity")) {
        console.log("\n⚠️ InsufficientLiquidity - not enough cash for withdrawal");
        console.log("This is expected if borrows exceed available cash");
      }
    }
  } else {
    console.log("⚠️ User has insufficient sMIM for test");
  }
}

main().catch(console.error);
