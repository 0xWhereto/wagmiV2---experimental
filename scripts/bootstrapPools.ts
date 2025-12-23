/**
 * Bootstrap 0IL V4 Pools with Correct Liquidity
 * 
 * 1. MIM/sUSDC: Initialize at 1:1 parity
 * 2. sWETH/MIM: Initialize at ~3000 MIM per sWETH
 */

import { ethers } from "hardhat";

// V4 Deployed Contracts
const CONTRACTS = {
  mim: "0x5Ba71A159bE146aD4ef7f7b7f40d274d8f4E0440",
  sUSDC: "0x29219dd400f2Bf60E5a23d13Be72B486D4038894",
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  mimUsdcPool: "0xda31231d91a32D86a9C6F31B4ba43b9DA6D4E7E7",
  swethMimPool: "0xe9A9FB53E3D5C103C21a559C1482a56F3112AB20",
  positionManager: "0x5826e10B513C891910032F15292B2F1b3041C3Df",
};

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address, uint256) returns (bool)",
  "function decimals() view returns (uint8)",
];

const POOL_ABI = [
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function fee() view returns (uint24)",
  "function liquidity() view returns (uint128)",
];

const PM_ABI = [
  "function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
];

function nearestUsableTick(tick: number, tickSpacing: number): number {
  return Math.round(tick / tickSpacing) * tickSpacing;
}

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Bootstrapping pools with:", signer.address);

  // ============ 1. Check MIM/sUSDC Pool ============
  console.log("\n=== MIM/sUSDC Pool ===");
  
  const mimUsdcPool = new ethers.Contract(CONTRACTS.mimUsdcPool, POOL_ABI, signer);
  const slot0 = await mimUsdcPool.slot0();
  const liquidity = await mimUsdcPool.liquidity();
  const token0Usdc = await mimUsdcPool.token0();
  const token1Usdc = await mimUsdcPool.token1();
  const feeUsdc = await mimUsdcPool.fee();
  
  console.log("Token0:", token0Usdc);
  console.log("Token1:", token1Usdc);
  console.log("Fee:", feeUsdc);
  console.log("Current tick:", slot0.tick);
  console.log("Current liquidity:", liquidity.toString());
  
  // If no liquidity, add some
  if (liquidity.eq(0)) {
    console.log("\nNo liquidity - need to add initial liquidity");
    
    // We need sUSDC to add liquidity - check balance
    const sUSDC = new ethers.Contract(CONTRACTS.sUSDC, ERC20_ABI, signer);
    const mim = new ethers.Contract(CONTRACTS.mim, ERC20_ABI, signer);
    
    const usdcBalance = await sUSDC.balanceOf(signer.address);
    const mimBalance = await mim.balanceOf(signer.address);
    
    console.log("sUSDC balance:", ethers.utils.formatUnits(usdcBalance, 6));
    console.log("MIM balance:", ethers.utils.formatEther(mimBalance));
    
    if (usdcBalance.gt(0) && mimBalance.gt(0)) {
      // Add liquidity with min 1 USDC and 1 MIM
      const usdcAmount = ethers.utils.parseUnits("1", 6); // 1 USDC
      const mimAmount = ethers.utils.parseEther("1"); // 1 MIM
      
      // Approve
      await (await sUSDC.approve(CONTRACTS.positionManager, usdcAmount)).wait();
      await (await mim.approve(CONTRACTS.positionManager, mimAmount)).wait();
      console.log("Approved tokens");
      
      // For 1:1 peg, use full range around tick 0
      // MIM 18 decimals, sUSDC 6 decimals
      // If sUSDC is token0 (6 dec) and MIM is token1 (18 dec): price = MIM/sUSDC
      // We want 1 MIM = 1 sUSDC, so we need price = 1e18/1e6 = 1e12
      const tickSpacing = feeUsdc === 3000 ? 60 : 10;
      
      // For 18/6 decimal pair at 1:1 dollar parity:
      // tick ≈ -276325 (for sUSDC as token0)
      const tickLower = nearestUsableTick(-276900, tickSpacing);
      const tickUpper = nearestUsableTick(-275700, tickSpacing);
      
      console.log("Adding liquidity with tick range:", tickLower, "to", tickUpper);
      
      const pm = new ethers.Contract(CONTRACTS.positionManager, PM_ABI, signer);
      
      try {
        const tx = await pm.mint({
          token0: token0Usdc,
          token1: token1Usdc,
          fee: feeUsdc,
          tickLower: tickLower,
          tickUpper: tickUpper,
          amount0Desired: token0Usdc.toLowerCase() === CONTRACTS.sUSDC.toLowerCase() ? usdcAmount : mimAmount,
          amount1Desired: token0Usdc.toLowerCase() === CONTRACTS.sUSDC.toLowerCase() ? mimAmount : usdcAmount,
          amount0Min: 0,
          amount1Min: 0,
          recipient: signer.address,
          deadline: Math.floor(Date.now() / 1000) + 3600
        }, { gasLimit: 600000 });
        
        await tx.wait();
        console.log("MIM/sUSDC liquidity added!");
      } catch (e: any) {
        console.log("Error adding MIM/sUSDC liquidity:", e.message);
      }
    } else {
      console.log("Insufficient balance to add MIM/sUSDC liquidity");
      console.log("You need to mint MIM first using mintWithUSDC()");
    }
  }
  
  // ============ 2. Check sWETH/MIM Pool ============
  console.log("\n=== sWETH/MIM Pool ===");
  
  const swethMimPool = new ethers.Contract(CONTRACTS.swethMimPool, POOL_ABI, signer);
  const slot0Weth = await swethMimPool.slot0();
  const liquidityWeth = await swethMimPool.liquidity();
  const token0Weth = await swethMimPool.token0();
  const token1Weth = await swethMimPool.token1();
  const feeWeth = await swethMimPool.fee();
  
  console.log("Token0:", token0Weth);
  console.log("Token1:", token1Weth);
  console.log("Fee:", feeWeth);
  console.log("Current tick:", slot0Weth.tick);
  console.log("Current liquidity:", liquidityWeth.toString());
  
  // If no liquidity, add some
  if (liquidityWeth.eq(0)) {
    console.log("\nNo liquidity - need to add initial liquidity");
    
    const sWETH = new ethers.Contract(CONTRACTS.sWETH, ERC20_ABI, signer);
    const mim = new ethers.Contract(CONTRACTS.mim, ERC20_ABI, signer);
    
    const wethBalance = await sWETH.balanceOf(signer.address);
    const mimBalance = await mim.balanceOf(signer.address);
    
    console.log("sWETH balance:", ethers.utils.formatEther(wethBalance));
    console.log("MIM balance:", ethers.utils.formatEther(mimBalance));
    
    if (wethBalance.gt(0) && mimBalance.gt(0)) {
      // Use small amounts: 0.001 sWETH and 3 MIM (at ~3000 MIM/ETH)
      const wethAmount = ethers.utils.parseEther("0.001");
      const mimAmount = ethers.utils.parseEther("3");
      
      // Approve
      await (await sWETH.approve(CONTRACTS.positionManager, wethAmount)).wait();
      await (await mim.approve(CONTRACTS.positionManager, mimAmount)).wait();
      console.log("Approved tokens");
      
      // For 3000 MIM per sWETH
      // Both 18 decimals
      // If MIM is token0, price = sWETH/MIM = 1/3000 ≈ 0.000333
      // tick = ln(0.000333) / ln(1.0001) ≈ -80201
      // If sWETH is token0, price = MIM/sWETH = 3000
      // tick = ln(3000) / ln(1.0001) ≈ 80202
      
      const tickSpacing = feeWeth === 500 ? 10 : 60;
      
      // Check if MIM is token0
      const mimIsToken0 = token0Weth.toLowerCase() === CONTRACTS.mim.toLowerCase();
      
      // For price ~3000 MIM per sWETH
      let tickLower: number, tickUpper: number;
      if (mimIsToken0) {
        // MIM is token0, sWETH is token1
        // price = sWETH/MIM = 1/3000 ≈ 0.000333
        // tick ≈ -80201
        tickLower = nearestUsableTick(-82000, tickSpacing);
        tickUpper = nearestUsableTick(-78000, tickSpacing);
      } else {
        // sWETH is token0, MIM is token1
        // price = MIM/sWETH = 3000
        // tick ≈ 80202
        tickLower = nearestUsableTick(78000, tickSpacing);
        tickUpper = nearestUsableTick(82000, tickSpacing);
      }
      
      console.log("MIM is token0:", mimIsToken0);
      console.log("Adding liquidity with tick range:", tickLower, "to", tickUpper);
      
      const pm = new ethers.Contract(CONTRACTS.positionManager, PM_ABI, signer);
      
      try {
        const tx = await pm.mint({
          token0: token0Weth,
          token1: token1Weth,
          fee: feeWeth,
          tickLower: tickLower,
          tickUpper: tickUpper,
          amount0Desired: mimIsToken0 ? mimAmount : wethAmount,
          amount1Desired: mimIsToken0 ? wethAmount : mimAmount,
          amount0Min: 0,
          amount1Min: 0,
          recipient: signer.address,
          deadline: Math.floor(Date.now() / 1000) + 3600
        }, { gasLimit: 600000 });
        
        await tx.wait();
        console.log("sWETH/MIM liquidity added!");
      } catch (e: any) {
        console.log("Error adding sWETH/MIM liquidity:", e.message);
      }
    } else {
      console.log("Insufficient balance to add sWETH/MIM liquidity");
      console.log("You need sWETH and MIM tokens");
    }
  }
  
  console.log("\n=== Bootstrap Complete ===");
}

main().catch(console.error);

