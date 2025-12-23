import { ethers } from "hardhat";

const ADDRESSES = {
  mim: "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708",
  stakingVault: "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7",
  sUSDC: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B",
};

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Adding MIM liquidity with:", signer.address);
  
  // Check sUSDC balance
  const sUSDC = new ethers.Contract(ADDRESSES.sUSDC, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256) external returns (bool)",
    "function decimals() view returns (uint8)",
  ], signer);
  
  const decimals = await sUSDC.decimals();
  const balance = await sUSDC.balanceOf(signer.address);
  console.log("\nsUSDC balance:", ethers.utils.formatUnits(balance, decimals));
  
  if (balance.eq(0)) {
    console.log("No sUSDC to mint MIM. Bridge USDC first!");
    return;
  }
  
  // Check MIM balance
  const mim = new ethers.Contract(ADDRESSES.mim, [
    "function balanceOf(address) view returns (uint256)",
    "function mintWithUSDC(uint256) external",
    "function approve(address,uint256) external returns (bool)",
  ], signer);
  
  let mimBalance = await mim.balanceOf(signer.address);
  console.log("MIM balance:", ethers.utils.formatEther(mimBalance));
  
  // If we have sUSDC, mint MIM
  if (balance.gt(0) && mimBalance.lt(ethers.utils.parseEther("10"))) {
    console.log("\nMinting MIM with sUSDC...");
    // Approve sUSDC
    await (await sUSDC.approve(ADDRESSES.mim, ethers.constants.MaxUint256)).wait();
    
    // Mint MIM (10 sUSDC worth if available)
    const mintAmount = balance.lt(ethers.utils.parseUnits("10", decimals)) 
      ? balance 
      : ethers.utils.parseUnits("10", decimals);
    
    try {
      const tx = await mim.mintWithUSDC(mintAmount, { gasLimit: 1000000 });
      await tx.wait();
      console.log("MIM minted!");
      mimBalance = await mim.balanceOf(signer.address);
      console.log("New MIM balance:", ethers.utils.formatEther(mimBalance));
    } catch (e: any) {
      console.log("Mint failed:", e.reason || e.message?.slice(0, 100));
    }
  }
  
  // Stake MIM to StakingVault
  if (mimBalance.gt(0)) {
    console.log("\nStaking MIM to StakingVault...");
    
    // Approve MIM for StakingVault
    await (await mim.approve(ADDRESSES.stakingVault, ethers.constants.MaxUint256)).wait();
    
    const stakingVault = new ethers.Contract(ADDRESSES.stakingVault, [
      "function deposit(uint256) external returns (uint256)",
      "function getCash() view returns (uint256)",
    ], signer);
    
    const cashBefore = await stakingVault.getCash();
    console.log("Cash before:", ethers.utils.formatEther(cashBefore), "MIM");
    
    try {
      const tx = await stakingVault.deposit(mimBalance, { gasLimit: 500000 });
      await tx.wait();
      console.log("✓ MIM staked!");
    } catch (e: any) {
      console.log("Stake failed:", e.reason || e.message?.slice(0, 100));
    }
    
    const cashAfter = await stakingVault.getCash();
    console.log("Cash after:", ethers.utils.formatEther(cashAfter), "MIM");
    console.log("Max sWETH deposit now:", parseFloat(ethers.utils.formatEther(cashAfter)) * 0.9 / 3000, "sWETH");
  }
}

main().catch(console.error);

