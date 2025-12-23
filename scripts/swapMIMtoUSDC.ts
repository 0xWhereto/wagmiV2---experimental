import { ethers } from "hardhat";

const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const SUSDC = "0xd3DCe716f3eF535C5Ff8d041c1A41C3bd89b97aE";
const SWAP_ROUTER = "0x06e6AAfFF2bdf6A3180F1C01A0e06Ea8e4Adb33E"; // Uniswap V3 Router on Sonic
const POOL_01 = "0x..."; // MIM/sUSDC pool

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Swap MIM to sUSDC ===\n");
  
  const mim = new ethers.Contract(MIM, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)"
  ], signer);
  
  const susdc = new ethers.Contract(SUSDC, [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)"
  ], signer);
  
  const myMIM = await mim.balanceOf(signer.address);
  console.log("My MIM:", ethers.utils.formatEther(myMIM));
  console.log("My sUSDC before:", ethers.utils.formatUnits(await susdc.balanceOf(signer.address), 6));
  
  // Use V3 swap router
  const routerABI = [
    "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut)"
  ];
  const router = new ethers.Contract(SWAP_ROUTER, routerABI, signer);
  
  // Approve router
  console.log("\nApproving router...");
  await (await mim.approve(SWAP_ROUTER, myMIM)).wait();
  
  // Swap MIM to sUSDC (keeping 1 MIM for buffer)
  const swapAmount = myMIM.sub(ethers.utils.parseEther("1"));
  console.log("Swapping", ethers.utils.formatEther(swapAmount), "MIM...");
  
  try {
    const tx = await router.exactInputSingle({
      tokenIn: MIM,
      tokenOut: SUSDC,
      fee: 100, // 0.01% fee tier
      recipient: signer.address,
      amountIn: swapAmount,
      amountOutMinimum: 0, // No slippage protection for now
      sqrtPriceLimitX96: 0
    }, { gasLimit: 500000 });
    
    await tx.wait();
    console.log("✓ Swap succeeded!");
  } catch (err: any) {
    console.log("✗ Swap failed:", err.reason || err.message?.slice(0, 200));
    console.log("\nTrying Quoter to check liquidity...");
    
    // Check if pool exists
    const factory = new ethers.Contract("0xABCD...", [
      "function getPool(address,address,uint24) view returns (address)"
    ], signer);
    
    console.log("\n⚠️  No direct MIM/sUSDC swap available");
    console.log("   Will use MIM directly for new deployment seed liquidity");
  }
  
  console.log("\n=== Balances ===");
  console.log("MIM:", ethers.utils.formatEther(await mim.balanceOf(signer.address)));
  console.log("sUSDC:", ethers.utils.formatUnits(await susdc.balanceOf(signer.address), 6));
}
main().catch(console.error);
