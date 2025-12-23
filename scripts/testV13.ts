import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const NEW_WETH = "0xA3eFbd4FE35ABCA229959653930cc668888dc964";
const NEW_AMM = "0x2E711256BaEa3A127C9E903898AD77C8ce5Ed9A9";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Testing Vault v13 ===\n");

  const sweth = await ethers.getContractAt("IERC20", SWETH);
  const mim = await ethers.getContractAt("IERC20", MIM);
  const weth = new ethers.Contract(NEW_WETH, [
    "function deposit(uint256, uint256) external returns (uint256)",
    "function withdraw(uint256, uint256) external returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function totalSupply() view returns (uint256)"
  ], signer);

  const swethBalance = await sweth.balanceOf(signer.address);
  console.log("sWETH balance:", ethers.utils.formatUnits(swethBalance, 18));

  const depositAmount = ethers.utils.parseUnits("0.0005", 18);
  
  console.log("\n--- Deposit ---");
  await (await sweth.approve(NEW_WETH, depositAmount)).wait();
  
  try {
    const swethBefore = await sweth.balanceOf(signer.address);
    const tx = await weth.deposit(depositAmount, 0, { gasLimit: 2000000 });
    await tx.wait();
    console.log("✅ Deposit OK");
    
    const shares = await weth.balanceOf(signer.address);
    console.log("Shares:", ethers.utils.formatUnits(shares, 18));
    
    // Check AMM state
    const amm = new ethers.Contract(NEW_AMM, [
      "function totalDebt() view returns (uint256)",
      "function totalUnderlying() view returns (uint256)"
    ], signer);
    
    console.log("Debt:", ethers.utils.formatUnits(await amm.totalDebt(), 18), "MIM");
    console.log("Underlying:", ethers.utils.formatUnits(await amm.totalUnderlying(), 18), "sWETH");
    
    // Test withdraw
    console.log("\n--- Withdraw ---");
    try {
      const assetsOut = await weth.callStatic.withdraw(shares, 0);
      console.log("Would receive:", ethers.utils.formatUnits(assetsOut, 18), "sWETH");
      
      const withdrawTx = await weth.withdraw(shares, 0, { gasLimit: 2500000 });
      await withdrawTx.wait();
      console.log("✅ Withdraw OK");
      
      const swethAfter = await sweth.balanceOf(signer.address);
      console.log("sWETH after:", ethers.utils.formatUnits(swethAfter, 18));
    } catch (e: any) {
      console.log("❌ Withdraw failed:", e.reason || e.message?.slice(0, 300));
    }
  } catch (e: any) {
    console.log("❌ Deposit failed:", e.reason || e.message?.slice(0, 300));
  }
}

main().catch(console.error);
