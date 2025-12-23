import { ethers } from "hardhat";

const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";
const POOL = "0x4ed3B3e2AD7e19124D921fE2F6956e1C62Cbf190";
const ORACLE = "0xeD77B9f54cc9ACb496916a4fED764869E927FFcb";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Atomic Deposit + Withdraw Test ===\n");
  
  // Deploy fresh
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

  const sweth = new ethers.Contract(SWETH, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)"
  ], signer);
  const mim = new ethers.Contract(MIM, ["function balanceOf(address) view returns (uint256)"], signer);
  
  const swethBefore = await sweth.balanceOf(signer.address);
  console.log("\nInitial sWETH:", ethers.utils.formatEther(swethBefore));
  
  // Deposit
  await (await sweth.approve(wToken.address, ethers.constants.MaxUint256)).wait();
  console.log("\n1. Depositing 0.0005 sWETH...");
  await (await wToken.deposit(ethers.utils.parseEther("0.0005"), 0, { gasLimit: 2000000 })).wait();
  console.log("   Deposit SUCCESS");
  console.log("   wToken balance:", ethers.utils.formatEther(await wToken.balanceOf(signer.address)));
  
  // Immediate withdraw
  const wTokenBal = await wToken.balanceOf(signer.address);
  console.log("\n2. Immediately withdrawing", ethers.utils.formatEther(wTokenBal), "wETH...");
  
  try {
    const tx = await wToken.withdraw(wTokenBal, 0, { gasLimit: 5000000 });
    const receipt = await tx.wait();
    console.log("   Withdraw SUCCESS!");
    console.log("   Gas used:", receipt.gasUsed.toString());
    console.log("   Final sWETH:", ethers.utils.formatEther(await sweth.balanceOf(signer.address)));
    console.log("   Net change:", ethers.utils.formatEther((await sweth.balanceOf(signer.address)).sub(swethBefore)));
  } catch (err: any) {
    console.log("   Withdraw FAILED!");
    console.log("   Error:", err.message?.slice(0, 300));
    
    // Debug state
    console.log("\n   --- Debug State ---");
    console.log("   LeverageAMM sWETH:", ethers.utils.formatEther(await sweth.balanceOf(leverageAMM.address)));
    console.log("   LeverageAMM MIM:", ethers.utils.formatEther(await mim.balanceOf(leverageAMM.address)));
    console.log("   V3Vault sWETH:", ethers.utils.formatEther(await sweth.balanceOf(v3Vault.address)));
    console.log("   V3Vault MIM:", ethers.utils.formatEther(await mim.balanceOf(v3Vault.address)));
    
    const [a0, a1] = await v3Vault.getTotalAssets();
    console.log("   V3Vault assets:", ethers.utils.formatEther(a0), "sWETH,", ethers.utils.formatEther(a1), "MIM");
    console.log("   LeverageAMM totalDebt:", ethers.utils.formatEther(await leverageAMM.totalDebt()));
  }
}
main().catch(console.error);
