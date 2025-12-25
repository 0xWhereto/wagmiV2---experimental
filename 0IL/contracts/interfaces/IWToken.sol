// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IWToken
 * @notice Interface for wToken (wETH, wBTC) receipt tokens
 */
interface IWToken is IERC20 {
    // ============ View Functions ============
    
    /// @notice Get underlying asset
    function underlyingAsset() external view returns (IERC20);
    
    /// @notice Get current price per share (18 decimals)
    function pricePerShare() external view returns (uint256);
    
    /// @notice Get total value of all positions
    function getTotalValue() external view returns (uint256);
    
    /// @notice Get user's position value
    function getPositionValue(address user) external view returns (uint256);
    
    /// @notice Get user's PnL since deposit
    function getUserPnL(address user) external view returns (int256 pnl, int256 pnlPercent);
    
    /// @notice Get entry price for user
    function entryPrice(address user) external view returns (uint256);
    
    /// @notice Convert assets to shares
    function convertToShares(uint256 assets) external view returns (uint256);
    
    /// @notice Convert shares to assets
    function convertToAssets(uint256 shares) external view returns (uint256);
    
    /// @notice Check if deposits are paused
    function depositsPaused() external view returns (bool);
    
    /// @notice Check if withdrawals are paused
    function withdrawalsPaused() external view returns (bool);
    
    // ============ User Functions ============
    
    /// @notice Deposit underlying asset
    function deposit(uint256 amount, uint256 minShares) external returns (uint256 shares);
    
    /// @notice Deposit ETH directly (wETH only)
    function depositETH(uint256 minShares) external payable returns (uint256 shares);
    
    /// @notice Withdraw underlying asset
    function withdraw(uint256 shares, uint256 minAssets) external returns (uint256 assets);
    
    /// @notice Withdraw as ETH (wETH only)
    function withdrawETH(uint256 shares, uint256 minAssets) external returns (uint256 assets);
    
    /// @notice Trigger position rebalancing
    function rebalance() external;
    
    // ============ Admin Functions ============
    
    /// @notice Pause/unpause deposits
    function setDepositsPaused(bool paused) external;
    
    /// @notice Pause/unpause withdrawals
    function setWithdrawalsPaused(bool paused) external;
}


