import { ethers } from "hardhat";

const UNISWAP_V3_FACTORY = "0x3a1713B6C3734cfC883A3897647f3128Fe789f39";
const MIM = "0x1590da8C11431eFe1cB42Acfd8A500A5bdb7B1A2";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";

const FACTORY_ABI = [
  "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
];

const POOL_ABI = [
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function liquidity() external view returns (uint128)"
];

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Checking pool prices...\n");

  const factory = new ethers.Contract(UNISWAP_V3_FACTORY, FACTORY_ABI, signer);

  // Check sorted order
  const sorted = MIM.toLowerCase() < SWETH.toLowerCase();
  console.log("Token sorting:");
  console.log("  MIM address:", MIM);
  console.log("  sWETH address:", SWETH);
  console.log("  MIM < sWETH:", sorted);
  console.log("  token0 (sorted):", sorted ? "MIM" : "sWETH");
  console.log("  token1 (sorted):", sorted ? "sWETH" : "MIM");
  console.log();

  const feeTiers = [100, 500, 3000, 10000]; // 0.01%, 0.05%, 0.3%, 1%
  
  for (const fee of feeTiers) {
    const poolAddress = await factory.getPool(MIM, SWETH, fee);
    console.log(`Fee tier ${fee/10000}%: ${poolAddress}`);
    
    if (poolAddress !== ethers.constants.AddressZero) {
      const pool = new ethers.Contract(poolAddress, POOL_ABI, signer);
      
      try {
        const slot0 = await pool.slot0();
        const token0 = await pool.token0();
        const token1 = await pool.token1();
        const liquidity = await pool.liquidity();
        
        const sqrtPriceX96 = slot0.sqrtPriceX96;
        const tick = slot0.tick;
        
        // Calculate price
        const Q96 = ethers.BigNumber.from(2).pow(96);
        const sqrtPriceNum = parseFloat(sqrtPriceX96.toString()) / parseFloat(Q96.toString());
        const rawPrice = sqrtPriceNum * sqrtPriceNum; // token1 per token0 in raw terms
        
        // MIM has 18 decimals, sWETH has 18 decimals
        // No decimal adjustment needed for same-decimal tokens
        const humanPrice = rawPrice; // token1 per token0
        
        console.log("  token0:", token0 === MIM ? "MIM" : "sWETH");
        console.log("  token1:", token1 === MIM ? "MIM" : "sWETH");
        console.log("  sqrtPriceX96:", sqrtPriceX96.toString());
        console.log("  tick:", tick);
        console.log("  liquidity:", liquidity.toString());
        console.log("  Raw price (token1/token0):", humanPrice);
        
        if (token0.toLowerCase() === MIM.toLowerCase()) {
          // token0 = MIM, token1 = sWETH
          // price = sWETH per MIM
          console.log("  Interpretation: sWETH per MIM =", humanPrice);
          console.log("  MIM per sWETH =", 1 / humanPrice);
        } else {
          // token0 = sWETH, token1 = MIM
          // price = MIM per sWETH
          console.log("  Interpretation: MIM per sWETH =", humanPrice);
          console.log("  sWETH per MIM =", 1 / humanPrice);
        }
      } catch (e: any) {
        console.log("  Error reading pool:", e.message);
      }
    }
    console.log();
  }
}

main().catch(console.error);


