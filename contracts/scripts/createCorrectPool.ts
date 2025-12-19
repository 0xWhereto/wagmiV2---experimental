import { ethers } from "hardhat";

/**
 * Create Uniswap V3 pools with CORRECT prices and add liquidity
 * 
 * For sUSDC/sWETH:
 *   - sWETH: 18 decimals
 *   - sUSDC: 6 decimals  
 *   - Target: 1 sWETH = $3370 sUSDC
 */

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Using deployer:", signer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(signer.address)), "S");

  // Contract addresses on Sonic
  const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";
  const FACTORY = "0x3a1713B6C3734cfC883A3897647f3128Fe789f39";
  
  // Token addresses
  const sWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125"; // 18 decimals
  const sUSDC = "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B"; // 6 decimals
  const sUSDT = "0x72dFC771E515423E5B0CD2acf703d0F7eb30bdEa"; // 6 decimals

  // Fee tier: 0.05% = 500
  const FEE_TIER = 500;
  const TICK_SPACING = 10; // For 0.05% fee tier

  // ABIs
  const positionManagerABI = [
    "function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96) external payable returns (address pool)",
    "function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)"
  ];
  const factoryABI = [
    "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address)"
  ];
  const erc20ABI = [
    "function balanceOf(address account) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function decimals() external view returns (uint8)",
    "function symbol() external view returns (string)"
  ];
  const poolABI = [
    "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
    "function liquidity() external view returns (uint128)"
  ];

  const positionManager = new ethers.Contract(POSITION_MANAGER, positionManagerABI, signer);
  const factory = new ethers.Contract(FACTORY, factoryABI, signer);
  const sWETHContract = new ethers.Contract(sWETH, erc20ABI, signer);
  const sUSDCContract = new ethers.Contract(sUSDC, erc20ABI, signer);
  const sUSDTContract = new ethers.Contract(sUSDT, erc20ABI, signer);

  // Get balances
  const sWETHBalance = await sWETHContract.balanceOf(signer.address);
  const sUSDCBalance = await sUSDCContract.balanceOf(signer.address);
  const sUSDTBalance = await sUSDTContract.balanceOf(signer.address);

  console.log("\n=== Token Balances ===");
  console.log("sWETH:", ethers.formatUnits(sWETHBalance, 18));
  console.log("sUSDC:", ethers.formatUnits(sUSDCBalance, 6));
  console.log("sUSDT:", ethers.formatUnits(sUSDTBalance, 6));

  /**
   * Calculate sqrtPriceX96 for a given price
   * sqrtPriceX96 = sqrt(price_in_base_units) * 2^96
   */
  function calculateSqrtPriceX96(
    priceToken1PerToken0: number,
    token0Decimals: number,
    token1Decimals: number
  ): bigint {
    // price in base units = displayPrice * 10^(token1Decimals - token0Decimals)
    const priceInBaseUnits = priceToken1PerToken0 * Math.pow(10, token1Decimals - token0Decimals);
    const sqrtPrice = Math.sqrt(priceInBaseUnits);
    const Q96 = BigInt(2) ** BigInt(96);
    return BigInt(Math.floor(sqrtPrice * Number(Q96)));
  }

  // Price to tick conversion
  function priceToTick(price: number): number {
    return Math.floor(Math.log(price) / Math.log(1.0001));
  }

  // Round tick to nearest valid tick
  function nearestUsableTick(tick: number, tickSpacing: number): number {
    return Math.round(tick / tickSpacing) * tickSpacing;
  }

  // Sort tokens by address (required by Uniswap V3)
  function sortTokens(tokenA: string, tokenB: string): [string, string, boolean] {
    const isALower = tokenA.toLowerCase() < tokenB.toLowerCase();
    return isALower ? [tokenA, tokenB, true] : [tokenB, tokenA, false];
  }

  // ==========================================
  // Create sWETH/sUSDC Pool (ETH price = $3370)
  // ==========================================
  async function createAndFundWethUsdcPool() {
    console.log("\n========================================");
    console.log("Creating sWETH/sUSDC Pool (0.05% fee)");
    console.log("========================================");

    const ETH_PRICE = 3370; // USD per ETH

    // Sort tokens
    const [token0, token1, isWethToken0] = sortTokens(sWETH, sUSDC);
    console.log(`Token0: ${token0} ${isWethToken0 ? "(sWETH)" : "(sUSDC)"}`);
    console.log(`Token1: ${token1} ${isWethToken0 ? "(sUSDC)" : "(sWETH)"}`);

    // Check if pool exists
    const existingPool = await factory.getPool(sWETH, sUSDC, FEE_TIER);
    console.log("Existing pool:", existingPool);

    let sqrtPriceX96: bigint;
    let poolCreated = false;

    if (existingPool === ethers.ZeroAddress) {
      // Calculate sqrtPriceX96
      // If sWETH is token0: price = sUSDC per sWETH = 3370
      // If sUSDC is token0: price = sWETH per sUSDC = 1/3370
      if (isWethToken0) {
        // token0 = sWETH (18 dec), token1 = sUSDC (6 dec)
        // price (token1/token0 in base units) = 3370 * 10^(6-18) = 3370 * 10^-12
        sqrtPriceX96 = calculateSqrtPriceX96(ETH_PRICE, 18, 6);
      } else {
        // token0 = sUSDC (6 dec), token1 = sWETH (18 dec)
        // price (token1/token0 in base units) = (1/3370) * 10^(18-6) = 10^12 / 3370
        sqrtPriceX96 = calculateSqrtPriceX96(1 / ETH_PRICE, 6, 18);
      }

      console.log(`sqrtPriceX96: ${sqrtPriceX96.toString()}`);

      // Create and initialize pool
      console.log("\nCreating pool...");
      const tx = await positionManager.createAndInitializePoolIfNecessary(
        token0,
        token1,
        FEE_TIER,
        sqrtPriceX96,
        { gasLimit: 5000000 }
      );
      console.log("Transaction:", tx.hash);
      await tx.wait();
      console.log("Pool created!");
      poolCreated = true;
    } else {
      console.log("Pool already exists, will add liquidity to existing pool");
    }

    // Get pool address
    const poolAddress = await factory.getPool(sWETH, sUSDC, FEE_TIER);
    console.log("Pool address:", poolAddress);

    if (poolAddress === ethers.ZeroAddress) {
      console.log("ERROR: Pool was not created!");
      return;
    }

    // Get current pool state
    const pool = new ethers.Contract(poolAddress, poolABI, signer);
    const slot0 = await pool.slot0();
    const currentTick = Number(slot0[1]);
    console.log("Current tick:", currentTick);

    // Calculate price range: ±20% of current price
    // For ETH at $3370: range would be ~$2696 to ~$4044
    const minPrice = ETH_PRICE * 0.8;
    const maxPrice = ETH_PRICE * 1.2;
    
    let tickLower: number, tickUpper: number;
    
    if (isWethToken0) {
      // price = sUSDC per sWETH
      // tick = log(price_in_base_units) / log(1.0001)
      // Lower price = lower tick, higher price = higher tick
      const priceMinBase = minPrice * Math.pow(10, 6 - 18);
      const priceMaxBase = maxPrice * Math.pow(10, 6 - 18);
      tickLower = nearestUsableTick(priceToTick(priceMinBase), TICK_SPACING);
      tickUpper = nearestUsableTick(priceToTick(priceMaxBase), TICK_SPACING);
    } else {
      // token0 = sUSDC, price = sWETH per sUSDC
      const priceMinBase = (1 / maxPrice) * Math.pow(10, 18 - 6); // Inverted
      const priceMaxBase = (1 / minPrice) * Math.pow(10, 18 - 6);
      tickLower = nearestUsableTick(priceToTick(priceMinBase), TICK_SPACING);
      tickUpper = nearestUsableTick(priceToTick(priceMaxBase), TICK_SPACING);
    }

    // Make sure tickLower < tickUpper
    if (tickLower > tickUpper) {
      [tickLower, tickUpper] = [tickUpper, tickLower];
    }

    console.log(`Price range: $${minPrice} - $${maxPrice}`);
    console.log(`Tick range: ${tickLower} to ${tickUpper}`);

    // Get balances and determine amounts
    const currentSWETH = await sWETHContract.balanceOf(signer.address);
    const currentSUSDC = await sUSDCContract.balanceOf(signer.address);
    
    console.log("\n=== Adding Liquidity ===");
    console.log("sWETH available:", ethers.formatUnits(currentSWETH, 18));
    console.log("sUSDC available:", ethers.formatUnits(currentSUSDC, 6));

    if (currentSWETH === 0n && currentSUSDC === 0n) {
      console.log("No tokens available to add liquidity!");
      return;
    }

    // Approve tokens
    console.log("\nApproving tokens...");
    
    const sWETHAllowance = await sWETHContract.allowance(signer.address, POSITION_MANAGER);
    if (sWETHAllowance < currentSWETH) {
      const approveTx1 = await sWETHContract.approve(POSITION_MANAGER, ethers.MaxUint256);
      await approveTx1.wait();
      console.log("sWETH approved");
    }
    
    const sUSDCAllowance = await sUSDCContract.allowance(signer.address, POSITION_MANAGER);
    if (sUSDCAllowance < currentSUSDC) {
      const approveTx2 = await sUSDCContract.approve(POSITION_MANAGER, ethers.MaxUint256);
      await approveTx2.wait();
      console.log("sUSDC approved");
    }

    // Prepare mint params
    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour

    // Determine amounts based on token order
    let amount0Desired: bigint, amount1Desired: bigint;
    if (isWethToken0) {
      amount0Desired = currentSWETH;
      amount1Desired = currentSUSDC;
    } else {
      amount0Desired = currentSUSDC;
      amount1Desired = currentSWETH;
    }

    console.log("\nMinting position...");
    console.log("amount0Desired:", amount0Desired.toString());
    console.log("amount1Desired:", amount1Desired.toString());
    console.log("tickLower:", tickLower);
    console.log("tickUpper:", tickUpper);

    try {
      const mintTx = await positionManager.mint(
        {
          token0: token0,
          token1: token1,
          fee: FEE_TIER,
          tickLower: tickLower,
          tickUpper: tickUpper,
          amount0Desired: amount0Desired,
          amount1Desired: amount1Desired,
          amount0Min: 0, // No slippage protection for simplicity
          amount1Min: 0,
          recipient: signer.address,
          deadline: deadline,
        },
        { gasLimit: 5000000 }
      );

      console.log("Mint transaction:", mintTx.hash);
      const receipt = await mintTx.wait();
      console.log("Liquidity added successfully!");

      // Check new balances
      const newSWETH = await sWETHContract.balanceOf(signer.address);
      const newSUSDC = await sUSDCContract.balanceOf(signer.address);
      console.log("\nNew balances:");
      console.log("sWETH:", ethers.formatUnits(newSWETH, 18));
      console.log("sUSDC:", ethers.formatUnits(newSUSDC, 6));
      console.log("sWETH used:", ethers.formatUnits(currentSWETH - newSWETH, 18));
      console.log("sUSDC used:", ethers.formatUnits(currentSUSDC - newSUSDC, 6));

    } catch (err: any) {
      console.error("Error minting position:", err.message);
      if (err.data) {
        console.error("Error data:", err.data);
      }
    }
  }

  // ==========================================
  // Create sUSDC/sUSDT Pool (Stablecoin 1:1)
  // ==========================================
  async function createAndFundStablecoinPool() {
    console.log("\n========================================");
    console.log("Creating sUSDC/sUSDT Pool (0.05% fee)");
    console.log("========================================");

    // Sort tokens
    const [token0, token1, isUsdcToken0] = sortTokens(sUSDC, sUSDT);
    console.log(`Token0: ${token0} ${isUsdcToken0 ? "(sUSDC)" : "(sUSDT)"}`);
    console.log(`Token1: ${token1} ${isUsdcToken0 ? "(sUSDT)" : "(sUSDC)"}`);

    // Check if pool exists
    const existingPool = await factory.getPool(sUSDC, sUSDT, FEE_TIER);
    console.log("Existing pool:", existingPool);

    if (existingPool === ethers.ZeroAddress) {
      // For stablecoins: price = 1.0, both have 6 decimals
      // sqrtPriceX96 = sqrt(1) * 2^96 = 2^96
      const sqrtPriceX96 = BigInt(2) ** BigInt(96);
      console.log(`sqrtPriceX96: ${sqrtPriceX96.toString()}`);

      console.log("\nCreating pool...");
      const tx = await positionManager.createAndInitializePoolIfNecessary(
        token0,
        token1,
        FEE_TIER,
        sqrtPriceX96,
        { gasLimit: 5000000 }
      );
      console.log("Transaction:", tx.hash);
      await tx.wait();
      console.log("Pool created!");
    } else {
      console.log("Pool already exists");
    }

    const poolAddress = await factory.getPool(sUSDC, sUSDT, FEE_TIER);
    console.log("Pool address:", poolAddress);
  }

  // Run
  await createAndFundWethUsdcPool();
  await createAndFundStablecoinPool();

  console.log("\n========================================");
  console.log("Done!");
  console.log("========================================");
  console.log("\nPools created with 0.05% fee tier.");
  console.log("Update the UI to prefer 0.05% (500) fee tier for swaps.");
}

main().catch(console.error);
