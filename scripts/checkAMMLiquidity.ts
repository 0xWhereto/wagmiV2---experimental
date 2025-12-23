import { ethers } from "hardhat";

const V3_VAULT = "0x825Bccfba2a8814996c5ea91701885Bd6A7025d6";
const NEW_AMM = "0x34e9a683199E566F494e6C9C3fA299479D5e028F";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Check AMM can call V3 ===\n");

  const v3 = new ethers.Contract(V3_VAULT, [
    "function isOperator(address) view returns (bool)"
  ], signer);

  console.log("LeverageAMM is V3 operator:", await v3.isOperator(NEW_AMM));

  const amm = new ethers.Contract(NEW_AMM, [
    "function v3LPVault() view returns (address)"
  ], signer);

  console.log("LeverageAMM.v3LPVault:", await amm.v3LPVault());
  console.log("Expected V3:", V3_VAULT);
}
main().catch(console.error);
