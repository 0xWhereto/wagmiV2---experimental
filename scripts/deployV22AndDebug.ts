import { ethers } from "hardhat";

const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";
const POOL = "0x4ed3B3e2AD7e19124D921fE2F6956e1C62Cbf190";
const ORACLE = "0xeD77B9f54cc9ACb496916a4fED764869E927FFcb";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Deploy v22 and Debug closePosition ===\n");

  // Deploy
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

  // Deposit
  const depositAmount = ethers.utils.parseEther("0.0005");
  await (await sweth.approve(wToken.address, ethers.constants.MaxUint256)).wait();
  await (await wToken.deposit(depositAmount, 0, { gasLimit: 2000000 })).wait();
  console.log("\nDeposit SUCCESS");
  console.log("wToken balance:", ethers.utils.formatEther(await wToken.balanceOf(signer.address)));
  
  // Now test closePosition directly by calling it from LeverageAMM's perspective
  // But since closePosition has onlyWToken modifier, we need to call withdraw on WToken
  
  // Let's check if removeLiquidity works when called by LeverageAMM
  console.log("\n--- Simulating LeverageAMM.closePosition ---");
  console.log("Is LeverageAMM operator on V3Vault:", await v3Vault.isOperator(leverageAMM.address));
  
  // Check wToken is set correctly
  console.log("LeverageAMM.wToken:", await leverageAMM.wToken());
  console.log("Actual WToken:", wToken.address);
  console.log("Match:", (await leverageAMM.wToken()).toLowerCase() === wToken.address.toLowerCase());
  
  // Check underlyingIsToken0
  console.log("\nunderlyingIsToken0:", await leverageAMM.underlyingIsToken0());
  console.log("SWETH:", SWETH);
  console.log("MIM:", MIM);
  console.log("SWETH < MIM:", SWETH.toLowerCase() < MIM.toLowerCase());
  
  // Simulate the withdraw
  console.log("\n--- Simulating wToken.withdraw ---");
  const wTokenBal = await wToken.balanceOf(signer.address);
  try {
    const result = await wToken.callStatic.withdraw(wTokenBal, 0, { gasLimit: 3000000 });
    console.log("Simulation SUCCESS! Would receive:", ethers.utils.formatEther(result), "sWETH");
  } catch (err: any) {
    console.log("Simulation FAILED");
    console.log("Reason:", err.reason);
    console.log("Message:", err.message);
    
    // Try to decode
    if (err.error?.data) {
      const data = err.error.data;
      console.log("Error data:", data);
    }
  }
}
main().catch(console.error);
