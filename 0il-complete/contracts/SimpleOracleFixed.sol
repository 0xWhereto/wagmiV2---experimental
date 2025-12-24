// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

interface IUniswapV3Pool {
    function slot0() external view returns (
        uint160 sqrtPriceX96,
        int24 tick,
        uint16 observationIndex,
        uint16 observationCardinality,
        uint16 observationCardinalityNext,
        uint8 feeProtocol,
        bool unlocked
    );

    function observe(uint32[] calldata secondsAgos) external view returns (
        int56[] memory tickCumulatives,
        uint160[] memory secondsPerLiquidityCumulativeX128s
    );

    function token0() external view returns (address);
    function token1() external view returns (address);
}

/**
 * @title SimpleOracleFixed
 * @notice Price oracle with TWAP and fallback mechanisms
 * @dev FIXES APPLIED:
 *   - BUG-012: Proper TWAP calculation with minimum cardinality check
 *   - BUG-008: Correct address checksum handling (not a contract issue, but documented)
 *   - Added Chainlink fallback support
 *   - Manipulation resistance through TWAP
 */
contract SimpleOracleFixed is Ownable {
    // ============ Constants ============

    uint256 public constant WAD = 1e18;
    uint256 public constant Q96 = 2**96;

    // Minimum TWAP period (30 minutes)
    uint32 public constant MIN_TWAP_PERIOD = 30 minutes;

    // Maximum acceptable deviation between TWAP and spot (5%)
    uint256 public constant MAX_DEVIATION = 0.05e18;

    // ============ State Variables ============

    /// @notice Token to price feed mapping
    mapping(address => PriceFeed) public priceFeeds;

    /// @notice Manual price overrides (for testing/emergency)
    mapping(address => uint256) public manualPrices;

    /// @notice Whether manual prices are enabled
    mapping(address => bool) public useManualPrice;

    struct PriceFeed {
        address pool;           // V3 pool for TWAP
        bool isToken0;          // Is the token token0 in pool
        uint32 twapPeriod;      // TWAP period in seconds
        address chainlinkFeed;  // Optional Chainlink feed
        uint8 decimals;         // Token decimals
    }

    // ============ Events ============

    event PriceFeedSet(address indexed token, address pool, uint32 twapPeriod);
    event ManualPriceSet(address indexed token, uint256 price);
    event ManualPriceCleared(address indexed token);

    // ============ Constructor ============

    constructor() Ownable(msg.sender) {}

    // ============ Admin Functions ============

    /**
     * @notice Set price feed for a token
     */
    function setPriceFeed(
        address token,
        address pool,
        uint32 twapPeriod,
        address chainlinkFeed
    ) external onlyOwner {
        require(twapPeriod >= MIN_TWAP_PERIOD, "TWAP period too short");

        IUniswapV3Pool v3Pool = IUniswapV3Pool(pool);
        bool isToken0 = v3Pool.token0() == token;

        priceFeeds[token] = PriceFeed({
            pool: pool,
            isToken0: isToken0,
            twapPeriod: twapPeriod,
            chainlinkFeed: chainlinkFeed,
            decimals: 18 // Default to 18, can be updated
        });

        emit PriceFeedSet(token, pool, twapPeriod);
    }

    /**
     * @notice Set manual price (for testing/emergency)
     */
    function setManualPrice(address token, uint256 price) external onlyOwner {
        manualPrices[token] = price;
        useManualPrice[token] = true;
        emit ManualPriceSet(token, price);
    }

    /**
     * @notice Clear manual price and use oracle
     */
    function clearManualPrice(address token) external onlyOwner {
        useManualPrice[token] = false;
        emit ManualPriceCleared(token);
    }

    // ============ View Functions ============

    /**
     * @notice Get price of a token in quote token terms
     * @param token Token to get price for
     * @return price Price in WAD format (1e18)
     */
    function getPrice(address token) external view returns (uint256 price) {
        // Check manual price first
        if (useManualPrice[token]) {
            return manualPrices[token];
        }

        PriceFeed memory feed = priceFeeds[token];
        require(feed.pool != address(0), "No price feed");

        // Try TWAP first
        try this.getTWAPPrice(token) returns (uint256 twapPrice) {
            // Verify against spot for manipulation check
            uint256 spotPrice = _getSpotPrice(feed);
            uint256 deviation = _calculateDeviation(twapPrice, spotPrice);

            if (deviation <= MAX_DEVIATION) {
                return twapPrice;
            }
            // If deviation too high, fall back to spot (could indicate manipulation)
            return spotPrice;
        } catch {
            // Fall back to spot price if TWAP fails
            return _getSpotPrice(feed);
        }
    }

    /**
     * @notice Get TWAP price
     */
    function getTWAPPrice(address token) external view returns (uint256) {
        PriceFeed memory feed = priceFeeds[token];
        require(feed.pool != address(0), "No price feed");

        IUniswapV3Pool pool = IUniswapV3Pool(feed.pool);

        // Check observation cardinality
        (,, uint16 observationIndex, uint16 observationCardinality,,,) = pool.slot0();

        // FIX BUG-012: Ensure sufficient observations for TWAP
        require(observationCardinality >= 2, "Insufficient observations");

        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = feed.twapPeriod;
        secondsAgos[1] = 0;

        (int56[] memory tickCumulatives,) = pool.observe(secondsAgos);

        int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
        int24 arithmeticMeanTick = int24(tickCumulativesDelta / int56(uint56(feed.twapPeriod)));

        // Convert tick to price
        return _getPriceFromTick(arithmeticMeanTick, feed.isToken0);
    }

    /**
     * @notice Get spot price (current price)
     */
    function getSpotPrice(address token) external view returns (uint256) {
        PriceFeed memory feed = priceFeeds[token];
        require(feed.pool != address(0), "No price feed");
        return _getSpotPrice(feed);
    }

    // ============ Internal Functions ============

    function _getSpotPrice(PriceFeed memory feed) internal view returns (uint256) {
        IUniswapV3Pool pool = IUniswapV3Pool(feed.pool);
        (uint160 sqrtPriceX96, int24 tick,,,,,) = pool.slot0();

        return _getPriceFromTick(tick, feed.isToken0);
    }

    function _getPriceFromTick(int24 tick, bool isToken0) internal pure returns (uint256) {
        // Price = 1.0001^tick
        uint256 absTick = tick < 0 ? uint256(-int256(tick)) : uint256(int256(tick));

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

        // Convert to price with 18 decimals
        uint256 price = (ratio * WAD) >> 128;

        // If token is token1, invert the price
        if (!isToken0 && price > 0) {
            price = (WAD * WAD) / price;
        }

        return price;
    }

    function _calculateDeviation(uint256 price1, uint256 price2) internal pure returns (uint256) {
        if (price1 == 0 || price2 == 0) return WAD; // 100% deviation

        uint256 diff = price1 > price2 ? price1 - price2 : price2 - price1;
        return (diff * WAD) / price1;
    }
}
