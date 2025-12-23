// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title VaultRescuer
 * @notice Helper contract to rescue stuck tokens from old V3LPVault contracts
 * @dev Deploy this, set it as operator on old V3LPVault, then call rescue functions
 */
contract VaultRescuer is Ownable {
    using SafeERC20 for IERC20;
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @notice Rescue tokens from a V3LPVault by removing all liquidity
     * @param vault The V3LPVault address
     */
    function rescueAllLiquidity(address vault) external onlyOwner returns (uint256 amount0, uint256 amount1) {
        // Remove 100% of liquidity (10000 basis points)
        (amount0, amount1) = IV3LPVault(vault).removeLiquidity(10000, 0, 0);
    }
    
    /**
     * @notice Remove a percentage of liquidity
     * @param vault The V3LPVault address
     * @param percent Percentage in basis points (10000 = 100%)
     */
    function rescuePercentage(
        address vault,
        uint256 percent
    ) external onlyOwner returns (uint256 amount0, uint256 amount1) {
        (amount0, amount1) = IV3LPVault(vault).removeLiquidity(percent, 0, 0);
    }
    
    /**
     * @notice Collect any pending fees from the vault
     * @param vault The V3LPVault address
     */
    function collectVaultFees(address vault) external onlyOwner {
        IV3LPVault(vault).collectFees();
    }
    
    /**
     * @notice Transfer any ERC20 tokens in this contract to owner
     * @param token The token to rescue
     */
    function withdrawToken(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).safeTransfer(owner(), balance);
        }
    }
    
    /**
     * @notice Call arbitrary function on a contract (for emergency use)
     * @param target Target contract
     * @param data Calldata
     */
    function executeCall(address target, bytes calldata data) external onlyOwner returns (bytes memory) {
        (bool success, bytes memory result) = target.call(data);
        require(success, "Call failed");
        return result;
    }
    
    /**
     * @notice Transfer tokens using transferFrom (requires approval)
     * @param token Token address
     * @param from From address  
     * @param amount Amount
     */
    function pullTokens(address token, address from, uint256 amount) external onlyOwner {
        IERC20(token).safeTransferFrom(from, owner(), amount);
    }
    
    /**
     * @notice Rescue native ETH
     */
    function withdrawETH() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    receive() external payable {}
}

interface IV3LPVault {
    function removeLiquidity(uint256 percent, uint256 amount0Min, uint256 amount1Min) external returns (uint256, uint256);
    function collectFees() external returns (uint256, uint256);
    function getLayerCount() external view returns (uint256);
    function layers(uint256) external view returns (int24, int24, uint256, uint256, uint128);
}

