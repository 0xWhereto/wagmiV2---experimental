// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { IMinimalNonfungiblePositionManager } from "../interfaces/IMinimalNonfungiblePositionManager.sol";
import { IMinimalUniswapV3Factory } from "../interfaces/IMinimalUniswapV3Factory.sol";
import { TransferHelper } from "../libraries/TransferHelper.sol";

contract MockNonfungiblePositionManager is IMinimalNonfungiblePositionManager {
    using TransferHelper for address;

    uint256 private _nextTokenId = 1;
    IMinimalUniswapV3Factory private immutable factory;

    constructor(address _factory) {
        factory = IMinimalUniswapV3Factory(_factory);
    }

    function mint(
        MintParams calldata params
    )
        external
        override
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        address pool = factory.getPool(params.token0, params.token1, params.fee);
        require(pool != address(0), "POOL_NOT_FOUND");

        if (params.amount0Desired > 0) {
            params.token0.safeTransferFrom(msg.sender, pool, params.amount0Desired);
        }
        if (params.amount1Desired > 0) {
            params.token1.safeTransferFrom(msg.sender, pool, params.amount1Desired);
        }

        tokenId = _nextTokenId++;
        liquidity = uint128(params.amount0Desired + params.amount1Desired);
        amount0 = params.amount0Desired;
        amount1 = params.amount1Desired;
    }
}
