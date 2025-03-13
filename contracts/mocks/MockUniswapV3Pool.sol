// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { IMinimalUniswapV3Pool } from "../interfaces/IMinimalUniswapV3Pool.sol";
import { TransferHelper } from "../libraries/TransferHelper.sol";

contract MockUniswapV3Pool is IMinimalUniswapV3Pool {
    using TransferHelper for address;

    address public immutable token0;
    address public immutable token1;
    uint24 public immutable fee;

    constructor(address _token0, address _token1, uint24 _fee) {
        token0 = _token0;
        token1 = _token1;
        fee = _fee;
    }

    // Mock implementation of initialize
    function initialize(uint160) external override {
        // Do nothing, just a mock
    }

    // Mock implementation of swap
    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 /*sqrtPriceLimitX96*/,
        bytes calldata data
    ) external override returns (int256 amount0, int256 amount1) {
        require(amountSpecified > 0, "NEGATIVE_AMOUNT");

        address tokenOut = zeroForOne ? token1 : token0;
        uint256 amountIn = uint256(amountSpecified);
        uint256 amountOut = amountIn * 2; // 1:2 conversion rate

        // Call the callback to receive the input tokens
        IUniswapV3SwapCallback(msg.sender).uniswapV3SwapCallback(
            zeroForOne ? int256(amountIn) : int256(0),
            zeroForOne ? int256(0) : int256(amountIn),
            data
        );

        // Send the output tokens
        tokenOut.safeTransfer(recipient, amountOut);

        // Return the delta values
        if (zeroForOne) {
            amount0 = int256(amountIn);
            amount1 = -int256(amountOut);
        } else {
            amount0 = -int256(amountOut);
            amount1 = int256(amountIn);
        }
    }
}

interface IUniswapV3SwapCallback {
    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external;
}
