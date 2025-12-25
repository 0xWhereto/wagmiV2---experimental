import { ethers } from "hardhat";

const LEVERAGE_AMM = "0xa883C4f63b203D59769eE75900fBfE992A358f3D";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Authorizing with:", signer.address);
  
  const vault = new ethers.Contract(STAKING_VAULT, [
    "function setBorrower(address,bool) external",
    "function isBorrower(address) view returns (bool)",
  ], signer);
  
  console.log("Before:", await vault.isBorrower(LEVERAGE_AMM));
  
  console.log("Setting LeverageAMM as borrower...");
  const tx = await vault.setBorrower(LEVERAGE_AMM, true);
  await tx.wait();
  
  console.log("After:", await vault.isBorrower(LEVERAGE_AMM));
  console.log("Done!");
}

main().catch(console.error);


