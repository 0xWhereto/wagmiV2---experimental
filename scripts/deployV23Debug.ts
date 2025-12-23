import { ethers } from "hardhat";

const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";
const POOL = "0x4ed3B3e2AD7e19124D921fE2F6956e1C62Cbf190";
const ORACLE = "0xeD77B9f54cc9ACb496916a4fED764869E927FFcb";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Deploy V23 with Debug ===\n");
  
  // Deploy fresh stack
  const V3LPVault = await ethers.getContractFactory("V3LPVault");
  const v3Vault = await V3LPVault.deploy(POSITION_MANAGER, POOL, { gasLimit: 4000000 });
  await v3Vault.deployed();
  await (await v3Vault.setDefaultLayers({ gasLimit: 500000 })).wait();

  const LeverageAMM = await ethers.getContractFactory("LeverageAMM");
  const leverageAMM = await LeverageAMM.deploy(SWETH, MIM, STAKING_VAULT, v3Vault.address, ORACLE, { gasLimit: 3500000 });
  await leverageAMM.deployed();

  const WToken = await ethers.getContractFactory("WToken");
  const wToken = await WToken.deploy("Wagmi Zero-IL ETH", "wETH", SWETH, leverageAMM.address, v3Vault.address, { gasLimit: 3000000 });
  await wToken.deployed();

  await (await v3Vault.setOperator(leverageAMM.address, true)).wait();
  await (await leverageAMM.setWToken(wToken.address)).wait();
  const stakingVaultContract = new ethers.Contract(STAKING_VAULT, ["function setBorrower(address, bool) external"], signer);
  await (await stakingVaultContract.setBorrower(leverageAMM.address, true)).wait();

  console.log("V3LPVault:", v3Vault.address);
  console.log("LeverageAMM:", leverageAMM.address);
  console.log("WToken:", wToken.address);

  // Deposit
  const sweth = new ethers.Contract(SWETH, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)"
  ], signer);
  const mim = new ethers.Contract(MIM, ["function balanceOf(address) view returns (uint256)"], signer);
  
  const depositAmount = ethers.utils.parseEther("0.0005");
  await (await sweth.approve(wToken.address, ethers.constants.MaxUint256)).wait();
  await (await wToken.deposit(depositAmount, 0, { gasLimit: 2000000 })).wait();
  console.log("\nDeposit SUCCESS");
  
  // Verify state
  console.log("\nState after deposit:");
  console.log("  wToken balance:", ethers.utils.formatEther(await wToken.balanceOf(signer.address)));
  console.log("  LeverageAMM.totalDebt:", ethers.utils.formatEther(await leverageAMM.totalDebt()));
  console.log("  V3Vault sWETH:", ethers.utils.formatEther(await sweth.balanceOf(v3Vault.address)));
  console.log("  V3Vault MIM:", ethers.utils.formatEther(await mim.balanceOf(v3Vault.address)));
  const [a0, a1] = await v3Vault.getTotalAssets();
  console.log("  V3Vault getTotalAssets:", ethers.utils.formatEther(a0), "sWETH,", ethers.utils.formatEther(a1), "MIM");
  
  // Now let's manually trace what closePosition does
  console.log("\n=== Manual Trace of closePosition ===");
  const wTokenBal = await wToken.balanceOf(signer.address);
  const totalSupply = await wToken.totalSupply();
  const WAD = ethers.utils.parseEther("1");
  const withdrawPercent = wTokenBal.mul(WAD).div(totalSupply);
  const basisPoints = withdrawPercent.mul(10000).div(WAD);
  
  console.log("1. shares:", ethers.utils.formatEther(wTokenBal));
  console.log("2. totalShares:", ethers.utils.formatEther(totalSupply));
  console.log("3. withdrawPercent (WAD):", ethers.utils.formatEther(withdrawPercent));
  console.log("4. basisPoints:", basisPoints.toString());
  
  // Step 1: v3LPVault.removeLiquidity would be called
  console.log("\n5. Simulating v3LPVault.removeLiquidity from LeverageAMM...");
  // We can't actually call it as LeverageAMM, but let's simulate as owner
  const result = await v3Vault.callStatic.removeLiquidity(basisPoints, 0, 0);
  console.log("   Would return:", ethers.utils.formatEther(result[0]), "sWETH,", ethers.utils.formatEther(result[1]), "MIM");
  
  // Step 2: Check what debt would need to be repaid
  const totalDebt = await leverageAMM.totalDebt();
  const debtToRepay = totalDebt.mul(withdrawPercent).div(WAD);
  console.log("\n6. totalDebt:", ethers.utils.formatEther(totalDebt));
  console.log("7. debtToRepay:", ethers.utils.formatEther(debtToRepay));
  
  // The MIM from removeLiquidity should be enough to repay the debt
  console.log("\n8. MIM from LP:", ethers.utils.formatEther(result[1]));
  console.log("9. Debt to repay:", ethers.utils.formatEther(debtToRepay));
  console.log("10. Is MIM >= debt:", result[1].gte(debtToRepay));
  
  // Now try the actual withdrawal
  console.log("\n=== Attempting Actual Withdrawal ===");
  try {
    const tx = await wToken.withdraw(wTokenBal, 0, { gasLimit: 5000000 });
    const receipt = await tx.wait();
    console.log("SUCCESS! TX:", receipt.transactionHash);
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("Final sWETH:", ethers.utils.formatEther(await sweth.balanceOf(signer.address)));
  } catch (err: any) {
    console.log("FAILED:", err.message?.slice(0, 200));
  }
}
main().catch(console.error);
