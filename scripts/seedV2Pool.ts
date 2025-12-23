import { ethers } from "hardhat";

const POOL = "0x863EaD6f618456AdeBE876Abce952D4240500e62";
const MIM = "0x9dEb5301967DD118D9F37181EB971d1136a72635";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Seed V2 sWETH/MIM Pool ===\n");
  
  const mim = new ethers.Contract(MIM, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)",
    "function mint(address,uint256)"
  ], signer);
  
  const sweth = new ethers.Contract(SWETH, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)"
  ], signer);
  
  const poolContract = new ethers.Contract(POOL, [
    "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)",
    "function liquidity() view returns (uint128)"
  ], signer);
  
  console.log("1. Pool state before:");
  const slot0 = await poolContract.slot0();
  console.log("   Current tick:", slot0.tick);
  console.log("   Liquidity:", (await poolContract.liquidity()).toString());
  
  console.log("\n2. Balances:");
  console.log("   sWETH:", ethers.utils.formatEther(await sweth.balanceOf(signer.address)));
  console.log("   MIM:", ethers.utils.formatEther(await mim.balanceOf(signer.address)));
  
  // Mint more MIM if needed
  const mimBal = await mim.balanceOf(signer.address);
  if (mimBal.lt(ethers.utils.parseEther("100"))) {
    console.log("\n3. Minting more MIM...");
    await (await mim.mint(signer.address, ethers.utils.parseEther("500"))).wait();
    console.log("   ✓ Minted 500 MIM");
  }
  
  // Add liquidity via NonfungiblePositionManager
  console.log("\n4. Adding liquidity to pool...");
  
  const positionManager = new ethers.Contract(POSITION_MANAGER, [
    "function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)"
  ], signer);
  
  // Current tick is -58095, add liquidity around it
  // Tick spacing for 0.3% fee is 60
  const tickLower = -60000; // Below current tick
  const tickUpper = -54000; // Above current tick
  
  // Amounts: 0.0001 sWETH + 0.3 MIM (roughly matching 3000 MIM/ETH)
  const amount0 = ethers.utils.parseEther("0.0001"); // sWETH
  const amount1 = ethers.utils.parseEther("0.3"); // MIM
  
  // Approve
  await (await sweth.approve(POSITION_MANAGER, amount0)).wait();
  await (await mim.approve(POSITION_MANAGER, amount1)).wait();
  console.log("   Approved tokens");
  
  // Mint position
  const deadline = Math.floor(Date.now() / 1000) + 600;
  
  try {
    const tx = await positionManager.mint({
      token0: SWETH,
      token1: MIM,
      fee: 3000,
      tickLower: tickLower,
      tickUpper: tickUpper,
      amount0Desired: amount0,
      amount1Desired: amount1,
      amount0Min: 0,
      amount1Min: 0,
      recipient: signer.address,
      deadline: deadline
    }, { gasLimit: 1000000 });
    
    const receipt = await tx.wait();
    console.log("   ✓ Liquidity added! Tx:", receipt.transactionHash);
    
    // Check new liquidity
    console.log("\n5. Pool state after:");
    console.log("   Liquidity:", (await poolContract.liquidity()).toString());
    
  } catch (e: any) {
    console.log("   ✗ Failed:", e.reason || e.message?.slice(0, 200));
  }
}
main().catch(console.error);
