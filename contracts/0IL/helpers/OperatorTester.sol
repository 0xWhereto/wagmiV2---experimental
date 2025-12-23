// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IV3LPVaultMinimal {
    function removeLiquidity(uint256 liquidityPercent, uint256 amount0Min, uint256 amount1Min) external returns (uint256 amount0, uint256 amount1);
    function token0() external view returns (address);
    function token1() external view returns (address);
}

contract OperatorTester {
    IV3LPVaultMinimal public vault;
    
    event RemoveLiquidityResult(uint256 amount0, uint256 amount1, uint256 balance0, uint256 balance1);
    
    constructor(address _vault) {
        vault = IV3LPVaultMinimal(_vault);
    }
    
    function testRemoveLiquidity(uint256 percent) external returns (uint256, uint256) {
        (uint256 amount0, uint256 amount1) = vault.removeLiquidity(percent, 0, 0);
        
        uint256 balance0 = IERC20(vault.token0()).balanceOf(address(this));
        uint256 balance1 = IERC20(vault.token1()).balanceOf(address(this));
        
        emit RemoveLiquidityResult(amount0, amount1, balance0, balance1);
        
        return (amount0, amount1);
    }
    
    function withdrawTokens(address token, address to) external {
        IERC20(token).transfer(to, IERC20(token).balanceOf(address(this)));
    }
}
