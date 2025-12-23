import { ethers } from "hardhat";

const NEW_ORACLE = "0x8c51e68fF43C8d4c098D03300524dd735BABF496";

async function main() {
  const [signer] = await ethers.getSigners();
  
  const oracle = new ethers.Contract(NEW_ORACLE, [
    "function getSpotPrice() view returns (uint256)",
    "function getPrice() view returns (uint256)",
    "function hasEnoughObservations() view returns (bool)",
    "function invertPrice() view returns (bool)",
  ], signer);
  
  console.log("Testing new OracleAdapter:", NEW_ORACLE);
  
  try {
    const hasObs = await oracle.hasEnoughObservations();
    console.log("hasEnoughObservations:", hasObs);
  } catch (e: any) {
    console.log("hasEnoughObservations error:", e.message?.slice(0, 100));
  }
  
  try {
    const spotPrice = await oracle.getSpotPrice();
    console.log("getSpotPrice():", ethers.utils.formatEther(spotPrice), "MIM per sWETH");
  } catch (e: any) {
    console.log("getSpotPrice error:", e.reason || e.message?.slice(0, 100));
  }
  
  try {
    const invert = await oracle.invertPrice();
    console.log("invertPrice:", invert);
  } catch (e: any) {
    console.log("invertPrice error:", e.message?.slice(0, 100));
  }
  
  try {
    const price = await oracle.getPrice();
    console.log("getPrice():", ethers.utils.formatEther(price), "MIM per sWETH");
  } catch (e: any) {
    console.log("getPrice error:", e.reason || e.message?.slice(0, 100));
  }
}

main().catch(console.error);

