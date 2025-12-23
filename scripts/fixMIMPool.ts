import { ethers } from "hardhat";

const MIM_ADDRESS = "0x0462c2926DCb2e80891Bf31d28383C9b63bEcF8D";
const SUSDC_ADDRESS = "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B";
const V3_FACTORY = "0x3a1713B6C3734cfC883A3897647f3128Fe789f39";
const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";

// Fee tier: 0.05% (500) for stablecoins
const FEE_TIER = 500;

async function main() {
  console.log("========================================");
  console.log("Fix MIM/sUSDC Pool - Create New Pool with Correct Price");
  console.log("========================================\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Determine token ordering
  const token0 = MIM_ADDRESS.toLowerCase() < SUSDC_ADDRESS.toLowerCase() ? MIM_ADDRESS : SUSDC_ADDRESS;
  const token1 = MIM_ADDRESS.toLowerCase() < SUSDC_ADDRESS.toLowerCase() ? SUSDC_ADDRESS : MIM_ADDRESS;
  
  console.log("\nToken ordering:");
  console.log("  token0:", token0, token0 === MIM_ADDRESS ? "(MIM)" : "(sUSDC)");
  console.log("  token1:", token1, token1 === MIM_ADDRESS ? "(MIM)" : "(sUSDC)");

  // For a 1:1 price between MIM (18 dec) and sUSDC (6 dec):
  // price = token1/token0 = sUSDC/MIM
  // We want 1 MIM = 0.000001 sUSDC (due to decimal difference)
  // Actually: 1e18 MIM wei = 1e6 sUSDC wei for 1:1 dollar value
  // So price = 1e6 / 1e18 = 1e-12
  // sqrtPriceX96 = sqrt(1e-12) * 2^96 = 1e-6 * 2^96
  
  // sqrtPriceX96 = sqrt(price) * 2^96
  // For 1 MIM (18 dec) = 1 sUSDC (6 dec) in dollar terms:
  // price ratio = (1e6 sUSDC-wei) / (1e18 MIM-wei) = 1e-12
  // sqrtPrice = sqrt(1e-12) = 1e-6
  // sqrtPriceX96 = 1e-6 * 2^96 = 79228162514.264
  
  const sqrtPriceX96 = ethers.BigNumber.from("79228162514264"); // ~1e-6 * 2^96
  
  console.log("\nCalculated sqrtPriceX96:", sqrtPriceX96.toString());
  console.log("This represents ~1:1 price (1 MIM = $1 = 1 sUSDC in dollar terms)");

  // Check if a 0.05% pool already exists
  const factory = await ethers.getContractAt(
    ["function getPool(address,address,uint24) view returns (address)"],
    V3_FACTORY
  );
  
  const existingPool = await factory.getPool(MIM_ADDRESS, SUSDC_ADDRESS, FEE_TIER);
  console.log("\nExisting 0.05% pool:", existingPool);

  if (existingPool !== ethers.constants.AddressZero) {
    console.log("\n⚠️ Pool already exists. We need to use a different fee tier or fix the existing pool.");
    
    // Check if it's the broken one
    const pool = await ethers.getContractAt(
      "contracts/0IL/interfaces/IUniswapV3.sol:IUniswapV3Pool",
      existingPool
    );
    const slot0 = await pool.slot0();
    console.log("Current tick:", slot0.tick);
    
    if (slot0.tick < -1000 || slot0.tick > 1000) {
      console.log("\n❌ Pool is at wrong price (tick should be near 0 for 1:1)");
      console.log("\nOptions:");
      console.log("1. Swap to fix the price (expensive if tick is far off)");
      console.log("2. Create a new pool with different fee tier (0.01% = 100)");
      console.log("3. Redeploy MIM contract with proper pool initialization");
      
      // Let's try option 2: Create a 0.01% fee pool
      console.log("\n========================================");
      console.log("Creating NEW pool with 0.01% fee tier");
      console.log("========================================");
      
      const newFeeTier = 100; // 0.01%
      
      const factoryContract = await ethers.getContractAt(
        [
          "function createPool(address tokenA, address tokenB, uint24 fee) external returns (address pool)",
          "event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)"
        ],
        V3_FACTORY
      );
      
      // Create pool
      console.log("\n1. Creating pool...");
      const createTx = await factoryContract.createPool(MIM_ADDRESS, SUSDC_ADDRESS, newFeeTier);
      const receipt = await createTx.wait();
      
      // Get new pool address from event
      const poolCreatedEvent = receipt.events?.find((e: any) => e.event === 'PoolCreated');
      const newPoolAddress = poolCreatedEvent?.args?.pool;
      console.log("   New pool created:", newPoolAddress);
      
      // Initialize with correct price
      console.log("\n2. Initializing pool with 1:1 price...");
      const newPool = await ethers.getContractAt(
        [
          "function initialize(uint160 sqrtPriceX96) external",
          "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
        ],
        newPoolAddress
      );
      
      const initTx = await newPool.initialize(sqrtPriceX96);
      await initTx.wait();
      console.log("   ✅ Pool initialized");
      
      // Verify
      const newSlot0 = await newPool.slot0();
      console.log("   New tick:", newSlot0.tick);
      
      // Update MIM contract to use new pool
      console.log("\n3. Updating MIM contract to use new pool...");
      const mim = await ethers.getContractAt("contracts/0IL/core/MIM.sol:MIM", MIM_ADDRESS);
      const setPoolTx = await mim.setPool(newPoolAddress);
      await setPoolTx.wait();
      console.log("   ✅ MIM contract updated");
      
      // Verify
      const currentPool = await mim.mimUsdcPool();
      console.log("   Current pool in MIM contract:", currentPool);
      
      console.log("\n========================================");
      console.log("POOL FIX COMPLETE");
      console.log("========================================");
      console.log("\nNew pool address:", newPoolAddress);
      console.log("Fee tier: 0.01% (100)");
      console.log("\nUpdate frontend config.ts:");
      console.log(`  mimUsdcPool: "${newPoolAddress}",`);
    }
  } else {
    console.log("\nNo existing pool found. Creating new pool...");
    // Create and initialize new pool
    // ... (same code as above)
  }
}

main().catch(console.error);

