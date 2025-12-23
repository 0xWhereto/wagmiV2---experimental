import { ethers } from "hardhat";

// Latest fresh deployment
const V3_VAULT = "0xC4AC36c923658F9281bFEF592f36A2EC5101b19a";
const LEVERAGE_AMM = "0xBAF3F6A7ce4AfE9FE172Cf84b7Be99C45473bF74";
const WTOKEN = "0x1da18a479752820DD018feA75A27724fbA2F62e3";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const ORACLE = "0xeD77B9f54cc9ACb496916a4fED764869E927FFcb";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Trace Deposit Revert ===\n");
  
  const sweth = new ethers.Contract(SWETH, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)",
    "function transfer(address,uint256)"
  ], signer);
  const mim = new ethers.Contract(MIM, ["function balanceOf(address) view returns (uint256)"], signer);
  
  const leverageAMM = (await ethers.getContractFactory("LeverageAMM")).attach(LEVERAGE_AMM);
  const wToken = (await ethers.getContractFactory("WToken")).attach(WTOKEN);
  const v3Vault = (await ethers.getContractFactory("V3LPVault")).attach(V3_VAULT);
  
  const amount = ethers.utils.parseEther("0.0002");
  
  // Check if wToken has approval to LeverageAMM
  const swethContract = new ethers.Contract(SWETH, ["function allowance(address,address) view returns (uint256)"], signer);
  console.log("1. WToken allowance to LeverageAMM:", 
    ethers.utils.formatEther(await swethContract.allowance(WTOKEN, LEVERAGE_AMM)));
  
  // Step-by-step simulation
  console.log("\n2. Simulating deposit steps...");
  
  // Step A: User approves WToken
  await (await sweth.approve(WTOKEN, ethers.constants.MaxUint256)).wait();
  console.log("   ✓ User approved WToken");
  
  // Step B: Try WToken.deposit static call
  console.log("\n3. Static call WToken.deposit...");
  try {
    await wToken.callStatic.deposit(amount, 0);
    console.log("   ✓ Static call succeeded!");
  } catch (err: any) {
    console.log("   ✗ Static call failed:", err.reason || err.message?.slice(0, 200));
    
    // Try to decode the error
    if (err.data) {
      console.log("   Error data:", err.data);
    }
  }
  
  // Step C: Try calling openPosition directly (need to impersonate wToken)
  console.log("\n4. Testing LeverageAMM.openPosition preconditions...");
  
  // Check oracle price
  const oracle = new ethers.Contract(ORACLE, ["function getPrice() view returns (uint256)"], signer);
  try {
    const price = await oracle.getPrice();
    console.log("   Oracle price:", ethers.utils.formatEther(price), "MIM per sWETH");
  } catch (e: any) {
    console.log("   ✗ Oracle.getPrice() failed:", e.message?.slice(0, 100));
  }
  
  // Check staking vault borrow availability
  const stakingVault = new ethers.Contract(STAKING_VAULT, [
    "function totalAssets() view returns (uint256)",
    "function totalBorrows() view returns (uint256)",
    "function isBorrower(address) view returns (bool)"
  ], signer);
  
  const assets = await stakingVault.totalAssets();
  const borrows = await stakingVault.totalBorrows();
  const available = assets.sub(borrows);
  console.log("   StakingVault available:", ethers.utils.formatEther(available), "MIM");
  console.log("   LeverageAMM isBorrower:", await stakingVault.isBorrower(LEVERAGE_AMM));
  
  // Calculate how much we'd borrow
  const price = await oracle.getPrice();
  const borrowNeeded = amount.mul(price).div(ethers.utils.parseEther("1"));
  console.log("   Would need to borrow:", ethers.utils.formatEther(borrowNeeded), "MIM");
  console.log("   Enough liquidity:", available.gte(borrowNeeded) ? "✓ Yes" : "✗ No");
  
  // Check V3LPVault
  console.log("\n5. V3LPVault state:");
  console.log("   isOperator(LeverageAMM):", await v3Vault.isOperator(LEVERAGE_AMM));
  const layers = [];
  for (let i = 0; i < 4; i++) {
    try {
      const layer = await v3Vault.layers(i);
      layers.push({ idx: i, tokenId: layer.tokenId.toNumber(), tickLower: layer.tickLower, tickUpper: layer.tickUpper });
    } catch { break; }
  }
  console.log("   Layers:", layers.length > 0 ? "configured" : "NOT configured");
  layers.forEach(l => console.log(`     Layer ${l.idx}: tokenId=${l.tokenId}, ticks=[${l.tickLower}, ${l.tickUpper}]`));
  
  // Try to manually execute each step
  console.log("\n6. Manual step-by-step execution...");
  
  // A. Transfer sWETH to WToken (simulating first part of deposit)
  const swethBal = await sweth.balanceOf(signer.address);
  console.log("   User sWETH balance:", ethers.utils.formatEther(swethBal));
  
  if (swethBal.lt(amount)) {
    console.log("   ✗ Insufficient sWETH balance!");
    return;
  }
  
  // B. Transfer directly to LeverageAMM and call borrow
  console.log("\n   Transferring sWETH to LeverageAMM...");
  await (await sweth.transfer(LEVERAGE_AMM, amount)).wait();
  console.log("   ✓ Transferred", ethers.utils.formatEther(amount), "sWETH to LeverageAMM");
  
  // C. Try borrow from StakingVault as LeverageAMM
  console.log("\n   Checking if LeverageAMM can borrow...");
  const leverageAMMSWETH = await sweth.balanceOf(LEVERAGE_AMM);
  const leverageAMMMIM = await mim.balanceOf(LEVERAGE_AMM);
  console.log("   LeverageAMM sWETH:", ethers.utils.formatEther(leverageAMMSWETH));
  console.log("   LeverageAMM MIM:", ethers.utils.formatEther(leverageAMMMIM));
  
  // D. Try V3LPVault.addLiquidity as owner directly
  console.log("\n   Testing V3LPVault.addLiquidity as owner...");
  const testAmount0 = ethers.utils.parseEther("0.0001");
  const testAmount1 = ethers.utils.parseEther("0.3");
  
  // Approve
  await (await sweth.approve(V3_VAULT, ethers.constants.MaxUint256)).wait();
  const mimContract = new ethers.Contract(MIM, ["function approve(address,uint256)"], signer);
  await (await mimContract.approve(V3_VAULT, ethers.constants.MaxUint256)).wait();
  
  try {
    const tx = await v3Vault.addLiquidity(testAmount0, testAmount1, 0, 0, { gasLimit: 2000000 });
    await tx.wait();
    console.log("   ✓ V3LPVault.addLiquidity succeeded!");
  } catch (e: any) {
    console.log("   ✗ V3LPVault.addLiquidity failed:", e.message?.slice(0, 150));
  }
}
main().catch(console.error);
