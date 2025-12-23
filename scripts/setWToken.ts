import { ethers } from "hardhat";

const LEVERAGE_AMM = "0xa883C4f63b203D59769eE75900fBfE992A358f3D";
const WETH_TOKEN = "0xa4E68DbaC9fB793F552e0188CE9a58Fe5F2eEC89";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Setting wToken with:", signer.address);
  
  const amm = new ethers.Contract(LEVERAGE_AMM, [
    "function setWToken(address) external",
    "function wToken() view returns (address)",
  ], signer);
  
  console.log("Current wToken:", await amm.wToken());
  
  console.log("Setting wToken to:", WETH_TOKEN);
  const tx = await amm.setWToken(WETH_TOKEN);
  await tx.wait();
  
  console.log("New wToken:", await amm.wToken());
  console.log("Done!");
}

main().catch(console.error);

