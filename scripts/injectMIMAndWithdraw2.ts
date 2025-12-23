import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const NEW_WETH = "0x59319f840A910Ab081fC3070d5C6310d55ad4D9A";
const NEW_AMM = "0x34e9a683199E566F494e6C9C3fA299479D5e028F";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Inject MIM and Withdraw ===\n");

  const mim = await ethers.getContractAt("IERC20", MIM);
  const sweth = await ethers.getContractAt("IERC20", SWETH);
  
  const weth = new ethers.Contract(NEW_WETH, [
    "function balanceOf(address) view returns (uint256)",
    "function withdraw(uint256, uint256) external returns (uint256)"
  ], signer);

  // Check how much MIM the AMM needs
  const amm = new ethers.Contract(NEW_AMM, [
    "function totalDebt() view returns (uint256)"
  ], signer);

  const totalDebt = await amm.totalDebt();
  console.log("AMM totalDebt:", ethers.utils.formatUnits(totalDebt, 18));

  // Check my MIM balance
  const myMIM = await mim.balanceOf(signer.address);
  console.log("My MIM balance:", ethers.utils.formatUnits(myMIM, 18));

  // Transfer some MIM to AMM (1.5 should be enough)
  const injectAmount = ethers.utils.parseUnits("1.5", 18);
  if (myMIM.lt(injectAmount)) {
    console.log("Not enough MIM to inject!");
    return;
  }

  console.log("\n--- Injecting MIM into AMM ---");
  await (await mim.transfer(NEW_AMM, injectAmount)).wait();
  console.log("✅ Injected", ethers.utils.formatUnits(injectAmount, 18), "MIM");

  // Check AMM MIM balance
  console.log("AMM MIM balance:", ethers.utils.formatUnits(await mim.balanceOf(NEW_AMM), 18));

  // Now try withdrawal
  const shares = await weth.balanceOf(signer.address);
  console.log("\n--- Withdrawing", ethers.utils.formatUnits(shares, 18), "shares ---");

  const swethBefore = await sweth.balanceOf(signer.address);
  
  try {
    const tx = await weth.withdraw(shares, 0, { gasLimit: 2500000 });
    await tx.wait();
    console.log("✅ Withdraw OK");

    const swethAfter = await sweth.balanceOf(signer.address);
    console.log("sWETH received:", ethers.utils.formatUnits(swethAfter.sub(swethBefore), 18));
  } catch (e: any) {
    console.log("❌ Withdraw failed:", e.reason || e.message?.slice(0, 300));
  }
}
main().catch(console.error);
