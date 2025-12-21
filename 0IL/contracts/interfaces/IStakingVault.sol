// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IStakingVault
 * @notice Interface for the MIM Staking Vault (sMIM)
 */
interface IStakingVault is IERC20 {
    // ============ View Functions ============
    
    /// @notice Get underlying MIM token
    function mim() external view returns (IERC20);
    
    /// @notice Get current utilization rate (18 decimals)
    function utilizationRate() external view returns (uint256);
    
    /// @notice Get current borrow rate per year (18 decimals)
    function borrowRate() external view returns (uint256);
    
    /// @notice Get current supply rate per year (18 decimals)
    function supplyRate() external view returns (uint256);
    
    /// @notice Get available cash in vault
    function getCash() external view returns (uint256);
    
    /// @notice Get total assets (cash + borrows)
    function totalAssets() external view returns (uint256);
    
    /// @notice Get total borrows
    function totalBorrows() external view returns (uint256);
    
    /// @notice Get total reserves
    function totalReserves() external view returns (uint256);
    
    /// @notice Convert assets to shares
    function convertToShares(uint256 assets) external view returns (uint256);
    
    /// @notice Convert shares to assets
    function convertToAssets(uint256 shares) external view returns (uint256);
    
    /// @notice Get borrow balance for account
    function borrowBalanceOf(address account) external view returns (uint256);
    
    /// @notice Check if address is authorized borrower
    function isBorrower(address account) external view returns (bool);
    
    // ============ User Functions ============
    
    /// @notice Deposit MIM and receive sMIM
    function deposit(uint256 assets) external returns (uint256 shares);
    
    /// @notice Withdraw MIM by burning sMIM
    function withdraw(uint256 shares) external returns (uint256 assets);
    
    // ============ Borrower Functions ============
    
    /// @notice Borrow MIM from vault (borrower only)
    function borrow(uint256 amount) external;
    
    /// @notice Repay borrowed MIM (borrower only)
    function repay(uint256 amount) external;
    
    // ============ Admin Functions ============
    
    /// @notice Set borrower authorization (owner only)
    function setBorrower(address borrower, bool authorized) external;
    
    /// @notice Set reserve factor (owner only)
    function setReserveFactor(uint256 newFactor) external;
    
    /// @notice Withdraw reserves (owner only)
    function withdrawReserves(address to, uint256 amount) external;
    
    /// @notice Accrue interest
    function accrueInterest() external;
}

