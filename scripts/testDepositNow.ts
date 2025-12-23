import { ethers } from "hardhat";

const V3_VAULT = "0xC4AC36c923658F9281bFEF592f36A2EC5101b19a";
const LEVERAGE_AMM = "0xBAF3F6A7ce4AfE9FE172Cf84b7Be99C45473bF74";
const WTOKEN = "0x1da18a479752820DD018feA75A27724fbA2F62e3";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Test Deposit Now ===\n");
  
  const sweth = new ethers.Contract(SWETH, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)"
  ], signer);
  
  const wToken = (await ethers.getContractFactory("WToken")).attach(WTOKEN);
  
  const swethBefore = await sweth.balanceOf(signer.address);
  console.log("sWETH before:", ethers.utils.formatEther(swethBefore));
  
  // Approve wToken
  await (await sweth.approve(WTOKEN, ethers.constants.MaxUint256)).wait();
  
  // Deposit 0.0001 sWETH
  const amount = ethers.utils.parseEther("0.0001");
  console.log("Depositing:", ethers.utils.formatEther(amount), "sWETH");
  
  try {
    const tx = await wToken.deposit(amount, 0, { gasLimit: 2000000 });
    const receipt = await tx.wait();
    console.log("✓ Deposit SUCCESS! Gas used:", receipt.gasUsed.toString());
    
    const wTokenBal = await wToken.balanceOf(signer.address);
    console.log("wToken balance:", ethers.utils.formatEther(wTokenBal));
    
    // Check state
    const v3Vault = (await ethers.getContractFactory("V3LPVault")).attach(V3_VAULT);
    const leverageAMM = (await ethers.getContractFactory("LeverageAMM")).attach(LEVERAGE_AMM);
    
    const [a0, a1] = await v3Vault.getTotalAssets();
    console.log("\nV3 Vault assets:", ethers.utils.formatEther(a0), "sWETH,", ethers.utils.formatEther(a1), "MIM");
    console.log("LeverageAMM debt:", ethers.utils.formatEther(await leverageAMM.totalDebt()));
    
  } catch (err: any) {
    console.log("✗ Deposit FAILED:", err.reason || err.message?.slice(0, 200));
  }
}
main().catch(console.error);
