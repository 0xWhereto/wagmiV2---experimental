import { ethers } from "hardhat";

const WETH_TOKEN = "0xB96651342aE83BfCf509659D16Fd41712B0c58b3"; // wETH (Zero-IL v3)
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Account:", signer.address);
  
  // Check sWETH balance
  const sWETH = new ethers.Contract(SWETH, [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
  ], signer);
  
  const balance = await sWETH.balanceOf(signer.address);
  const allowance = await sWETH.allowance(signer.address, WETH_TOKEN);
  
  console.log("\nsWETH:");
  console.log("  Balance:", ethers.utils.formatEther(balance));
  console.log("  Allowance for wETH:", ethers.utils.formatEther(allowance));
  
  // Check wETH contract (using correct WToken function names)
  const wETH = new ethers.Contract(WETH_TOKEN, [
    "function underlyingAsset() view returns (address)",
    "function leverageAMM() view returns (address)",
    "function v3LPVault() view returns (address)",
    "function totalDeposited() view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function pricePerShare() view returns (uint256)",
    "function convertToShares(uint256) view returns (uint256)",
    "function deposit(uint256,uint256) external returns (uint256)",
    "function depositsPaused() view returns (bool)",
  ], signer);
  
  console.log("\nwETH Contract:");
  
  try {
    const asset = await wETH.underlyingAsset();
    console.log("  underlyingAsset():", asset);
    console.log("  matches sWETH:", asset.toLowerCase() === SWETH.toLowerCase());
  } catch (e: any) {
    console.log("  underlyingAsset() error:", e.message);
  }
  
  try {
    const amm = await wETH.leverageAMM();
    console.log("  leverageAMM():", amm);
  } catch (e: any) {
    console.log("  leverageAMM() error:", e.message);
  }
  
  try {
    const vault = await wETH.v3LPVault();
    console.log("  v3LPVault():", vault);
  } catch (e: any) {
    console.log("  v3LPVault() error:", e.message);
  }
  
  try {
    const paused = await wETH.depositsPaused();
    console.log("  depositsPaused():", paused);
  } catch (e: any) {
    console.log("  depositsPaused() error:", e.message);
  }
  
  try {
    const totalDeposited = await wETH.totalDeposited();
    console.log("  totalDeposited():", ethers.utils.formatEther(totalDeposited));
  } catch (e: any) {
    console.log("  totalDeposited() error:", e.message);
  }
  
  try {
    const totalSupply = await wETH.totalSupply();
    console.log("  totalSupply():", ethers.utils.formatEther(totalSupply));
  } catch (e: any) {
    console.log("  totalSupply() error:", e.message);
  }
  
  try {
    const pps = await wETH.pricePerShare();
    console.log("  pricePerShare():", ethers.utils.formatEther(pps));
  } catch (e: any) {
    console.log("  pricePerShare() error:", e.message);
  }
  
  // Try to simulate deposit
  console.log("\n--- Testing deposit ---");
  
  const testAmount = ethers.utils.parseEther("0.0001");
  
  // Approve first
  if (allowance.lt(testAmount)) {
    console.log("Approving sWETH...");
    await (await sWETH.approve(WETH_TOKEN, ethers.constants.MaxUint256)).wait();
    console.log("Approved!");
  }
  
  try {
    // Static call to simulate
    const shares = await wETH.callStatic.deposit(testAmount, 0);
    console.log("Simulation succeeded! Would receive:", ethers.utils.formatEther(shares), "wETH");
  } catch (e: any) {
    console.log("Simulation failed:", e.reason || e.message);
    if (e.error?.message) console.log("Inner error:", e.error.message);
  }
}

main().catch(console.error);

