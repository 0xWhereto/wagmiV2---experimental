import { ethers } from "hardhat";

const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const LEVERAGE_AMM = "0x515BA03567DB5F7e320c52246E9f380865b72Bcc";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Check LeverageAMM Authorization ===\n");
  
  const stakingVault = new ethers.Contract(STAKING_VAULT, [
    "function isBorrower(address) view returns (bool)"
  ], signer);
  
  console.log("LeverageAMM address:", LEVERAGE_AMM);
  console.log("Is authorized borrower:", await stakingVault.isBorrower(LEVERAGE_AMM));
}
main().catch(console.error);
