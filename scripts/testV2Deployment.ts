import { ethers } from "hardhat";

// New V2 deployment addresses
const NEW_MIM = "0x6C9Bbf94A171714761F5F02DaD5c7D0f40920143";
const NEW_STAKING_VAULT = "0x316a467A6c957de797052ECE1355027AF7487eaf";
const NEW_V3_VAULT = "0xa8260A0EdB5a1bC9cb0A8640D991B4B08F43Db71";
const NEW_LEVERAGE_AMM = "0x4e44Ee137533aA5aEc97EC8353073b66FFd89484";
const NEW_WTOKEN = "0xA7188f5853560346c1cfc7Dd48351ee2f2432f5b";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const SUSDC = "0xd3DCe716f3eF535C5Ff8d041c1A41C3bd89b97aE";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Test V2 Deployment ===\n");
  
  const sweth = new ethers.Contract(SWETH, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)"
  ], signer);
  
  const mim = new ethers.Contract(NEW_MIM, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)",
    "function mintWithUSDC(uint256)"
  ], signer);
  
  const susdc = new ethers.Contract(SUSDC, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)"
  ], signer);
  
  const stakingVault = new ethers.Contract(NEW_STAKING_VAULT, [
    "function deposit(uint256) returns (uint256)",
    "function withdraw(uint256) returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function getCash() view returns (uint256)",
    "function totalAssets() view returns (uint256)"
  ], signer);
  
  const wToken = new ethers.Contract(NEW_WTOKEN, [
    "function deposit(uint256,uint256) returns (uint256)",
    "function withdraw(uint256,uint256) returns (uint256)",
    "function balanceOf(address) view returns (uint256)"
  ], signer);
  
  console.log("1. Check balances:");
  console.log("   sWETH:", ethers.utils.formatEther(await sweth.balanceOf(signer.address)));
  console.log("   sUSDC:", ethers.utils.formatUnits(await susdc.balanceOf(signer.address), 6));
  console.log("   Old MIM:", ethers.utils.formatEther(await (new ethers.Contract("0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708", ["function balanceOf(address) view returns (uint256)"], signer)).balanceOf(signer.address)));
  console.log("   New MIM:", ethers.utils.formatEther(await mim.balanceOf(signer.address)));
  
  // Step 1: Mint some new MIM using sUSDC
  const susdcBal = await susdc.balanceOf(signer.address);
  if (susdcBal.gt(0)) {
    console.log("\n2. Minting new MIM with sUSDC...");
    const mintAmount = susdcBal.div(2); // Use half
    
    await (await susdc.approve(NEW_MIM, mintAmount)).wait();
    try {
      const tx = await mim.mintWithUSDC(mintAmount, { gasLimit: 1000000 });
      await tx.wait();
      console.log("   ✓ Minted MIM:", ethers.utils.formatEther(await mim.balanceOf(signer.address)));
    } catch (e: any) {
      console.log("   ✗ Mint failed:", e.reason || e.message?.slice(0, 100));
    }
  }
  
  // Step 2: Deposit MIM to StakingVault
  const mimBal = await mim.balanceOf(signer.address);
  if (mimBal.gt(0)) {
    console.log("\n3. Depositing MIM to StakingVault...");
    const depositAmount = mimBal.div(2);
    
    await (await mim.approve(NEW_STAKING_VAULT, depositAmount)).wait();
    try {
      const tx = await stakingVault.deposit(depositAmount, { gasLimit: 500000 });
      await tx.wait();
      console.log("   ✓ Deposited! sMIM balance:", ethers.utils.formatEther(await stakingVault.balanceOf(signer.address)));
      console.log("   Vault cash:", ethers.utils.formatEther(await stakingVault.getCash()));
    } catch (e: any) {
      console.log("   ✗ Deposit failed:", e.reason || e.message?.slice(0, 100));
    }
  }
  
  // Step 3: Test wETH deposit
  const swethBal = await sweth.balanceOf(signer.address);
  if (swethBal.gt(0)) {
    console.log("\n4. Testing wETH deposit...");
    const depositSweth = ethers.utils.parseEther("0.0001");
    
    await (await sweth.approve(NEW_WTOKEN, depositSweth)).wait();
    try {
      const tx = await wToken.deposit(depositSweth, 0, { gasLimit: 2000000 });
      await tx.wait();
      console.log("   ✓ Deposit succeeded! wETH balance:", ethers.utils.formatEther(await wToken.balanceOf(signer.address)));
    } catch (e: any) {
      console.log("   ✗ Deposit failed:", e.reason || e.message?.slice(0, 200));
    }
  }
  
  // Step 4: Test wETH withdrawal
  const wethBal = await wToken.balanceOf(signer.address);
  if (wethBal.gt(0)) {
    console.log("\n5. Testing wETH withdrawal...");
    const swethBefore = await sweth.balanceOf(signer.address);
    
    try {
      const tx = await wToken.withdraw(wethBal, 0, { gasLimit: 3000000 });
      await tx.wait();
      console.log("   ✓ Withdrawal succeeded!");
      console.log("   sWETH received:", ethers.utils.formatEther((await sweth.balanceOf(signer.address)).sub(swethBefore)));
    } catch (e: any) {
      console.log("   ✗ Withdrawal failed:", e.reason || e.message?.slice(0, 200));
    }
  }
  
  console.log("\n=== Final Balances ===");
  console.log("sWETH:", ethers.utils.formatEther(await sweth.balanceOf(signer.address)));
  console.log("New MIM:", ethers.utils.formatEther(await mim.balanceOf(signer.address)));
  console.log("sMIM:", ethers.utils.formatEther(await stakingVault.balanceOf(signer.address)));
  console.log("wETH:", ethers.utils.formatEther(await wToken.balanceOf(signer.address)));
}
main().catch(console.error);
