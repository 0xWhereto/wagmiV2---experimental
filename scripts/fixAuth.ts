import { ethers } from "hardhat";

const NEW_AMM = "0x45b825A072e0eE39c524c79964a534C9806e2E17";
const STAKING_VAULT = "0xBdBAd1ae9B2Ba67A1E0d8E6DD8eEcf4a7A52c8d5";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Fix Authorization ===\n");

  const stakingVault = new ethers.Contract(STAKING_VAULT, [
    "function setBorrower(address, bool) external",
    "function isBorrower(address) view returns (bool)"
  ], signer);

  // Check current status
  console.log("LeverageAMM is borrower:", await stakingVault.isBorrower(NEW_AMM));

  // Authorize
  console.log("Authorizing LeverageAMM as borrower...");
  await (await stakingVault.setBorrower(NEW_AMM, true)).wait();
  console.log("✅ Done");

  // Verify
  console.log("LeverageAMM is borrower:", await stakingVault.isBorrower(NEW_AMM));
}
main().catch(console.error);
