import { ethers } from "hardhat";

const OLD_MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const NEW_MIM = "0x6C9Bbf94A171714761F5F02DaD5c7D0f40920143";
const NEW_STAKING_VAULT = "0x316a467A6c957de797052ECE1355027AF7487eaf";
const SUSDC = "0xd3DCe716f3eF535C5Ff8d041c1A41C3bd89b97aE";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Seed New Vault ===\n");
  
  const oldMim = new ethers.Contract(OLD_MIM, [
    "function balanceOf(address) view returns (uint256)"
  ], signer);
  
  const newMim = new ethers.Contract(NEW_MIM, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)",
    "function mintWithUSDC(uint256)",
    "function owner() view returns (address)",
    "function mint(address,uint256)" // Check if there's a mint function
  ], signer);
  
  const susdc = new ethers.Contract(SUSDC, [
    "function balanceOf(address) view returns (uint256)"
  ], signer);
  
  const stakingVault = new ethers.Contract(NEW_STAKING_VAULT, [
    "function deposit(uint256) returns (uint256)",
    "function getCash() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)"
  ], signer);
  
  console.log("Current balances:");
  console.log("  Old MIM:", ethers.utils.formatEther(await oldMim.balanceOf(signer.address)));
  console.log("  New MIM:", ethers.utils.formatEther(await newMim.balanceOf(signer.address)));
  console.log("  sUSDC:", ethers.utils.formatUnits(await susdc.balanceOf(signer.address), 6));
  console.log("  New StakingVault cash:", ethers.utils.formatEther(await stakingVault.getCash()));
  
  // Check if new MIM has owner mint function
  console.log("\nChecking new MIM owner...");
  const mimOwner = await newMim.owner();
  console.log("  MIM owner:", mimOwner);
  console.log("  Am I owner:", mimOwner.toLowerCase() === signer.address.toLowerCase());
  
  // Try to mint new MIM directly (if owner has mint function)
  if (mimOwner.toLowerCase() === signer.address.toLowerCase()) {
    console.log("\n  Attempting to mint new MIM as owner...");
    try {
      const mintAmount = ethers.utils.parseEther("10");
      const tx = await newMim.mint(signer.address, mintAmount, { gasLimit: 500000 });
      await tx.wait();
      console.log("  ✓ Minted 10 new MIM!");
    } catch (e: any) {
      console.log("  ✗ Direct mint failed:", e.reason || e.message?.slice(0, 100));
      console.log("  (Likely no direct mint function - need to use mintWithUSDC)");
    }
  }
  
  // Check sUSDC balance (we need this to mint new MIM)
  const susdcBal = await susdc.balanceOf(signer.address);
  if (susdcBal.eq(0)) {
    console.log("\n⚠️  No sUSDC available. Need to get sUSDC first to mint new MIM.");
    console.log("   Options:");
    console.log("   1. Bridge USDC from another chain to Sonic");
    console.log("   2. Swap old MIM to sUSDC on a DEX");
    console.log("   3. Add an owner mint function to new MIM contract");
  }
  
  // Let's check the new MIM contract for any other ways to mint
  console.log("\n  Checking if StakingVault can mint...");
  // The deployment said: "StakingVault authorized as MIM minter"
  // Maybe we can have StakingVault mint directly?
}
main().catch(console.error);
