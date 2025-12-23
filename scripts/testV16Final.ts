import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const NEW_WETH = "0xfC4D0237D564D44f115A2e28d56CB1b5856CdaB1";
const NEW_AMM = "0x0554F3e0C5d4386FE5AB9A2F7C2D4f364dD61cc4";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Testing v16 Final ===\n");

  const sweth = await ethers.getContractAt("IERC20", SWETH);
  const mim = await ethers.getContractAt("IERC20", MIM);

  // Check StakingVault MIM balance
  const stakingMIM = await mim.balanceOf(STAKING_VAULT);
  console.log("MIM in StakingVault:", ethers.utils.formatUnits(stakingMIM, 18));

  if (stakingMIM.lt(ethers.utils.parseUnits("0.5", 18))) {
    console.log("⚠️ Not enough MIM in StakingVault for borrowing!");
    console.log("Need to deposit more MIM first.");
    return;
  }

  const weth = new ethers.Contract(NEW_WETH, [
    "function deposit(uint256, uint256) external returns (uint256)",
    "function withdraw(uint256, uint256) external returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function totalSupply() view returns (uint256)"
  ], signer);

  const swethBefore = await sweth.balanceOf(signer.address);
  console.log("sWETH before:", ethers.utils.formatUnits(swethBefore, 18));

  const depositAmount = ethers.utils.parseUnits("0.0005", 18);
  
  if (swethBefore.lt(depositAmount)) {
    console.log("Not enough sWETH!");
    return;
  }

  // Approve
  console.log("\n--- Approving sWETH ---");
  await (await sweth.approve(NEW_WETH, depositAmount)).wait();
  console.log("✅ Approved");
  
  // Deposit
  console.log("\n--- Deposit 0.0005 sWETH ---");
  try {
    const tx = await weth.deposit(depositAmount, 0, { gasLimit: 2000000 });
    await tx.wait();
    console.log("✅ Deposit OK");
  } catch (e: any) {
    console.log("❌ Deposit failed:", e.reason || e.message?.slice(0, 300));
    return;
  }
  
  const shares = await weth.balanceOf(signer.address);
  console.log("Shares:", ethers.utils.formatUnits(shares, 18));
  
  // Withdraw
  console.log("\n--- Withdraw all ---");
  try {
    const withdrawTx = await weth.withdraw(shares, 0, { gasLimit: 2500000 });
    await withdrawTx.wait();
    console.log("✅ Withdraw OK");
    
    const swethAfter = await sweth.balanceOf(signer.address);
    console.log("sWETH after:", ethers.utils.formatUnits(swethAfter, 18));
    console.log("Net change:", ethers.utils.formatUnits(swethAfter.sub(swethBefore), 18), "sWETH");
  } catch (e: any) {
    console.log("❌ Withdraw failed:", e.reason || e.message?.slice(0, 300));
  }
}
main().catch(console.error);
