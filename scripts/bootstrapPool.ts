import { ethers } from "hardhat";

const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";
const MIM = "0x1590da8C11431eFe1cB42Acfd8A500A5bdb7B1A2";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)"
];

const PM_ABI = [
  "function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)"
];

function nearestUsableTick(tick: number, tickSpacing: number): number {
  return Math.round(tick / tickSpacing) * tickSpacing;
}

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);
  
  // Use 0.05% pool (correct price, current tick -80201)
  const currentTick = -80201;
  const tickSpacing = 10;
  
  // Create a range AROUND the current tick (both-sided liquidity)
  const tickLower = nearestUsableTick(currentTick - 5000, tickSpacing); // -85200
  const tickUpper = nearestUsableTick(currentTick + 5000, tickSpacing); // -75200
  
  console.log("\nBoth-sided liquidity range:");
  console.log("  Current tick:", currentTick);
  console.log("  tickLower:", tickLower);
  console.log("  tickUpper:", tickUpper);
  console.log("  Current tick in range?", tickLower < currentTick && currentTick < tickUpper);
  
  // Check balances
  const sweth = new ethers.Contract(SWETH, ERC20_ABI, signer);
  const mim = new ethers.Contract(MIM, ERC20_ABI, signer);
  
  const swethBalance = await sweth.balanceOf(signer.address);
  const mimBalance = await mim.balanceOf(signer.address);
  
  console.log("\nBalances:");
  console.log("  sWETH:", ethers.utils.formatEther(swethBalance));
  console.log("  MIM:", ethers.utils.formatUnits(mimBalance, 18));
  
  // Use small amounts
  // At price 3040 MIM/sWETH, for balanced: amount0 (MIM) ≈ amount1 (sWETH) * 3040
  const amount1Desired = ethers.utils.parseEther("0.001"); // 0.001 sWETH
  const amount0Desired = ethers.utils.parseUnits("3", 18); // 3 MIM (roughly 0.001 * 3040)
  
  console.log("\nDeposit amounts:");
  console.log("  MIM:", ethers.utils.formatUnits(amount0Desired, 18));
  console.log("  sWETH:", ethers.utils.formatEther(amount1Desired));
  
  if (mimBalance.lt(amount0Desired)) {
    console.log("Insufficient MIM!");
    return;
  }
  if (swethBalance.lt(amount1Desired)) {
    console.log("Insufficient sWETH!");
    return;
  }
  
  // Approve both tokens
  console.log("\nApproving MIM...");
  let tx = await mim.approve(POSITION_MANAGER, amount0Desired);
  await tx.wait();
  
  console.log("Approving sWETH...");
  tx = await sweth.approve(POSITION_MANAGER, amount1Desired);
  await tx.wait();
  
  console.log("Approved both!");
  
  // Mint
  const pm = new ethers.Contract(POSITION_MANAGER, PM_ABI, signer);
  
  console.log("\nMinting both-sided position...");
  try {
    const mintTx = await pm.mint({
      token0: MIM,
      token1: SWETH,
      fee: 500,
      tickLower: tickLower,
      tickUpper: tickUpper,
      amount0Desired: amount0Desired,
      amount1Desired: amount1Desired,
      amount0Min: 0,
      amount1Min: 0,
      recipient: signer.address,
      deadline: Math.floor(Date.now() / 1000) + 3600
    }, { gasLimit: 600000 });
    
    console.log("Tx hash:", mintTx.hash);
    const receipt = await mintTx.wait();
    console.log("SUCCESS! Gas used:", receipt.gasUsed.toString());
    
    // Parse logs to see what happened
    for (const log of receipt.logs) {
      console.log("Log:", log.topics[0].slice(0, 10), "...");
    }
  } catch (error: any) {
    console.log("Error:", error.message);
    if (error.reason) console.log("Reason:", error.reason);
  }
}

main().catch(console.error);


