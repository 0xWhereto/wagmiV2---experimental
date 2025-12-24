// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title V3LPVault - FIXED VERSION
 * @notice Multi-layer Uniswap V3 position manager with Curve-style liquidity distribution
 * @dev FIXES APPLIED:
 *   - BUG-002: Fixed _getPositionAmounts() to properly calculate token amounts
 *   - Added proper tick-based amount calculation using Uniswap V3 math
 *   - Improved position value tracking
 */
contract V3LPVaultFixed is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Structs ============

    struct LiquidityLayer {
        int24 tickLower;
        int24 tickUpper;
        uint256 weight;      // Weight in basis points (total should be 10000)
        uint256 tokenId;     // V3 NFT position ID (0 if not created)
        uint128 liquidity;   // Current liquidity in this layer
    }

    struct PositionInfo {
        uint256 token0Amount;
        uint256 token1Amount;
        uint256 fee0Owed;
        uint256 fee1Owed;
    }

    // ============ Constants ============

    uint256 public constant BASIS_POINTS = 10000;
    int24 public constant TICK_SPACING = 60; // For 0.3% fee tier

    // Q96 for fixed-point math
    uint256 internal constant Q96 = 0x1000000000000000000000000;

    // ============ State Variables ============

    /// @notice Uniswap V3 Position Manager
    INonfungiblePositionManager public immutable positionManager;

    /// @notice Uniswap V3 Pool
    IUniswapV3Pool public immutable pool;

    /// @notice Token0 of the pool
    address public immutable token0;

    /// @notice Token1 of the pool
    address public immutable token1;

    /// @notice Pool fee tier
    uint24 public immutable fee;

    /// @notice Liquidity layers configuration
    LiquidityLayer[] public layers;

    /// @notice Authorized operators (LeverageAMM)
    mapping(address => bool) public isOperator;

    /// @notice Total value locked in token0 terms
    uint256 public totalToken0;

    /// @notice Total value locked in token1 terms
    uint256 public totalToken1;

    // ============ Events ============

    event LayersConfigured(uint256 numLayers);
    event LiquidityAdded(uint256 token0Amount, uint256 token1Amount, uint128 liquidityAdded);
    event LiquidityRemoved(uint256 token0Amount, uint256 token1Amount, uint128 liquidityRemoved);
    event FeesCollected(uint256 fee0, uint256 fee1);
    event Rebalanced(int24 newCenterTick);
    event OperatorSet(address indexed operator, bool authorized);

    // ============ Errors ============

    error NotOperator();
    error InvalidLayers();
    error NoLiquidity();
    error SlippageExceeded();

    // ============ Constructor ============

    constructor(
        address _positionManager,
        address _pool
    ) Ownable(msg.sender) {
        positionManager = INonfungiblePositionManager(_positionManager);
        pool = IUniswapV3Pool(_pool);
        token0 = pool.token0();
        token1 = pool.token1();
        fee = pool.fee();

        // Approve position manager to spend tokens
        IERC20(token0).approve(_positionManager, type(uint256).max);
        IERC20(token1).approve(_positionManager, type(uint256).max);
    }

    // ============ Admin Functions ============

    /**
     * @notice Set operator authorization
     * @param operator Address to authorize
     * @param authorized Whether to authorize
     */
    function setOperator(address operator, bool authorized) external onlyOwner {
        isOperator[operator] = authorized;
        emit OperatorSet(operator, authorized);
    }

    /**
     * @notice Configure liquidity layers (Curve-style distribution)
     * @param tickRanges Array of tick ranges from center (in tick spacing units)
     * @param weights Array of weights (must sum to 10000)
     */
    function configureLayers(
        int24[] calldata tickRanges,
        uint256[] calldata weights
    ) external onlyOwner {
        require(tickRanges.length == weights.length, "Length mismatch");

        uint256 totalWeight = 0;
        for (uint256 i = 0; i < weights.length; i++) {
            totalWeight += weights[i];
        }
        require(totalWeight == BASIS_POINTS, "Weights must sum to 10000");

        // Clear existing layers
        delete layers;

        // Get current tick
        (, int24 currentTick,,,,,) = pool.slot0();
        int24 centerTick = (currentTick / TICK_SPACING) * TICK_SPACING;

        // Create new layers
        for (uint256 i = 0; i < tickRanges.length; i++) {
            int24 tickRange = tickRanges[i] * TICK_SPACING;

            layers.push(LiquidityLayer({
                tickLower: centerTick - tickRange,
                tickUpper: centerTick + tickRange,
                weight: weights[i],
                tokenId: 0,
                liquidity: 0
            }));
        }

        emit LayersConfigured(tickRanges.length);
    }

    /**
     * @notice Set default Curve-style layers
     * @dev Creates 4 layers: ±0.5%, ±1%, ±2%, ±5%
     */
    function setDefaultLayers() external onlyOwner {
        delete layers;

        (, int24 currentTick,,,,,) = pool.slot0();
        int24 centerTick = (currentTick / TICK_SPACING) * TICK_SPACING;

        // Layer 1: ±0.5% (10 ticks for 0.3% fee tier) - 40% weight
        layers.push(LiquidityLayer({
            tickLower: centerTick - 10 * TICK_SPACING,
            tickUpper: centerTick + 10 * TICK_SPACING,
            weight: 4000,
            tokenId: 0,
            liquidity: 0
        }));

        // Layer 2: ±1% (20 ticks) - 30% weight
        layers.push(LiquidityLayer({
            tickLower: centerTick - 20 * TICK_SPACING,
            tickUpper: centerTick + 20 * TICK_SPACING,
            weight: 3000,
            tokenId: 0,
            liquidity: 0
        }));

        // Layer 3: ±2% (40 ticks) - 20% weight
        layers.push(LiquidityLayer({
            tickLower: centerTick - 40 * TICK_SPACING,
            tickUpper: centerTick + 40 * TICK_SPACING,
            weight: 2000,
            tokenId: 0,
            liquidity: 0
        }));

        // Layer 4: ±5% (100 ticks) - 10% weight (catch-all)
        layers.push(LiquidityLayer({
            tickLower: centerTick - 100 * TICK_SPACING,
            tickUpper: centerTick + 100 * TICK_SPACING,
            weight: 1000,
            tokenId: 0,
            liquidity: 0
        }));

        emit LayersConfigured(4);
    }

    // ============ View Functions ============

    /**
     * @notice Get total assets in both tokens
     * @return amount0 Total token0 in all positions
     * @return amount1 Total token1 in all positions
     */
    function getTotalAssets() external view returns (uint256 amount0, uint256 amount1) {
        for (uint256 i = 0; i < layers.length; i++) {
            if (layers[i].tokenId > 0) {
                (uint256 a0, uint256 a1) = _getPositionAmounts(layers[i].tokenId);
                amount0 += a0;
                amount1 += a1;
            }
        }

        // Add any tokens held in contract
        amount0 += IERC20(token0).balanceOf(address(this));
        amount1 += IERC20(token1).balanceOf(address(this));
    }

    /**
     * @notice Get pending fees
     * @return fee0 Pending token0 fees
     * @return fee1 Pending token1 fees
     */
    function getPendingFees() external view returns (uint256 fee0, uint256 fee1) {
        for (uint256 i = 0; i < layers.length; i++) {
            if (layers[i].tokenId > 0) {
                (uint256 f0, uint256 f1) = _getPendingFees(layers[i].tokenId);
                fee0 += f0;
                fee1 += f1;
            }
        }
    }

    /**
     * @notice Get number of layers
     */
    function getLayerCount() external view returns (uint256) {
        return layers.length;
    }

    /**
     * @notice Get layer info
     * @param index Layer index
     */
    function getLayer(uint256 index) external view returns (LiquidityLayer memory) {
        return layers[index];
    }

    /**
     * @notice Get detailed position info for a layer
     * @param index Layer index
     */
    function getLayerPosition(uint256 index) external view returns (PositionInfo memory info) {
        if (layers[index].tokenId > 0) {
            (info.token0Amount, info.token1Amount) = _getPositionAmounts(layers[index].tokenId);
            (info.fee0Owed, info.fee1Owed) = _getPendingFees(layers[index].tokenId);
        }
    }

    // ============ Operator Functions ============

    /**
     * @notice Add liquidity across all layers
     * @param amount0Desired Amount of token0 to add
     * @param amount1Desired Amount of token1 to add
     * @param amount0Min Minimum token0 to add (slippage)
     * @param amount1Min Minimum token1 to add (slippage)
     * @return liquidity Total liquidity added
     */
    function addLiquidity(
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min
    ) external nonReentrant returns (uint128 liquidity) {
        if (!isOperator[msg.sender] && msg.sender != owner()) revert NotOperator();
        if (layers.length == 0) revert InvalidLayers();

        // Transfer tokens from caller
        IERC20(token0).safeTransferFrom(msg.sender, address(this), amount0Desired);
        IERC20(token1).safeTransferFrom(msg.sender, address(this), amount1Desired);

        uint256 totalAmount0Used = 0;
        uint256 totalAmount1Used = 0;

        // Distribute liquidity across layers according to weights
        for (uint256 i = 0; i < layers.length; i++) {
            uint256 layerAmount0 = (amount0Desired * layers[i].weight) / BASIS_POINTS;
            uint256 layerAmount1 = (amount1Desired * layers[i].weight) / BASIS_POINTS;

            if (layerAmount0 == 0 && layerAmount1 == 0) continue;

            uint128 layerLiquidity;
            uint256 used0;
            uint256 used1;

            if (layers[i].tokenId == 0) {
                // Create new position
                (layers[i].tokenId, layerLiquidity, used0, used1) = _mintPosition(
                    layers[i].tickLower,
                    layers[i].tickUpper,
                    layerAmount0,
                    layerAmount1
                );
            } else {
                // Add to existing position
                (layerLiquidity, used0, used1) = _increaseLiquidity(
                    layers[i].tokenId,
                    layerAmount0,
                    layerAmount1
                );
            }

            layers[i].liquidity += layerLiquidity;
            liquidity += layerLiquidity;
            totalAmount0Used += used0;
            totalAmount1Used += used1;
        }

        // Check slippage
        if (totalAmount0Used < amount0Min || totalAmount1Used < amount1Min) {
            revert SlippageExceeded();
        }

        totalToken0 += totalAmount0Used;
        totalToken1 += totalAmount1Used;

        emit LiquidityAdded(totalAmount0Used, totalAmount1Used, liquidity);
    }

    /**
     * @notice Remove liquidity from all layers
     * @param liquidityPercent Percentage of liquidity to remove (10000 = 100%)
     * @param amount0Min Minimum token0 to receive
     * @param amount1Min Minimum token1 to receive
     * @return amount0 Token0 received
     * @return amount1 Token1 received
     */
    function removeLiquidity(
        uint256 liquidityPercent,
        uint256 amount0Min,
        uint256 amount1Min
    ) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        if (!isOperator[msg.sender] && msg.sender != owner()) revert NotOperator();
        require(liquidityPercent <= BASIS_POINTS, "Invalid percent");

        uint128 totalLiquidityRemoved = 0;

        for (uint256 i = 0; i < layers.length; i++) {
            if (layers[i].tokenId == 0 || layers[i].liquidity == 0) continue;

            uint128 liquidityToRemove = uint128(
                (uint256(layers[i].liquidity) * liquidityPercent) / BASIS_POINTS
            );

            if (liquidityToRemove == 0) continue;

            (uint256 a0, uint256 a1) = _decreaseLiquidity(
                layers[i].tokenId,
                liquidityToRemove
            );

            layers[i].liquidity -= liquidityToRemove;
            totalLiquidityRemoved += liquidityToRemove;
            amount0 += a0;
            amount1 += a1;
        }

        if (amount0 < amount0Min || amount1 < amount1Min) {
            revert SlippageExceeded();
        }

        // Transfer tokens to caller
        if (amount0 > 0) {
            IERC20(token0).safeTransfer(msg.sender, amount0);
        }
        if (amount1 > 0) {
            IERC20(token1).safeTransfer(msg.sender, amount1);
        }

        totalToken0 = totalToken0 > amount0 ? totalToken0 - amount0 : 0;
        totalToken1 = totalToken1 > amount1 ? totalToken1 - amount1 : 0;

        emit LiquidityRemoved(amount0, amount1, totalLiquidityRemoved);
    }

    /**
     * @notice Collect fees from all positions
     * @return fee0 Total token0 fees collected
     * @return fee1 Total token1 fees collected
     */
    function collectFees() external nonReentrant returns (uint256 fee0, uint256 fee1) {
        if (!isOperator[msg.sender] && msg.sender != owner()) revert NotOperator();

        for (uint256 i = 0; i < layers.length; i++) {
            if (layers[i].tokenId == 0) continue;

            (uint256 f0, uint256 f1) = _collectFees(layers[i].tokenId);
            fee0 += f0;
            fee1 += f1;
        }

        // Transfer fees to caller
        if (fee0 > 0) {
            IERC20(token0).safeTransfer(msg.sender, fee0);
        }
        if (fee1 > 0) {
            IERC20(token1).safeTransfer(msg.sender, fee1);
        }

        emit FeesCollected(fee0, fee1);
    }

    /**
     * @notice Rebalance positions around new center tick
     * @dev Removes all liquidity and re-adds at new tick ranges
     */
    function rebalance() external nonReentrant {
        if (!isOperator[msg.sender] && msg.sender != owner()) revert NotOperator();

        // Get current tick
        (, int24 currentTick,,,,,) = pool.slot0();
        int24 centerTick = (currentTick / TICK_SPACING) * TICK_SPACING;

        // Collect all fees and remove all liquidity
        uint256 totalAmount0 = 0;
        uint256 totalAmount1 = 0;

        for (uint256 i = 0; i < layers.length; i++) {
            if (layers[i].tokenId == 0 || layers[i].liquidity == 0) continue;

            // Collect fees
            (uint256 f0, uint256 f1) = _collectFees(layers[i].tokenId);
            totalAmount0 += f0;
            totalAmount1 += f1;

            // Remove liquidity
            (uint256 a0, uint256 a1) = _decreaseLiquidity(
                layers[i].tokenId,
                layers[i].liquidity
            );
            totalAmount0 += a0;
            totalAmount1 += a1;

            // Burn the NFT
            positionManager.burn(layers[i].tokenId);
            layers[i].tokenId = 0;
            layers[i].liquidity = 0;
        }

        // Update tick ranges for all layers
        int24[] memory tickRanges = new int24[](layers.length);
        if (layers.length > 0) tickRanges[0] = 10;  // ±0.5%
        if (layers.length > 1) tickRanges[1] = 20;  // ±1%
        if (layers.length > 2) tickRanges[2] = 40;  // ±2%
        if (layers.length > 3) tickRanges[3] = 100; // ±5%

        for (uint256 i = 0; i < layers.length; i++) {
            int24 tickRange = tickRanges[i] * TICK_SPACING;
            layers[i].tickLower = centerTick - tickRange;
            layers[i].tickUpper = centerTick + tickRange;
        }

        // Re-add liquidity
        for (uint256 i = 0; i < layers.length; i++) {
            uint256 layerAmount0 = (totalAmount0 * layers[i].weight) / BASIS_POINTS;
            uint256 layerAmount1 = (totalAmount1 * layers[i].weight) / BASIS_POINTS;

            if (layerAmount0 == 0 && layerAmount1 == 0) continue;

            (layers[i].tokenId, layers[i].liquidity,,) = _mintPosition(
                layers[i].tickLower,
                layers[i].tickUpper,
                layerAmount0,
                layerAmount1
            );
        }

        emit Rebalanced(centerTick);
    }

    // ============ Internal Functions ============

    function _mintPosition(
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0,
        uint256 amount1
    ) internal returns (uint256 tokenId, uint128 liquidity, uint256 used0, uint256 used1) {
        INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager.MintParams({
            token0: token0,
            token1: token1,
            fee: fee,
            tickLower: tickLower,
            tickUpper: tickUpper,
            amount0Desired: amount0,
            amount1Desired: amount1,
            amount0Min: 0,
            amount1Min: 0,
            recipient: address(this),
            deadline: block.timestamp
        });

        (tokenId, liquidity, used0, used1) = positionManager.mint(params);
    }

    function _increaseLiquidity(
        uint256 tokenId,
        uint256 amount0,
        uint256 amount1
    ) internal returns (uint128 liquidity, uint256 used0, uint256 used1) {
        INonfungiblePositionManager.IncreaseLiquidityParams memory params =
            INonfungiblePositionManager.IncreaseLiquidityParams({
                tokenId: tokenId,
                amount0Desired: amount0,
                amount1Desired: amount1,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            });

        (liquidity, used0, used1) = positionManager.increaseLiquidity(params);
    }

    function _decreaseLiquidity(
        uint256 tokenId,
        uint128 liquidity
    ) internal returns (uint256 amount0, uint256 amount1) {
        INonfungiblePositionManager.DecreaseLiquidityParams memory params =
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId,
                liquidity: liquidity,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            });

        (amount0, amount1) = positionManager.decreaseLiquidity(params);

        // Collect the tokens
        INonfungiblePositionManager.CollectParams memory collectParams =
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            });

        positionManager.collect(collectParams);
    }

    function _collectFees(uint256 tokenId) internal returns (uint256 fee0, uint256 fee1) {
        INonfungiblePositionManager.CollectParams memory params =
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            });

        (fee0, fee1) = positionManager.collect(params);
    }

    /**
     * @notice Get position amounts - FIXED VERSION
     * @dev Uses proper Uniswap V3 math to calculate token amounts from liquidity
     * @param tokenId The NFT position ID
     * @return amount0 Token0 amount in position
     * @return amount1 Token1 amount in position
     */
    function _getPositionAmounts(uint256 tokenId) internal view returns (uint256 amount0, uint256 amount1) {
        // Get position data
        (
            ,
            ,
            ,
            ,
            ,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            ,
            ,
            ,
        ) = positionManager.positions(tokenId);

        if (liquidity == 0) {
            return (0, 0);
        }

        // Get current price from pool
        (uint160 sqrtPriceX96, int24 currentTick,,,,,) = pool.slot0();

        // Calculate sqrtPrice at tick boundaries
        uint160 sqrtPriceLowerX96 = _getSqrtRatioAtTick(tickLower);
        uint160 sqrtPriceUpperX96 = _getSqrtRatioAtTick(tickUpper);

        // Calculate amounts based on current tick position
        if (currentTick < tickLower) {
            // Current price is below range - all token0
            amount0 = _getAmount0ForLiquidity(
                sqrtPriceLowerX96,
                sqrtPriceUpperX96,
                liquidity
            );
            amount1 = 0;
        } else if (currentTick >= tickUpper) {
            // Current price is above range - all token1
            amount0 = 0;
            amount1 = _getAmount1ForLiquidity(
                sqrtPriceLowerX96,
                sqrtPriceUpperX96,
                liquidity
            );
        } else {
            // Current price is within range - mix of both tokens
            amount0 = _getAmount0ForLiquidity(
                sqrtPriceX96,
                sqrtPriceUpperX96,
                liquidity
            );
            amount1 = _getAmount1ForLiquidity(
                sqrtPriceLowerX96,
                sqrtPriceX96,
                liquidity
            );
        }
    }

    /**
     * @notice Calculate sqrtPrice at a given tick
     * @dev Uses the formula: sqrtPrice = sqrt(1.0001^tick) * 2^96
     */
    function _getSqrtRatioAtTick(int24 tick) internal pure returns (uint160 sqrtPriceX96) {
        uint256 absTick = tick < 0 ? uint256(-int256(tick)) : uint256(int256(tick));
        require(absTick <= uint256(int256(887272)), "T");

        uint256 ratio = absTick & 0x1 != 0 ? 0xfffcb933bd6fad37aa2d162d1a594001 : 0x100000000000000000000000000000000;
        if (absTick & 0x2 != 0) ratio = (ratio * 0xfff97272373d413259a46990580e213a) >> 128;
        if (absTick & 0x4 != 0) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdcc) >> 128;
        if (absTick & 0x8 != 0) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0) >> 128;
        if (absTick & 0x10 != 0) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644) >> 128;
        if (absTick & 0x20 != 0) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0) >> 128;
        if (absTick & 0x40 != 0) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861) >> 128;
        if (absTick & 0x80 != 0) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053) >> 128;
        if (absTick & 0x100 != 0) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4) >> 128;
        if (absTick & 0x200 != 0) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54) >> 128;
        if (absTick & 0x400 != 0) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3) >> 128;
        if (absTick & 0x800 != 0) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9) >> 128;
        if (absTick & 0x1000 != 0) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825) >> 128;
        if (absTick & 0x2000 != 0) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5) >> 128;
        if (absTick & 0x4000 != 0) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7) >> 128;
        if (absTick & 0x8000 != 0) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6) >> 128;
        if (absTick & 0x10000 != 0) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9) >> 128;
        if (absTick & 0x20000 != 0) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604) >> 128;
        if (absTick & 0x40000 != 0) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98) >> 128;
        if (absTick & 0x80000 != 0) ratio = (ratio * 0x48a170391f7dc42444e8fa2) >> 128;

        if (tick > 0) ratio = type(uint256).max / ratio;

        sqrtPriceX96 = uint160((ratio >> 32) + (ratio % (1 << 32) == 0 ? 0 : 1));
    }

    /**
     * @notice Calculate amount0 for a given liquidity amount
     * @dev Uses the formula: amount0 = L * (sqrtB - sqrtA) / (sqrtA * sqrtB)
     */
    function _getAmount0ForLiquidity(
        uint160 sqrtRatioAX96,
        uint160 sqrtRatioBX96,
        uint128 liquidity
    ) internal pure returns (uint256 amount0) {
        if (sqrtRatioAX96 > sqrtRatioBX96) {
            (sqrtRatioAX96, sqrtRatioBX96) = (sqrtRatioBX96, sqrtRatioAX96);
        }

        return _mulDiv(
            uint256(liquidity) << 96,
            sqrtRatioBX96 - sqrtRatioAX96,
            sqrtRatioBX96
        ) / sqrtRatioAX96;
    }

    /**
     * @notice Calculate amount1 for a given liquidity amount
     * @dev Uses the formula: amount1 = L * (sqrtB - sqrtA)
     */
    function _getAmount1ForLiquidity(
        uint160 sqrtRatioAX96,
        uint160 sqrtRatioBX96,
        uint128 liquidity
    ) internal pure returns (uint256 amount1) {
        if (sqrtRatioAX96 > sqrtRatioBX96) {
            (sqrtRatioAX96, sqrtRatioBX96) = (sqrtRatioBX96, sqrtRatioAX96);
        }

        return _mulDiv(
            liquidity,
            sqrtRatioBX96 - sqrtRatioAX96,
            Q96
        );
    }

    /**
     * @notice Full precision multiplication then division
     */
    function _mulDiv(
        uint256 a,
        uint256 b,
        uint256 denominator
    ) internal pure returns (uint256 result) {
        // 512-bit multiply [prod1 prod0] = a * b
        uint256 prod0; // Least significant 256 bits of the product
        uint256 prod1; // Most significant 256 bits of the product
        assembly {
            let mm := mulmod(a, b, not(0))
            prod0 := mul(a, b)
            prod1 := sub(sub(mm, prod0), lt(mm, prod0))
        }

        // Handle non-overflow cases, 256 by 256 division
        if (prod1 == 0) {
            require(denominator > 0);
            assembly {
                result := div(prod0, denominator)
            }
            return result;
        }

        // Make sure the result is less than 2**256
        require(denominator > prod1);

        uint256 remainder;
        assembly {
            remainder := mulmod(a, b, denominator)
        }
        assembly {
            prod1 := sub(prod1, gt(remainder, prod0))
            prod0 := sub(prod0, remainder)
        }

        // Factor powers of two out of denominator
        uint256 twos = denominator & (~denominator + 1);
        assembly {
            denominator := div(denominator, twos)
        }

        assembly {
            prod0 := div(prod0, twos)
        }
        assembly {
            twos := add(div(sub(0, twos), twos), 1)
        }
        prod0 |= prod1 * twos;

        uint256 inv = (3 * denominator) ^ 2;
        inv *= 2 - denominator * inv;
        inv *= 2 - denominator * inv;
        inv *= 2 - denominator * inv;
        inv *= 2 - denominator * inv;
        inv *= 2 - denominator * inv;
        inv *= 2 - denominator * inv;

        result = prod0 * inv;
        return result;
    }

    function _getPendingFees(uint256 tokenId) internal view returns (uint256, uint256) {
        (,,,,,,,,,, uint128 tokensOwed0, uint128 tokensOwed1) = positionManager.positions(tokenId);
        return (uint256(tokensOwed0), uint256(tokensOwed1));
    }
}

