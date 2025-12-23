import { ethers } from "hardhat";

const WTOKEN = "0x6E6B84782d191B3E349Fd132Ff5C070f7085a7de";
const LEVERAGE_AMM = "0xf6b8AC2c2EfeA1966dd0696091e6c461a6a90cd1";
const V3_VAULT = "0xD9BaA26A6bA870663C411a410446f6B78b56C6a7";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Try Withdraw V22 ===\n");
  
  const wToken = new ethers.Contract(WTOKEN, [
    "function balanceOf(address) view returns (uint256)",
    "function withdraw(uint256,uint256) external returns (uint256)"
  ], signer);
  
  const sweth = new ethers.Contract(SWETH, ["function balanceOf(address) view returns (uint256)"], signer);
  const mim = new ethers.Contract(MIM, ["function balanceOf(address) view returns (uint256)"], signer);
  
  const wTokenBal = await wToken.balanceOf(signer.address);
  console.log("wToken balance:", ethers.utils.formatEther(wTokenBal));
  
  console.log("\nBefore withdrawal:");
  console.log("  User sWETH:", ethers.utils.formatEther(await sweth.balanceOf(signer.address)));
  console.log("  V3Vault sWETH:", ethers.utils.formatEther(await sweth.balanceOf(V3_VAULT)));
  console.log("  V3Vault MIM:", ethers.utils.formatEther(await mim.balanceOf(V3_VAULT)));
  console.log("  LeverageAMM sWETH:", ethers.utils.formatEther(await sweth.balanceOf(LEVERAGE_AMM)));
  console.log("  LeverageAMM MIM:", ethers.utils.formatEther(await mim.balanceOf(LEVERAGE_AMM)));
  
  console.log("\nTrying withdrawal with high gas...");
  try {
    const tx = await wToken.withdraw(wTokenBal, 0, { gasLimit: 5000000 });
    console.log("TX sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("SUCCESS! Gas used:", receipt.gasUsed.toString());
    
    console.log("\nAfter withdrawal:");
    console.log("  User sWETH:", ethers.utils.formatEther(await sweth.balanceOf(signer.address)));
    console.log("  User wToken:", ethers.utils.formatEther(await wToken.balanceOf(signer.address)));
  } catch (err: any) {
    console.log("FAILED!");
    console.log("Error:", err.message);
    
    // Check transaction status
    if (err.transactionHash) {
      const receipt = await signer.provider?.getTransactionReceipt(err.transactionHash);
      console.log("TX hash:", err.transactionHash);
      console.log("Status:", receipt?.status);
      console.log("Gas used:", receipt?.gasUsed.toString());
    }
    
    console.log("\nAfter failed withdrawal:");
    console.log("  V3Vault sWETH:", ethers.utils.formatEther(await sweth.balanceOf(V3_VAULT)));
    console.log("  V3Vault MIM:", ethers.utils.formatEther(await mim.balanceOf(V3_VAULT)));
    console.log("  LeverageAMM sWETH:", ethers.utils.formatEther(await sweth.balanceOf(LEVERAGE_AMM)));
    console.log("  LeverageAMM MIM:", ethers.utils.formatEther(await mim.balanceOf(LEVERAGE_AMM)));
  }
}
main().catch(console.error);
