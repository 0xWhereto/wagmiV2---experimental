// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { IMinimalUniswapV3Factory } from "../interfaces/IMinimalUniswapV3Factory.sol";
import { MockUniswapV3Pool } from "./MockUniswapV3Pool.sol";

contract MockUniswapV3Factory is IMinimalUniswapV3Factory {
    mapping(address => mapping(address => mapping(uint24 => address))) public override getPool;

    function createPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external override returns (address pool) {
        require(tokenA != tokenB, "IDENTICAL_ADDRESSES");
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "ZERO_ADDRESS");
        require(getPool[token0][token1][fee] == address(0), "POOL_EXISTS");

        MockUniswapV3Pool mockPool = new MockUniswapV3Pool(token0, token1, fee);
        pool = address(mockPool);

        getPool[token0][token1][fee] = pool;
        getPool[token1][token0][fee] = pool; // populate mapping in the reverse direction

        return pool;
    }
}
