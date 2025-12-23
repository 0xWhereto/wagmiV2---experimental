// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

interface IMIMStakingVault {
    function borrow(uint256 amount) external;
    function repay(uint256 amount) external;
    function payWeeklyInterest(uint256 amount) external returns (uint256 paid, uint256 shortfall);
    function getPoolWeeklyInterest(address pool) external view returns (uint256);
    function borrowBalanceOf(address account) external view returns (uint256);
}

interface IV3LPVault {
    function addLiquidity(
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min
    ) external returns (uint128 liquidity);
    
    function removeLiquidity(
        uint256 liquidityPercent,
        uint256 amount0Min,
        uint256 amount1Min
    ) external returns (uint256 amount0, uint256 amount1);
    
    function getTotalAssets() external view returns (uint256 amount0, uint256 amount1);
    
    function collectFees() external returns (uint256 fee0, uint256 fee1);
}

interface IOracleAdapter {
    function getPrice() external view returns (uint256);
    function getTwapPrice() external view returns (uint256);
    function getSpotPrice() external view returns (uint256);
}

interface ILeverageAMM {
    function openPosition(uint256 amount) external;
    function closePosition(uint256 shares, uint256 totalShares) external returns (uint256);
    function rebalance() external;
    function checkRebalance() external view returns (bool needsRebalance, bool isDeleverage);
    function getCurrentDTV() external view returns (uint256);
    function getTotalDebt() external view returns (uint256);
    function getPrice() external view returns (uint256);
    function getTotalLPValue() external view returns (uint256);
    function getEquity() external view returns (uint256);
}

interface IWToken {
    function deposit(uint256 amount, uint256 minShares) external returns (uint256 shares);
    function withdraw(uint256 shares, uint256 minAssets) external returns (uint256 assets);
    function pricePerShare() external view returns (uint256);
    function getTotalValue() external view returns (uint256);
    function getPositionValue(address user) external view returns (uint256);
}

