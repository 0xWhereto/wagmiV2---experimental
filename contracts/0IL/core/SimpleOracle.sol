// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SimpleOracle
 * @notice Simple spot price oracle for Uniswap V3 pools
 * @dev Returns price in token1 per token0 with 18 decimals
 */
contract SimpleOracle is Ownable {
    IUniswapV3Pool public immutable pool;
    address public immutable token0;
    address public immutable token1;
    
    /// @notice If true, return 1/price (token0 per token1)
    bool public invertPrice;
    
    constructor(address _pool) Ownable(msg.sender) {
        pool = IUniswapV3Pool(_pool);
        token0 = pool.token0();
        token1 = pool.token1();
    }
    
    /**
     * @notice Set whether to invert the price
     */
    function setInvertPrice(bool _invert) external onlyOwner {
        invertPrice = _invert;
    }
    
    /**
     * @notice Get current spot price
     * @return price Price with 18 decimals
     */
    function getPrice() external view returns (uint256 price) {
        (uint160 sqrtPriceX96,,,,,,) = pool.slot0();
        price = _calculatePrice(sqrtPriceX96);
        
        if (invertPrice && price > 0) {
            price = 1e36 / price;
        }
    }
    
    /**
     * @notice Get inverse price (1/price)
     * @return price Inverse price with 18 decimals
     */
    function getInversePrice() external view returns (uint256 price) {
        (uint160 sqrtPriceX96,,,,,,) = pool.slot0();
        price = _calculatePrice(sqrtPriceX96);
        
        if (price > 0) {
            price = 1e36 / price;
        }
        
        if (invertPrice && price > 0) {
            price = 1e36 / price;
        }
    }
    
    /**
     * @notice Calculate price from sqrtPriceX96
     * @dev price = (sqrtPriceX96 / 2^96)^2 = sqrtPriceX96^2 / 2^192
     *      To get 18 decimals: multiply by 1e18 before dividing
     *      price = sqrtPriceX96^2 * 1e18 / 2^192
     *
     *      To avoid overflow, we do it in steps:
     *      First: sqrtPriceX96^2 / 2^64 (fits in uint256 for reasonable prices)
     *      Then: result * 1e18 / 2^128
     */
    function _calculatePrice(uint160 sqrtPriceX96) internal pure returns (uint256) {
        // sqrtPriceX96 is max ~1.46e39 for MAX_TICK
        // sqrtPriceX96^2 could overflow uint256 (max ~1.16e77)
        // So we need to be careful
        
        uint256 sqrtPrice = uint256(sqrtPriceX96);
        
        // For very high prices (sqrtPriceX96 > 2^128), divide first
        if (sqrtPrice > type(uint128).max) {
            // sqrtPrice^2 / 2^192 = (sqrtPrice / 2^96)^2
            uint256 priceRaw = (sqrtPrice >> 96) * (sqrtPrice >> 96);
            return priceRaw * 1e18;
        }
        
        // For moderate prices, multiply first then divide
        // price = sqrtPrice^2 / 2^192 * 1e18
        // = (sqrtPrice * sqrtPrice * 1e18) >> 192
        
        // But sqrtPrice^2 might overflow, so divide by 2^64 first
        uint256 sqrtPrice64 = sqrtPrice >> 64;
        uint256 sqrtPriceRemainder = sqrtPrice & ((1 << 64) - 1);
        
        // (a + b)^2 = a^2 + 2ab + b^2 where a = sqrtPrice64 << 64, b = sqrtPriceRemainder
        // sqrtPrice^2 = (sqrtPrice64^2) << 128 + 2 * sqrtPrice64 * sqrtPriceRemainder << 64 + sqrtPriceRemainder^2
        // Dividing by 2^128:
        // sqrtPrice^2 >> 128 = sqrtPrice64^2 + (2 * sqrtPrice64 * sqrtPriceRemainder) >> 64 + sqrtPriceRemainder^2 >> 128
        
        uint256 term1 = sqrtPrice64 * sqrtPrice64;
        uint256 term2 = (sqrtPrice64 * sqrtPriceRemainder * 2) >> 64;
        uint256 term3 = (sqrtPriceRemainder * sqrtPriceRemainder) >> 128;
        
        uint256 priceIn128 = term1 + term2 + term3;
        
        // Now multiply by 1e18 and divide by remaining 2^64
        return (priceIn128 * 1e18) >> 64;
    }
}

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
    function token0() external view returns (address);
    function token1() external view returns (address);
}

