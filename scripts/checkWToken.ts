import { ethers } from "hardhat";

const NEW_WETH = "0x59319f840A910Ab081fC3070d5C6310d55ad4D9A";
const NEW_AMM = "0x34e9a683199E566F494e6C9C3fA299479D5e028F";

async function main() {
  const [signer] = await ethers.getSigners();

  const amm = new ethers.Contract(NEW_AMM, [
    "function wToken() view returns (address)"
  ], signer);

  const wToken = await amm.wToken();
  console.log("LeverageAMM.wToken:", wToken);
  console.log("Expected WToken:", NEW_WETH);
  console.log("Match:", wToken.toLowerCase() === NEW_WETH.toLowerCase());
}
main().catch(console.error);
