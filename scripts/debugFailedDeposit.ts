import { ethers } from "hardhat";

const TX_HASH = "0x6f4b2b15c32b81122155cc66ac84cc7479f38a30036904ab7f6f9e84f9d74057";

const ADDRESSES = {
  wETH: "0xEA7681f28c62AbF83DeD17eEd88D48b3BD813Af7",
  leverageAMM: "0x8CA24d00ffcF60e9ba7F67F9d41ccA28E22dF508",
  v3LPVault: "0x1139d155D39b2520047178444C51D3D70204650F",
  stakingVault: "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7",
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  oracle: "0xD8680463F66C7bF74C61A2660aF4d7094ee9F749",
  mim: "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708",
};

async function main() {
  const [signer] = await ethers.getSigners();
  const provider = signer.provider!;
  
  console.log("Debugging failed tx:", TX_HASH);
  
  // Check current state
  console.log("\n=== Current Contract State ===\n");
  
  // StakingVault
  const stakingVault = new ethers.Contract(ADDRESSES.stakingVault, [
    "function getCash() view returns (uint256)",
    "function totalBorrows() view returns (uint256)",
    "function maxUtilization() view returns (uint256)",
    "function isBorrower(address) view returns (bool)",
  ], signer);
  
  const cash = await stakingVault.getCash();
  const borrows = await stakingVault.totalBorrows();
  console.log("StakingVault:");
  console.log("  Cash:", ethers.utils.formatEther(cash), "MIM");
  console.log("  Borrows:", ethers.utils.formatEther(borrows), "MIM");
  console.log("  Available (90%):", ethers.utils.formatEther(cash.mul(90).div(100)), "MIM");
  
  try {
    const isBorrower = await stakingVault.isBorrower(ADDRESSES.leverageAMM);
    console.log("  LeverageAMM is borrower:", isBorrower);
  } catch (e) {
    console.log("  isBorrower check failed");
  }
  
  // LeverageAMM
  const leverageAMM = new ethers.Contract(ADDRESSES.leverageAMM, [
    "function getPrice() view returns (uint256)",
    "function totalDebt() view returns (uint256)",
    "function totalUnderlying() view returns (uint256)",
    "function wToken() view returns (address)",
    "function v3LPVault() view returns (address)",
    "function stakingVault() view returns (address)",
    "function mim() view returns (address)",
  ], signer);
  
  console.log("\nLeverageAMM:");
  console.log("  wToken:", await leverageAMM.wToken());
  console.log("  v3LPVault:", await leverageAMM.v3LPVault());
  console.log("  stakingVault:", await leverageAMM.stakingVault());
  console.log("  mim:", await leverageAMM.mim());
  console.log("  getPrice():", ethers.utils.formatEther(await leverageAMM.getPrice()), "MIM/sWETH");
  console.log("  totalDebt:", ethers.utils.formatEther(await leverageAMM.totalDebt()), "MIM");
  console.log("  totalUnderlying:", ethers.utils.formatEther(await leverageAMM.totalUnderlying()), "sWETH");
  
  // wETH
  const wETH = new ethers.Contract(ADDRESSES.wETH, [
    "function totalSupply() view returns (uint256)",
    "function leverageAMM() view returns (address)",
    "function depositsPaused() view returns (bool)",
  ], signer);
  
  console.log("\nwETH:");
  console.log("  totalSupply:", ethers.utils.formatEther(await wETH.totalSupply()));
  console.log("  leverageAMM:", await wETH.leverageAMM());
  console.log("  depositsPaused:", await wETH.depositsPaused());
  
  // Check user balances
  const sWETH = new ethers.Contract(ADDRESSES.sWETH, [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address,address) view returns (uint256)",
  ], signer);
  
  console.log("\nUser state:");
  const userSWETH = await sWETH.balanceOf(signer.address);
  const allowance = await sWETH.allowance(signer.address, ADDRESSES.wETH);
  console.log("  sWETH balance:", ethers.utils.formatEther(userSWETH));
  console.log("  sWETH allowance for wETH:", ethers.utils.formatEther(allowance));
  
  // Try to simulate a small deposit
  console.log("\n=== Simulating Deposit ===");
  const testAmount = ethers.utils.parseEther("0.0001");
  
  try {
    const shares = await wETH.callStatic.deposit(testAmount, 0, { from: signer.address, gasLimit: 2000000 });
    console.log("Simulation success! Would receive:", ethers.utils.formatEther(shares), "wETH");
  } catch (e: any) {
    console.log("Simulation failed:", e.reason || e.message?.slice(0, 200));
    
    // Try to decode error
    if (e.data) {
      console.log("Error data:", e.data.slice(0, 100));
    }
  }
}

main().catch(console.error);


