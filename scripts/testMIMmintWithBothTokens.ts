import { ethers } from "hardhat";

const NEW_MIM = "0xf3DBF67010C7cAd25c152AB772F8Ef240Cc9c14f";
const MIM_USDC_POOL = "0x3Be1A1975D2bd22fDE3079f2eee7140Cb55BE556";
const sUSDC = "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B";
const OWNER = "0x4151E05ABe56192e2A6775612C2020509Fd50637";

async function main() {
  console.log("=== Test MIM Mint with Both Tokens ===\n");
  
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);
  
  // Check sUSDC balance
  const erc20ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
  ];
  const usdc = await ethers.getContractAt(erc20ABI, sUSDC);
  const balance = await usdc.balanceOf(OWNER);
  console.log("sUSDC balance:", ethers.utils.formatUnits(balance, 6));
  
  // Check pool state BEFORE
  console.log("\n--- Pool State BEFORE ---");
  const usdcInPool = await usdc.balanceOf(MIM_USDC_POOL);
  const mimToken = await ethers.getContractAt(erc20ABI, NEW_MIM);
  const mimInPool = await mimToken.balanceOf(MIM_USDC_POOL);
  console.log("sUSDC in pool:", ethers.utils.formatUnits(usdcInPool, 6));
  console.log("MIM in pool:", ethers.utils.formatUnits(mimInPool, 18));
  
  // Approve MIM contract to spend sUSDC
  const mintAmount = ethers.utils.parseUnits("5", 6); // 5 USDC
  console.log("\n--- Minting 5 MIM ---");
  
  const mimABI = [
    "function mintWithUSDC(uint256 amount) external",
    "function balanceOf(address) view returns (uint256)",
    "function liquidityPositionId() view returns (uint256)",
    "function totalLiquidity() view returns (uint128)"
  ];
  const mim = await ethers.getContractAt(mimABI, NEW_MIM);
  
  // Approve
  console.log("Approving sUSDC...");
  const approveTx = await usdc.approve(NEW_MIM, mintAmount);
  await approveTx.wait();
  
  // Mint
  console.log("Minting MIM...");
  const mintTx = await mim.mintWithUSDC(mintAmount);
  const receipt = await mintTx.wait();
  console.log("TX:", mintTx.hash);
  
  // Check pool state AFTER
  console.log("\n--- Pool State AFTER ---");
  const usdcInPoolAfter = await usdc.balanceOf(MIM_USDC_POOL);
  const mimInPoolAfter = await mimToken.balanceOf(MIM_USDC_POOL);
  console.log("sUSDC in pool:", ethers.utils.formatUnits(usdcInPoolAfter, 6));
  console.log("MIM in pool:", ethers.utils.formatUnits(mimInPoolAfter, 18));
  
  // Calculate changes
  const usdcAdded = usdcInPoolAfter.sub(usdcInPool);
  const mimAdded = mimInPoolAfter.sub(mimInPool);
  console.log("\n--- Tokens Added to Pool ---");
  console.log("sUSDC added:", ethers.utils.formatUnits(usdcAdded, 6));
  console.log("MIM added:", ethers.utils.formatUnits(mimAdded, 18));
  
  // Check user's MIM balance
  const userMIM = await mim.balanceOf(OWNER);
  console.log("\n--- User Balances ---");
  console.log("User MIM balance:", ethers.utils.formatUnits(userMIM, 18));
  
  // Check MIM contract state
  const posId = await mim.liquidityPositionId();
  const totalLiq = await mim.totalLiquidity();
  console.log("\n--- MIM Contract State ---");
  console.log("Position ID:", posId.toString());
  console.log("Total Liquidity:", totalLiq.toString());
  
  // Verify both tokens were added
  if (usdcAdded.gt(0) && mimAdded.gt(0)) {
    console.log("\n✓ SUCCESS: Both sUSDC and MIM were added to the liquidity pool!");
  } else if (usdcAdded.eq(0)) {
    console.log("\n✗ FAILED: No sUSDC was added to the pool!");
  } else if (mimAdded.eq(0)) {
    console.log("\n✗ FAILED: No MIM was added to the pool!");
  }
}

main().catch(console.error);
