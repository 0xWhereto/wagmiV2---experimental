import { ethers } from "hardhat";

const NEW_AMM = "0x45b825A072e0eE39c524c79964a534C9806e2E17";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Check AMM Config ===\n");

  const amm = new ethers.Contract(NEW_AMM, [
    "function stakingVault() view returns (address)"
  ], signer);

  const stakingVault = await amm.stakingVault();
  console.log("LeverageAMM.stakingVault:", stakingVault);
  console.log("Expected:", "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7");
  console.log("Match:", stakingVault.toLowerCase() === "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7".toLowerCase());
}
main().catch(console.error);
