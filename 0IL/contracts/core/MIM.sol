// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MIM - Magic Internet Money
 * @notice The native stablecoin of the 0IL Protocol
 * @dev 1:1 USDC-backed stablecoin with controlled minting
 */
contract MIM is ERC20, ERC20Permit, Ownable {
    /// @notice Mapping of authorized minters and their allowances
    mapping(address => uint256) public minterAllowance;
    
    /// @notice Mapping to check if an address is a minter
    mapping(address => bool) public isMinter;
    
    /// @notice USDC token address for minting/redeeming
    address public immutable usdc;
    
    /// @notice Total amount of USDC backing MIM
    uint256 public totalBacking;
    
    /// @notice Events
    event MinterSet(address indexed minter, uint256 allowance);
    event MinterRemoved(address indexed minter);
    event Minted(address indexed to, uint256 amount, address indexed minter);
    event Burned(address indexed from, uint256 amount);
    event MintedWithUSDC(address indexed user, uint256 usdcAmount, uint256 mimAmount);
    event RedeemedForUSDC(address indexed user, uint256 mimAmount, uint256 usdcAmount);
    
    /// @notice Errors
    error NotMinter();
    error ExceedsAllowance();
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientBacking();
    
    constructor(address _usdc) 
        ERC20("Magic Internet Money", "MIM") 
        ERC20Permit("Magic Internet Money")
        Ownable(msg.sender)
    {
        if (_usdc == address(0)) revert ZeroAddress();
        usdc = _usdc;
    }
    
    /**
     * @notice Set minter allowance
     * @param minter Address to authorize as minter
     * @param allowance Maximum amount the minter can mint
     */
    function setMinter(address minter, uint256 allowance) external onlyOwner {
        if (minter == address(0)) revert ZeroAddress();
        
        minterAllowance[minter] = allowance;
        isMinter[minter] = allowance > 0;
        
        emit MinterSet(minter, allowance);
    }
    
    /**
     * @notice Remove minter authorization
     * @param minter Address to remove as minter
     */
    function removeMinter(address minter) external onlyOwner {
        minterAllowance[minter] = 0;
        isMinter[minter] = false;
        
        emit MinterRemoved(minter);
    }
    
    /**
     * @notice Mint MIM tokens (minter only)
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external {
        if (!isMinter[msg.sender]) revert NotMinter();
        if (amount > minterAllowance[msg.sender]) revert ExceedsAllowance();
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        
        minterAllowance[msg.sender] -= amount;
        _mint(to, amount);
        
        emit Minted(to, amount, msg.sender);
    }
    
    /**
     * @notice Burn MIM tokens
     * @param amount Amount to burn
     */
    function burn(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        
        _burn(msg.sender, amount);
        
        emit Burned(msg.sender, amount);
    }
    
    /**
     * @notice Mint MIM by depositing USDC (1:1)
     * @param amount Amount of USDC to deposit (and MIM to receive)
     */
    function mintWithUSDC(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        
        // Transfer USDC from user
        IERC20(usdc).transferFrom(msg.sender, address(this), amount);
        
        // Update backing
        totalBacking += amount;
        
        // Mint MIM 1:1 (USDC has 6 decimals, MIM has 18)
        uint256 mimAmount = amount * 1e12; // Scale 6 decimals to 18
        _mint(msg.sender, mimAmount);
        
        emit MintedWithUSDC(msg.sender, amount, mimAmount);
    }
    
    /**
     * @notice Redeem MIM for USDC (1:1)
     * @param mimAmount Amount of MIM to redeem
     */
    function redeemForUSDC(uint256 mimAmount) external {
        if (mimAmount == 0) revert ZeroAmount();
        
        // Calculate USDC amount (18 decimals to 6 decimals)
        uint256 usdcAmount = mimAmount / 1e12;
        
        if (usdcAmount > totalBacking) revert InsufficientBacking();
        
        // Burn MIM
        _burn(msg.sender, mimAmount);
        
        // Update backing
        totalBacking -= usdcAmount;
        
        // Transfer USDC to user
        IERC20(usdc).transfer(msg.sender, usdcAmount);
        
        emit RedeemedForUSDC(msg.sender, mimAmount, usdcAmount);
    }
    
    /**
     * @notice Get the backing ratio (should always be >= 1e18)
     * @return Backing ratio with 18 decimals
     */
    function backingRatio() external view returns (uint256) {
        if (totalSupply() == 0) return 1e18;
        
        // totalBacking is in 6 decimals, totalSupply in 18
        return (totalBacking * 1e30) / totalSupply();
    }
}

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