// ============ Interfaces ============

interface INonfungiblePositionManager {
    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    struct IncreaseLiquidityParams {
        uint256 tokenId;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }

    struct DecreaseLiquidityParams {
        uint256 tokenId;
        uint128 liquidity;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }

    struct CollectParams {
        uint256 tokenId;
        address recipient;
        uint128 amount0Max;
        uint128 amount1Max;
    }

    function mint(MintParams calldata params) external returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);
    function increaseLiquidity(IncreaseLiquidityParams calldata params) external returns (uint128 liquidity, uint256 amount0, uint256 amount1);
    function decreaseLiquidity(DecreaseLiquidityParams calldata params) external returns (uint256 amount0, uint256 amount1);
    function collect(CollectParams calldata params) external returns (uint256 amount0, uint256 amount1);
    function burn(uint256 tokenId) external;
    function positions(uint256 tokenId) external view returns (
        uint96 nonce,
        address operator,
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        uint256 feeGrowthInside0LastX128,
        uint256 feeGrowthInside1LastX128,
        uint128 tokensOwed0,
        uint128 tokensOwed1
    );
}

interface IUniswapV3Pool {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function fee() external view returns (uint24);
    function slot0() external view returns (
        uint160 sqrtPriceX96,
        int24 tick,
        uint16 observationIndex,
        uint16 observationCardinality,
        uint16 observationCardinalityNext,
        uint8 feeProtocol,
        bool unlocked
    );
}
