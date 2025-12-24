import { ethers } from "hardhat";

const POOL = "0xeCeBFb34875DA11ea6512BDa2b016EcEdb971Fb5";
const ORACLE = "0x86cD993209e58A9Db915BC5aD182E185a616aa17";

async function main() {
  console.log("=== Initialize sWBTC/MIM Pool ===\n");
  
  const poolABI = [
    "function initialize(uint160 sqrtPriceX96) external",
    "function slot0() view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)",
    "function token0() view returns (address)",
    "function token1() view returns (address)"
  ];
  const pool = await ethers.getContractAt(poolABI, POOL);
  
  // For BTC at $95,000:
  // sWBTC is token0 (8 decimals), MIM is token1 (18 decimals)
  // price = MIM_raw / sWBTC_raw = (95000 * 1e18) / (1e8) = 9.5e14
  // sqrt(9.5e14) = 30822070
  // sqrtPriceX96 = 30822070 * 2^96
  
  const sqrtPriceX96 = ethers.BigNumber.from("30822070").mul(
    ethers.BigNumber.from("79228162514264337593543950336")
  );
  
  console.log("sqrtPriceX96:", sqrtPriceX96.toString());
  
  // Initialize
  console.log("Initializing pool...");
  const tx = await pool.initialize(sqrtPriceX96);
  await tx.wait();
  console.log("Initialized!");
  
  // Verify
  const [sqrtPrice96, tick] = await pool.slot0();
  console.log("\nPool state:");
  console.log("  sqrtPriceX96:", sqrtPrice96.toString());
  console.log("  tick:", tick);
  
  // Expected tick for price 9.5e14:
  // tick = ln(9.5e14) / ln(1.0001) = 34.49 / 0.0000434 = 794,470
  // Hmm that seems high, let me check
  
  const priceFromTick = Math.pow(1.0001, tick);
  console.log("  price from tick:", priceFromTick);
  
  // Now check oracle
  const oracleABI = ["function getPrice() view returns (uint256)"];
  const oracle = await ethers.getContractAt(oracleABI, ORACLE);
  const oraclePrice = await oracle.getPrice();
  console.log("\nOracle price:", ethers.utils.formatUnits(oraclePrice, 18));
  
  // The raw price from pool is 9.5e14
  // Oracle returns this * 1e18 / some_factor
  // Let's see what we actually get
  
  // To interpret correctly:
  // Oracle returns "MIM per raw sWBTC" with 18 decimals
  // So oraclePrice / 1e18 = MIM per 1 raw sWBTC
  // 1 raw sWBTC = 1e-8 sWBTC
  // So MIM per 1 sWBTC = oraclePrice / 1e18 * 1e8 = oraclePrice / 1e10
  
  const mimPerSWBTC = parseFloat(ethers.utils.formatUnits(oraclePrice, 18)) * 1e8;
  console.log("MIM per 1 sWBTC:", mimPerSWBTC);
}

main().catch(console.error);
