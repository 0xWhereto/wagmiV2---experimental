// SPDX-License-Identifier: MIT

pragma solidity 0.8.23;

import { IBalancer } from "./interfaces/IBalancer.sol";

contract Balancer is IBalancer {
    function getPenalty(
        address _tokenOut,
        uint32 _dstEid,
        uint256 _currentBalance,
        uint256 _amountOut,
        uint256 _chainLength
    ) external view returns (uint256) {
        return 0;
    }

    function getBonus(
        address _tokenIn,
        uint32 _srcEid,
        uint256 _bonusBalance,
        uint256 _currentBalance,
        uint256 _amountIn,
        uint256 _chainLength
    ) external view returns (uint256) {
        return 0;
    }
}
