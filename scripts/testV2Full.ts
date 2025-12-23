import { ethers } from "hardhat";

// Latest deployment
const MIM = "0xA9944C8466FD115326911726DC8F3282647EED44";
const STAKING_VAULT = "0x5Ecf4102Cd9044468B2797b7cbEa5C413c24f258";
const LEVERAGE_AMM = "0x5E1551d693cbBdD4d9558565BE61F89C9A3CC953";
const WTOKEN = "0xf77d417726919E372104FfEF0A6F89B78FfA1CD7";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Test V2 Full Flow ===\n");
  
  const mim = new ethers.Contract(MIM, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)",
    "function mint(address,uint256)",
    "function owner() view returns (address)"
  ], signer);
  
  const sweth = new ethers.Contract(SWETH, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)"
  ], signer);
  
  const stakingVault = new ethers.Contract(STAKING_VAULT, [
    "function deposit(uint256) returns (uint256)",
    "function getCash() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function totalAssets() view returns (uint256)"
  ], signer);
  
  const wToken = new ethers.Contract(WTOKEN, [
    "function deposit(uint256,uint256) returns (uint256)",
    "function withdraw(uint256,uint256) returns (uint256)",
    "function balanceOf(address) view returns (uint256)"
  ], signer);
  
  console.log("1. Check initial state:");
  console.log("   sWETH:", ethers.utils.formatEther(await sweth.balanceOf(signer.address)));
  console.log("   MIM:", ethers.utils.formatEther(await mim.balanceOf(signer.address)));
  console.log("   StakingVault cash:", ethers.utils.formatEther(await stakingVault.getCash()));
  
  // Seed vault if needed
  const vaultCash = await stakingVault.getCash();
  if (vaultCash.lt(ethers.utils.parseEther("10"))) {
    console.log("\n2. Seeding StakingVault with MIM...");
    
    // Check if we can mint
    const mimOwner = await mim.owner();
    if (mimOwner.toLowerCase() === signer.address.toLowerCase()) {
      // Mint MIM
      await (await mim.mint(signer.address, ethers.utils.parseEther("100"))).wait();
      console.log("   ✓ Minted 100 MIM");
      
      // Deposit to vault
      await (await mim.approve(STAKING_VAULT, ethers.utils.parseEther("50"))).wait();
      await (await stakingVault.deposit(ethers.utils.parseEther("50"), { gasLimit: 500000 })).wait();
      console.log("   ✓ Deposited 50 MIM to vault");
      console.log("   New vault cash:", ethers.utils.formatEther(await stakingVault.getCash()));
    } else {
      console.log("   ✗ Cannot mint MIM - not owner");
    }
  } else {
    console.log("\n   Vault already has liquidity:", ethers.utils.formatEther(vaultCash), "MIM");
  }
  
  // Test wETH deposit
  const swethBal = await sweth.balanceOf(signer.address);
  console.log("\n3. Testing wETH deposit...");
  console.log("   sWETH balance:", ethers.utils.formatEther(swethBal));
  
  if (swethBal.gt(ethers.utils.parseEther("0.0001"))) {
    const depositAmount = ethers.utils.parseEther("0.0001");
    
    await (await sweth.approve(WTOKEN, depositAmount)).wait();
    console.log("   Approved wToken");
    
    try {
      const tx = await wToken.deposit(depositAmount, 0, { gasLimit: 2000000 });
      await tx.wait();
      console.log("   ✓ Deposit succeeded!");
      console.log("   wETH balance:", ethers.utils.formatEther(await wToken.balanceOf(signer.address)));
    } catch (e: any) {
      console.log("   ✗ Deposit failed:", e.reason || e.message?.slice(0, 200));
      return;
    }
  } else {
    console.log("   Not enough sWETH to test");
    return;
  }
  
  // Test wETH withdrawal
  console.log("\n4. Testing wETH withdrawal...");
  const wethBal = await wToken.balanceOf(signer.address);
  const swethBefore = await sweth.balanceOf(signer.address);
  
  try {
    const tx = await wToken.withdraw(wethBal, 0, { gasLimit: 3000000 });
    await tx.wait();
    console.log("   ✓ Withdrawal succeeded!");
    
    const swethAfter = await sweth.balanceOf(signer.address);
    console.log("   sWETH received:", ethers.utils.formatEther(swethAfter.sub(swethBefore)));
    console.log("   wETH remaining:", ethers.utils.formatEther(await wToken.balanceOf(signer.address)));
  } catch (e: any) {
    console.log("   ✗ Withdrawal failed:", e.reason || e.message?.slice(0, 200));
  }
  
  console.log("\n=== Final State ===");
  console.log("sWETH:", ethers.utils.formatEther(await sweth.balanceOf(signer.address)));
  console.log("MIM:", ethers.utils.formatEther(await mim.balanceOf(signer.address)));
  console.log("wETH:", ethers.utils.formatEther(await wToken.balanceOf(signer.address)));
  console.log("StakingVault cash:", ethers.utils.formatEther(await stakingVault.getCash()));
}
main().catch(console.error);
