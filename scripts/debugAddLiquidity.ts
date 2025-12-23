import { ethers } from "hardhat";

const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";
const MIM = "0x1590da8C11431eFe1cB42Acfd8A500A5bdb7B1A2";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";

const POOL_ABI = [
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)"
];

const FACTORY_ABI = [
  "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
];

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("Analyzing add liquidity requirements...\n");
  
  // Get the 0.05% pool
  const factory = new ethers.Contract("0x3a1713B6C3734cfC883A3897647f3128Fe789f39", FACTORY_ABI, signer);
  const poolAddress = await factory.getPool(MIM, SWETH, 500);
  console.log("0.05% Pool address:", poolAddress);
  
  const pool = new ethers.Contract(poolAddress, POOL_ABI, signer);
  const slot0 = await pool.slot0();
  const token0 = await pool.token0();
  const token1 = await pool.token1();
  
  console.log("token0:", token0 === MIM ? "MIM" : "sWETH");
  console.log("token1:", token1 === MIM ? "MIM" : "sWETH");
  
  const currentTick = slot0.tick;
  console.log("Current tick:", currentTick);
  
  // Calculate current price
  const sqrtPriceX96 = slot0.sqrtPriceX96;
  const Q96 = ethers.BigNumber.from(2).pow(96);
  const sqrtPriceNum = parseFloat(sqrtPriceX96.toString()) / parseFloat(Q96.toString());
  const rawPrice = sqrtPriceNum * sqrtPriceNum;
  
  console.log("sqrtPriceX96:", sqrtPriceX96.toString());
  console.log("Raw price (token1/token0 = sWETH/MIM):", rawPrice);
  console.log("Inverted (MIM/sWETH):", 1/rawPrice);
  
  // For single-sided sWETH position:
  // Current price must be BELOW the tick range
  // This means: tickLower > currentTick AND tickUpper > currentTick
  
  console.log("\n--- For SINGLE-SIDED sWETH position ---");
  console.log("Current tick:", currentTick);
  console.log("For single-sided sWETH: tickLower and tickUpper must be > currentTick");
  
  // Calculate what tick corresponds to different prices
  // tick = log(price) / log(1.0001)
  // For MIM per sWETH = 4000: that's sWETH/MIM = 0.00025
  // tick = log(0.00025) / log(1.0001) = -82893
  
  const priceToTick = (price: number) => {
    return Math.floor(Math.log(price) / Math.log(1.0001));
  };
  
  console.log("\nPrice (sWETH/MIM) to tick mapping:");
  console.log("  0.00025 (4000 MIM/sWETH) -> tick:", priceToTick(0.00025));
  console.log("  0.00033 (3040 MIM/sWETH) -> tick:", priceToTick(0.00033));
  console.log("  0.00050 (2000 MIM/sWETH) -> tick:", priceToTick(0.0005));
  
  console.log("\nFor single-sided sWETH, you need a price range ABOVE current price.");
  console.log("Example: If current is 3040 MIM/sWETH, use range like 3500-5000 MIM/sWETH");
  console.log("In sWETH/MIM terms: 0.000286 to 0.0002 (lower than current 0.000329)");
  console.log("These ticks would be:", priceToTick(0.000286), "to", priceToTick(0.0002));
  console.log("Both should be > currentTick", currentTick, "? NO - they are more negative!");
  
  console.log("\n--- WAIT, the tick direction is confusing ---");
  console.log("Let's think about it differently:");
  console.log("- token0 = MIM, token1 = sWETH");
  console.log("- Pool stores price as token1/token0 = sWETH/MIM");
  console.log("- Current price: 0.000329 sWETH per MIM");
  console.log("- This means 1 MIM = 0.000329 sWETH, or 1 sWETH = 3040 MIM");
  
  console.log("\nFor single-sided sWETH (want to deposit only sWETH):");
  console.log("- We need current price to be BELOW our range");
  console.log("- In Uniswap V3 terms: if you want only token1 (sWETH), current tick must be < tickLower");
  console.log("- So we need tickLower > currentTick =", currentTick);
  
  // For tickLower > -80201, we need higher ticks
  // Higher tick = higher price (sWETH/MIM) = lower MIM/sWETH price
  // So if current is tick -80201 (3040 MIM/sWETH), we need lower MIM/sWETH prices
  // E.g., 2000 MIM/sWETH = 0.0005 sWETH/MIM = tick -75894
  // -75894 > -80201? YES!
  
  console.log("\nExample for single-sided sWETH:");
  console.log("  Price range: 1500-2500 MIM/sWETH");
  console.log("  In sWETH/MIM: 0.000667 to 0.0004");
  console.log("  Ticks:", priceToTick(0.0004), "to", priceToTick(0.000667));
  console.log("  Are these > currentTick", currentTick, "?");
  console.log("  ", priceToTick(0.0004), "> -80201?", priceToTick(0.0004) > -80201);
  console.log("  ", priceToTick(0.000667), "> -80201?", priceToTick(0.000667) > -80201);
  
  console.log("\n--- User's position from UI ---");
  console.log("UI shows: Min 0.0002, Max 0.0005 MIM per sWETH");
  console.log("This means: 1 sWETH = 0.0002 to 0.0005 MIM");
  console.log("That's wrong - should be 2000-5000 MIM per sWETH for a reasonable range");
  console.log("The UI price is inverted in the display!");
}

main().catch(console.error);

