import { ethers } from "hardhat";

const MIM_ADDRESS = "0x0462c2926DCb2e80891Bf31d28383C9b63bEcF8D";
const SUSDC_ADDRESS = "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B";
const V3_FACTORY = "0x3a1713B6C3734cfC883A3897647f3128Fe789f39";

async function main() {
  console.log("========================================");
  console.log("Fix MIM/sUSDC Pool V2 - Correct Price");
  console.log("========================================\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Token ordering: MIM (18 dec) < sUSDC (6 dec) by address
  // So token0 = MIM, token1 = sUSDC
  // price = token1/token0 = sUSDC/MIM (in wei terms)
  
  // For 1:1 dollar parity:
  // 1 MIM (= 1e18 wei) = 1 sUSDC (= 1e6 wei) in dollars
  // price = 1e6 / 1e18 = 1e-12
  
  // sqrtPriceX96 = sqrt(price) * 2^96
  // sqrt(1e-12) = 1e-6
  // 2^96 = 79228162514264337593543950336
  // sqrtPriceX96 = 1e-6 * 2^96 = 79228162514264337593.543950336
  
  // Use BigInt for precision
  const sqrtPriceX96 = ethers.BigNumber.from("79228162514264337593");
  
  console.log("Correct sqrtPriceX96:", sqrtPriceX96.toString());
  
  // Expected tick for this price: ln(1e-12) / ln(1.0001) ≈ -276324
  console.log("Expected tick: ~-276324 (for 1:1 dollar parity)");

  // Create pool with 0.3% fee (3000) - another unused fee tier
  const feeTier = 3000; // 0.3%
  
  console.log("\n1. Creating pool with", feeTier/10000*100, "% fee tier...");
  
  const factory = await ethers.getContractAt(
    [
      "function createPool(address tokenA, address tokenB, uint24 fee) external returns (address pool)",
      "function getPool(address,address,uint24) view returns (address)"
    ],
    V3_FACTORY
  );
  
  // Check if pool exists
  const existingPool = await factory.getPool(MIM_ADDRESS, SUSDC_ADDRESS, feeTier);
  if (existingPool !== ethers.constants.AddressZero) {
    console.log("Pool already exists:", existingPool);
    return;
  }
  
  const createTx = await factory.createPool(MIM_ADDRESS, SUSDC_ADDRESS, feeTier);
  await createTx.wait();
  
  // Get pool address from factory
  const newPoolAddress = await factory.getPool(MIM_ADDRESS, SUSDC_ADDRESS, feeTier);
  console.log("   Pool created:", newPoolAddress);
  
  // Initialize
  console.log("\n2. Initializing with correct 1:1 price...");
  const pool = await ethers.getContractAt(
    [
      "function initialize(uint160 sqrtPriceX96) external",
      "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
    ],
    newPoolAddress
  );
  
  const initTx = await pool.initialize(sqrtPriceX96);
  await initTx.wait();
  
  // Verify
  const slot0 = await pool.slot0();
  console.log("   sqrtPriceX96:", slot0.sqrtPriceX96.toString());
  console.log("   tick:", slot0.tick);
  
  // Update MIM contract
  console.log("\n3. Updating MIM contract...");
  const mim = await ethers.getContractAt("contracts/0IL/core/MIM.sol:MIM", MIM_ADDRESS);
  const setPoolTx = await mim.setPool(newPoolAddress);
  await setPoolTx.wait();
  console.log("   ✅ Done");
  
  console.log("\n========================================");
  console.log("SUCCESS!");
  console.log("========================================");
  console.log("\nNew MIM/sUSDC pool:", newPoolAddress);
  console.log("Fee tier: 0.3%");
  console.log("Tick:", slot0.tick, "(should be ~-276324)");
  
  console.log("\nUpdate frontend config.ts:");
  console.log(`  mimUsdcPool: "${newPoolAddress}",`);
}

main().catch(console.error);

