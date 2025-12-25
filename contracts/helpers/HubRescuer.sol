// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title HubRescuer
 * @notice Helper contract to rescue stuck tokens from the SyntheticTokenHub
 * @dev Since Hub is too large to add rescue directly, this contract can be 
 *      authorized to rescue tokens on behalf of the Hub owner
 */
contract HubRescuer is Ownable {
    using SafeERC20 for IERC20;
    
    address public immutable hub;
    
    event TokensRescued(address indexed token, address indexed to, uint256 amount);
    
    constructor(address _hub) Ownable(msg.sender) {
        require(_hub != address(0), "Invalid hub");
        hub = _hub;
    }
    
    /**
     * @notice Rescue tokens from this contract (if tokens are sent here by mistake)
     * @param token Token address
     * @param to Recipient
     * @param amount Amount (0 for all)
     */
    function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 toTransfer = amount == 0 ? balance : (amount > balance ? balance : amount);
        IERC20(token).safeTransfer(to, toTransfer);
        emit TokensRescued(token, to, toTransfer);
    }
    
    /**
     * @notice Rescue ETH from this contract
     * @param to Recipient
     * @param amount Amount (0 for all)
     */
    function rescueETH(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        uint256 balance = address(this).balance;
        uint256 toTransfer = amount == 0 ? balance : (amount > balance ? balance : amount);
        to.transfer(toTransfer);
    }
    
    receive() external payable {}
}


