import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const WTOKEN = "0x998E56B74e0c0D94c4315aD2EfC79a99868c67A3";
const LEVERAGE_AMM = "0x897074004705Ca3C578e403090F1FF397A7807Bb";
const V3_VAULT = "0x64B933Ce0536f5508cf9Ccec9628E969434dc8E1";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const ORACLE = "0xeD77B9f54cc9ACb496916a4fED764869E927FFcb";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Debug V19 Deposit ===\n");
  
  // Check all configurations
  const leverageAMM = new ethers.Contract(LEVERAGE_AMM, [
    "function underlyingAsset() view returns (address)",
    "function mim() view returns (address)",
    "function stakingVault() view returns (address)",
    "function v3LPVault() view returns (address)",
    "function oracle() view returns (address)",
    "function wToken() view returns (address)"
  ], signer);
  
  console.log("LeverageAMM configuration:");
  console.log("  underlyingAsset:", await leverageAMM.underlyingAsset());
  console.log("  mim:", await leverageAMM.mim());
  console.log("  stakingVault:", await leverageAMM.stakingVault());
  console.log("  v3LPVault:", await leverageAMM.v3LPVault());
  console.log("  oracle:", await leverageAMM.oracle());
  console.log("  wToken:", await leverageAMM.wToken());
  
  // Check V3 vault operator
  const v3Vault = new ethers.Contract(V3_VAULT, [
    "function isOperator(address) view returns (bool)",
    "function pool() view returns (address)",
    "function token0() view returns (address)",
    "function token1() view returns (address)"
  ], signer);
  
  console.log("\nV3LPVault:");
  console.log("  Is LeverageAMM operator:", await v3Vault.isOperator(LEVERAGE_AMM));
  console.log("  pool:", await v3Vault.pool());
  console.log("  token0:", await v3Vault.token0());
  console.log("  token1:", await v3Vault.token1());
  
  // Check staking vault
  const stakingVault = new ethers.Contract(STAKING_VAULT, [
    "function isBorrower(address) view returns (bool)",
    "function totalAssets() view returns (uint256)",
    "function totalBorrows() view returns (uint256)"
  ], signer);
  
  console.log("\nStakingVault:");
  console.log("  Is LeverageAMM borrower:", await stakingVault.isBorrower(LEVERAGE_AMM));
  const assets = await stakingVault.totalAssets();
  const borrows = await stakingVault.totalBorrows();
  console.log("  Total assets:", ethers.utils.formatEther(assets), "MIM");
  console.log("  Total borrows:", ethers.utils.formatEther(borrows), "MIM");
  console.log("  Available:", ethers.utils.formatEther(assets.sub(borrows)), "MIM");
  
  // Check oracle
  const oracle = new ethers.Contract(ORACLE, [
    "function getPrice() view returns (uint256)"
  ], signer);
  console.log("\nOracle price:", ethers.utils.formatEther(await oracle.getPrice()), "MIM per sWETH");
  
  // Check token approvals
  const sweth = new ethers.Contract(SWETH, [
    "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256)"
  ], signer);
  
  const mim = new ethers.Contract(MIM, [
    "function allowance(address,address) view returns (uint256)"
  ], signer);
  
  console.log("\nApprovals:");
  console.log("  sWETH allowance for WToken:", ethers.utils.formatEther(await sweth.allowance(signer.address, WTOKEN)));
  
  // Ensure approval
  const depositAmount = ethers.utils.parseEther("0.0005");
  await (await sweth.approve(WTOKEN, ethers.constants.MaxUint256)).wait();
  
  // Simulate deposit
  const wToken = new ethers.Contract(WTOKEN, [
    "function deposit(uint256) external"
  ], signer);
  
  console.log("\nSimulating deposit of", ethers.utils.formatEther(depositAmount), "sWETH...");
  try {
    await wToken.callStatic.deposit(depositAmount, { gasLimit: 2000000 });
    console.log("Simulation SUCCESS!");
  } catch (err: any) {
    console.log("Simulation FAILED:");
    console.log("  Reason:", err.reason);
    console.log("  Message:", err.message);
    
    // Try to decode error
    if (err.data) {
      console.log("  Error data:", err.data);
    }
  }
}
main().catch(console.error);
