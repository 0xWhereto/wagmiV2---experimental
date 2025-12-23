import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const NEW_WETH = "0x1d71d3aaaEf85C1d3c78c9EC670AC097Db804634";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Testing v15 ===\n");

  const sweth = await ethers.getContractAt("IERC20", SWETH);
  const weth = new ethers.Contract(NEW_WETH, [
    "function deposit(uint256, uint256) external returns (uint256)",
    "function withdraw(uint256, uint256) external returns (uint256)",
    "function balanceOf(address) view returns (uint256)"
  ], signer);

  const swethBefore = await sweth.balanceOf(signer.address);
  console.log("sWETH before:", ethers.utils.formatUnits(swethBefore, 18));

  const depositAmount = ethers.utils.parseUnits("0.0005", 18);
  await (await sweth.approve(NEW_WETH, depositAmount)).wait();
  
  console.log("\n--- Deposit 0.0005 sWETH ---");
  const tx = await weth.deposit(depositAmount, 0, { gasLimit: 2000000 });
  await tx.wait();
  console.log("✅ Deposit OK");
  
  const shares = await weth.balanceOf(signer.address);
  console.log("Shares:", ethers.utils.formatUnits(shares, 18));
  
  console.log("\n--- Withdraw all ---");
  try {
    const withdrawTx = await weth.withdraw(shares, 0, { gasLimit: 2500000 });
    await withdrawTx.wait();
    console.log("✅ Withdraw OK");
    
    const swethAfter = await sweth.balanceOf(signer.address);
    console.log("sWETH after:", ethers.utils.formatUnits(swethAfter, 18));
    console.log("Net change:", ethers.utils.formatUnits(swethAfter.sub(swethBefore), 18), "sWETH");
  } catch (e: any) {
    console.log("❌ Withdraw failed:", e.reason || e.message?.slice(0, 200));
  }
}
main().catch(console.error);
