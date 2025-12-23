// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IMIM
 * @notice Interface for the MIM stablecoin
 */
interface IMIM is IERC20 {
    /// @notice Check if address is authorized minter
    function isMinter(address account) external view returns (bool);
    
    /// @notice Get minter's remaining allowance
    function minterAllowance(address minter) external view returns (uint256);
    
    /// @notice Get total USDC backing
    function totalBacking() external view returns (uint256);
    
    /// @notice Get USDC token address
    function usdc() external view returns (address);
    
    /// @notice Mint MIM to address (minter only)
    function mint(address to, uint256 amount) external;
    
    /// @notice Burn MIM from sender
    function burn(uint256 amount) external;
    
    /// @notice Mint MIM by depositing USDC 1:1
    function mintWithUSDC(uint256 amount) external;
    
    /// @notice Redeem MIM for USDC 1:1
    function redeemForUSDC(uint256 mimAmount) external;
    
    /// @notice Get backing ratio (should be >= 1e18)
    function backingRatio() external view returns (uint256);
    
    /// @notice Set minter allowance (owner only)
    function setMinter(address minter, uint256 allowance) external;
    
    /// @notice Remove minter authorization (owner only)
    function removeMinter(address minter) external;
}

