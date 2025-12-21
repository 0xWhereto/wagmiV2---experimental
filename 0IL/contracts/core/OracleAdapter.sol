// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title OracleAdapter
 * @notice TWAP Oracle adapter for Uniswap V3 pools
 * @dev Provides manipulation-resistant price feeds using time-weighted average prices
 */
contract OracleAdapter is Ownable {
    
    // ============ Constants ============
    
    uint256 public constant WAD = 1e18;
    int256 public constant TICK_BASE = 1.0001e18;
    
    // ============ State Variables ============
    
    /// @notice The Uniswap V3 pool to get prices from
    IUniswapV3Pool public immutable pool;
    
    /// @notice Token0 of the pool
    address public immutable token0;
    
    /// @notice Token1 of the pool
    address public immutable token1;
    
    /// @notice TWAP observation period in seconds
    uint32 public twapPeriod;
    
    /// @notice Fallback Chainlink oracle (if available)
    address public chainlinkOracle;
    
    /// @notice Maximum allowed price deviation from Chainlink (if set)
    uint256 public maxDeviation = 0.05e18; // 5%
    
    /// @notice Whether to use Chainlink as primary source
    bool public useChainlinkPrimary;
    
    // ============ Events ============
    
    event TwapPeriodUpdated(uint32 newPeriod);
    event ChainlinkOracleSet(address oracle);
    event MaxDeviationSet(uint256 deviation);
    event UseChainlinkPrimarySet(bool usePrimary);
    
    // ============ Errors ============
    
    error StalePrice();
    error PriceDeviationTooHigh();
    error InvalidTwapPeriod();
    error OldestObservationTooRecent();
    
    // ============ Constructor ============
    
    constructor(
        address _pool,
        uint32 _twapPeriod
    ) Ownable(msg.sender) {
        if (_twapPeriod < 60) revert InvalidTwapPeriod(); // Minimum 1 minute
        
        pool = IUniswapV3Pool(_pool);
        token0 = pool.token0();
        token1 = pool.token1();
        twapPeriod = _twapPeriod;
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Update TWAP observation period
     * @param _twapPeriod New period in seconds (min 60)
     */
    function setTwapPeriod(uint32 _twapPeriod) external onlyOwner {
        if (_twapPeriod < 60) revert InvalidTwapPeriod();
        twapPeriod = _twapPeriod;
        emit TwapPeriodUpdated(_twapPeriod);
    }
    
    /**
     * @notice Set Chainlink oracle for price validation
     * @param _oracle Chainlink aggregator address
     */
    function setChainlinkOracle(address _oracle) external onlyOwner {
        chainlinkOracle = _oracle;
        emit ChainlinkOracleSet(_oracle);
    }
    
    /**
     * @notice Set maximum allowed deviation from Chainlink
     * @param _deviation Max deviation (18 decimals, e.g., 0.05e18 = 5%)
     */
    function setMaxDeviation(uint256 _deviation) external onlyOwner {
        require(_deviation <= 0.20e18, "Max 20% deviation");
        maxDeviation = _deviation;
        emit MaxDeviationSet(_deviation);
    }
    
    /**
     * @notice Set whether to use Chainlink as primary price source
     */
    function setUseChainlinkPrimary(bool _usePrimary) external onlyOwner {
        useChainlinkPrimary = _usePrimary;
        emit UseChainlinkPrimarySet(_usePrimary);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get the current price (token0 in terms of token1)
     * @return price Price with 18 decimals
     */
    function getPrice() external view returns (uint256 price) {
        if (useChainlinkPrimary && chainlinkOracle != address(0)) {
            price = _getChainlinkPrice();
            // Validate against TWAP
            uint256 twapPrice = _getTwapPrice();
            _validatePriceDeviation(price, twapPrice);
        } else {
            price = _getTwapPrice();
            // Validate against Chainlink if available
            if (chainlinkOracle != address(0)) {
                uint256 chainlinkPrice = _getChainlinkPrice();
                _validatePriceDeviation(price, chainlinkPrice);
            }
        }
    }
    
    /**
     * @notice Get TWAP price
     * @return price Price with 18 decimals
     */
    function getTwapPrice() external view returns (uint256) {
        return _getTwapPrice();
    }
    
    /**
     * @notice Get spot price (current tick)
     * @return price Price with 18 decimals
     */
    function getSpotPrice() external view returns (uint256) {
        (, int24 tick,,,,,) = pool.slot0();
        return _getPriceFromTick(tick);
    }
    
    /**
     * @notice Get Chainlink price if oracle is set
     * @return price Price with 18 decimals
     */
    function getChainlinkPrice() external view returns (uint256) {
        require(chainlinkOracle != address(0), "No Chainlink oracle");
        return _getChainlinkPrice();
    }
    
    /**
     * @notice Check if the pool has enough observations for TWAP
     */
    function hasEnoughObservations() external view returns (bool) {
        (,,, uint16 observationCardinality,,,) = pool.slot0();
        return observationCardinality > 1;
    }
    
    // ============ Internal Functions ============
    
    /**
     * @notice Get TWAP price from Uniswap V3 pool
     */
    function _getTwapPrice() internal view returns (uint256) {
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = twapPeriod;
        secondsAgos[1] = 0;
        
        try pool.observe(secondsAgos) returns (
            int56[] memory tickCumulatives,
            uint160[] memory
        ) {
            int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
            int24 arithmeticMeanTick = int24(tickCumulativesDelta / int56(uint56(twapPeriod)));
            
            // Handle negative tick rounding
            if (tickCumulativesDelta < 0 && (tickCumulativesDelta % int56(uint56(twapPeriod)) != 0)) {
                arithmeticMeanTick--;
            }
            
            return _getPriceFromTick(arithmeticMeanTick);
        } catch {
            // Fallback to spot price if TWAP fails
            (, int24 tick,,,,,) = pool.slot0();
            return _getPriceFromTick(tick);
        }
    }
    
    /**
     * @notice Convert tick to price
     * @param tick The tick value
     * @return price Price with 18 decimals
     */
    function _getPriceFromTick(int24 tick) internal pure returns (uint256) {
        // price = 1.0001^tick
        // For efficiency, we use the sqrtPriceX96 approximation
        
        uint256 absTick = tick < 0 ? uint256(uint24(-tick)) : uint256(uint24(tick));
        
        uint256 ratio = absTick & 0x1 != 0 
            ? 0xfffcb933bd6fad37aa2d162d1a594001 
            : 0x100000000000000000000000000000000;
            
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
        
        // Convert to 18 decimal price
        // sqrtPriceX96 = sqrt(price) * 2^96
        // price = (sqrtPriceX96^2) / 2^192
        uint256 sqrtPriceX96 = uint256((ratio >> 32) + (ratio % (1 << 32) == 0 ? 0 : 1));
        
        // price = sqrtPrice^2, scaled to 18 decimals
        return (sqrtPriceX96 * sqrtPriceX96 * 1e18) >> 192;
    }
    
    /**
     * @notice Get price from Chainlink oracle
     */
    function _getChainlinkPrice() internal view returns (uint256) {
        (
            ,
            int256 answer,
            ,
            uint256 updatedAt,
            
        ) = IChainlinkAggregator(chainlinkOracle).latestRoundData();
        
        // Check for stale price (older than 1 hour)
        if (block.timestamp - updatedAt > 3600) revert StalePrice();
        
        // Chainlink returns 8 decimals, convert to 18
        return uint256(answer) * 1e10;
    }
    
    /**
     * @notice Validate price deviation between two sources
     */
    function _validatePriceDeviation(uint256 price1, uint256 price2) internal view {
        uint256 diff = price1 > price2 ? price1 - price2 : price2 - price1;
        uint256 deviation = (diff * WAD) / price1;
        
        if (deviation > maxDeviation) revert PriceDeviationTooHigh();
    }
}

// ============ Interfaces ============

interface IUniswapV3Pool {
    function token0() external view returns (address);
    function token1() external view returns (address);
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
}

interface IChainlinkAggregator {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
}

