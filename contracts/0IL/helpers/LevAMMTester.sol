// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IV3LPVaultTest {
    function removeLiquidity(uint256 liquidityPercent, uint256 amount0Min, uint256 amount1Min) external returns (uint256 amount0, uint256 amount1);
    function token0() external view returns (address);
    function token1() external view returns (address);
}

contract LevAMMTester is ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    IV3LPVaultTest public v3LPVault;
    IERC20 public mim;
    bool public underlyingIsToken0;
    
    event TestResult(uint256 amount0, uint256 amount1, uint256 mimBalance, uint256 underlyingBalance);
    
    constructor(address _v3LPVault, address _mim, bool _underlyingIsToken0) {
        v3LPVault = IV3LPVaultTest(_v3LPVault);
        mim = IERC20(_mim);
        underlyingIsToken0 = _underlyingIsToken0;
    }
    
    function testClosePosition() external nonReentrant returns (uint256, uint256) {
        // Mimic closePosition
        (uint256 amount0, uint256 amount1) = v3LPVault.removeLiquidity(10000, 0, 0);
        
        uint256 mimBalance = mim.balanceOf(address(this));
        uint256 underlyingBalance;
        if (underlyingIsToken0) {
            underlyingBalance = IERC20(v3LPVault.token0()).balanceOf(address(this));
        } else {
            underlyingBalance = IERC20(v3LPVault.token1()).balanceOf(address(this));
        }
        
        emit TestResult(amount0, amount1, mimBalance, underlyingBalance);
        
        return (amount0, amount1);
    }
}
