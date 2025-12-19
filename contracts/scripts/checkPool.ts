import { ethers } from "hardhat";

async function main() {
  // Token addresses on Sonic
  const sUSDC = "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B";
  const sWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
  const sUSDT = "0x72dFC771E515423E5B0CD2acf703d0F7eb30bdEa";
  const factory = "0x3a1713B6C3734cfC883A3897647f3128Fe789f39";
  
  const factoryABI = [
    "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address)"
  ];
  const poolABI = [
    "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
    "function liquidity() external view returns (uint128)",
    "function token0() external view returns (address)",
    "function token1() external view returns (address)"
  ];
  
  const [signer] = await ethers.getSigners();
  const factoryContract = new ethers.Contract(factory, factoryABI, signer);
  
  const feeTiers = [100, 500, 3000, 10000];
  const pairs = [
    { name: "sUSDC/sWETH", token0: sUSDC, token1: sWETH },
    { name: "sUSDC/sUSDT", token0: sUSDC, token1: sUSDT },
  ];
  
  for (const pair of pairs) {
    console.log(`\n=== ${pair.name} ===`);
    for (const fee of feeTiers) {
      const poolAddress = await factoryContract.getPool(pair.token0, pair.token1, fee);
      if (poolAddress !== ethers.ZeroAddress) {
        const pool = new ethers.Contract(poolAddress, poolABI, signer);
        const [slot0, liquidity, token0, token1] = await Promise.all([
          pool.slot0(),
          pool.liquidity(),
          pool.token0(),
          pool.token1(),
        ]);
        
        const sqrtPriceX96 = slot0[0];
        const tick = Number(slot0[1]);
        
        // Calculate price from sqrtPriceX96
        const Q96 = BigInt(2) ** BigInt(96);
        const priceFloat = Number(sqrtPriceX96) ** 2 / (Number(Q96) ** 2);
        
        // Determine which token is token0/token1
        const t0IsUSDC = token0.toLowerCase() === sUSDC.toLowerCase();
        const t0IsWETH = token0.toLowerCase() === sWETH.toLowerCase();
        const t0IsUSDT = token0.toLowerCase() === sUSDT.toLowerCase();
        
        let priceDescription = "";
        if (pair.name === "sUSDC/sWETH") {
          if (t0IsUSDC) {
            priceDescription = `1 sUSDC = ${priceFloat.toExponential(4)} sWETH (should be ~0.000285 for ETH at $3500)`;
          } else {
            priceDescription = `1 sWETH = ${priceFloat.toFixed(2)} sUSDC (should be ~3500)`;
          }
        } else if (pair.name === "sUSDC/sUSDT") {
          priceDescription = `Price: ${priceFloat.toFixed(6)} (should be ~1.0 for stablecoins)`;
        }
        
        console.log(`  Fee: ${fee/10000}%`);
        console.log(`    Pool: ${poolAddress}`);
        console.log(`    Token0: ${token0} ${t0IsUSDC ? "(sUSDC)" : t0IsWETH ? "(sWETH)" : t0IsUSDT ? "(sUSDT)" : ""}`);
        console.log(`    Token1: ${token1}`);
        console.log(`    Tick: ${tick}`);
        console.log(`    Raw Price: ${priceFloat.toExponential(6)}`);
        console.log(`    ${priceDescription}`);
        console.log(`    Liquidity: ${liquidity.toString()}`);
      }
    }
  }
}

main().catch(console.error);


