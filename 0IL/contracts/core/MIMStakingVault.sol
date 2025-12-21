// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MIMStakingVault (sMIM)
 * @notice Staking vault for MIM that earns borrow interest
 * @dev Implements ERC4626-style vault with kinked interest rate model
 */
contract MIMStakingVault is ERC20, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ============ Constants ============
    
    uint256 public constant WAD = 1e18;
    uint256 public constant BLOCKS_PER_YEAR = 31_536_000; // Assuming 1 block/second
    
    // Interest Rate Model Parameters
    uint256 public constant BASE_RATE = 0.10e18;          // 10% base rate
    uint256 public constant MULTIPLIER = 0.12e18;          // 12% multiplier
    uint256 public constant JUMP_MULTIPLIER = 1.00e18;     // 100% jump multiplier
    uint256 public constant KINK = 0.80e18;                // 80% kink point
    uint256 public constant MAX_UTILIZATION = 0.90e18;     // 90% max utilization
    
    // Protocol fee
    uint256 public reserveFactor = 0.10e18; // 10% of interest goes to reserves
    
    // ============ State Variables ============
    
    /// @notice The underlying MIM token
    IERC20 public immutable mim;
    
    /// @notice Total amount borrowed from the vault
    uint256 public totalBorrows;
    
    /// @notice Accumulated reserves (protocol fee)
    uint256 public totalReserves;
    
    /// @notice Last block when interest was accrued
    uint256 public lastAccrualBlock;
    
    /// @notice Borrow index for interest calculation
    uint256 public borrowIndex = WAD;
    
    /// @notice Authorized borrowers (LeverageAMM contracts)
    mapping(address => bool) public isBorrower;
    
    /// @notice Individual borrow balances (in borrow index units)
    mapping(address => uint256) public borrowPrincipal;
    
    // ============ Events ============
    
    event Deposit(address indexed user, uint256 assets, uint256 shares);
    event Withdraw(address indexed user, uint256 assets, uint256 shares);
    event Borrow(address indexed borrower, uint256 amount);
    event Repay(address indexed borrower, uint256 amount);
    event InterestAccrued(uint256 interestEarned, uint256 newBorrowIndex);
    event BorrowerSet(address indexed borrower, bool authorized);
    event ReserveFactorUpdated(uint256 newFactor);
    event ReservesWithdrawn(address indexed to, uint256 amount);
    
    // ============ Errors ============
    
    error NotBorrower();
    error ExceedsMaxUtilization();
    error InsufficientLiquidity();
    error ZeroAmount();
    error ZeroShares();
    
    // ============ Constructor ============
    
    constructor(address _mim) 
        ERC20("Staked MIM", "sMIM") 
        Ownable(msg.sender)
    {
        mim = IERC20(_mim);
        lastAccrualBlock = block.number;
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Set borrower authorization
     * @param borrower Address to authorize/deauthorize
     * @param authorized Whether to authorize or not
     */
    function setBorrower(address borrower, bool authorized) external onlyOwner {
        isBorrower[borrower] = authorized;
        emit BorrowerSet(borrower, authorized);
    }
    
    /**
     * @notice Update reserve factor
     * @param newFactor New reserve factor (18 decimals, max 20%)
     */
    function setReserveFactor(uint256 newFactor) external onlyOwner {
        require(newFactor <= 0.20e18, "Max 20%");
        reserveFactor = newFactor;
        emit ReserveFactorUpdated(newFactor);
    }
    
    /**
     * @notice Withdraw accumulated reserves
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function withdrawReserves(address to, uint256 amount) external onlyOwner {
        require(amount <= totalReserves, "Exceeds reserves");
        totalReserves -= amount;
        mim.safeTransfer(to, amount);
        emit ReservesWithdrawn(to, amount);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get current utilization rate
     * @return Utilization rate (18 decimals)
     */
    function utilizationRate() public view returns (uint256) {
        uint256 cash = getCash();
        if (cash + totalBorrows == 0) return 0;
        return (totalBorrows * WAD) / (cash + totalBorrows);
    }
    
    /**
     * @notice Get current borrow rate per year
     * @return Annual borrow rate (18 decimals)
     */
    function borrowRate() public view returns (uint256) {
        uint256 util = utilizationRate();
        
        if (util <= KINK) {
            return BASE_RATE + (util * MULTIPLIER / WAD);
        } else {
            uint256 normalRate = BASE_RATE + (KINK * MULTIPLIER / WAD);
            uint256 excessUtil = util - KINK;
            return normalRate + (excessUtil * JUMP_MULTIPLIER / WAD);
        }
    }
    
    /**
     * @notice Get current supply rate per year
     * @return Annual supply rate (18 decimals)
     */
    function supplyRate() public view returns (uint256) {
        uint256 util = utilizationRate();
        uint256 bRate = borrowRate();
        
        // supplyRate = borrowRate * util * (1 - reserveFactor)
        uint256 rateToSuppliers = bRate * (WAD - reserveFactor) / WAD;
        return rateToSuppliers * util / WAD;
    }
    
    /**
     * @notice Get available cash in vault
     * @return Available MIM balance
     */
    function getCash() public view returns (uint256) {
        return mim.balanceOf(address(this));
    }
    
    /**
     * @notice Get total assets in vault (cash + borrows)
     * @return Total assets
     */
    function totalAssets() public view returns (uint256) {
        return getCash() + totalBorrows - totalReserves;
    }
    
    /**
     * @notice Convert assets to shares
     * @param assets Amount of assets
     * @return shares Equivalent shares
     */
    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return assets;
        return (assets * supply) / totalAssets();
    }
    
    /**
     * @notice Convert shares to assets
     * @param shares Amount of shares
     * @return assets Equivalent assets
     */
    function convertToAssets(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return shares;
        return (shares * totalAssets()) / supply;
    }
    
    /**
     * @notice Get borrow balance for an account
     * @param account Borrower address
     * @return Current borrow balance including interest
     */
    function borrowBalanceOf(address account) public view returns (uint256) {
        if (borrowPrincipal[account] == 0) return 0;
        return (borrowPrincipal[account] * borrowIndex) / WAD;
    }
    
    // ============ User Functions ============
    
    /**
     * @notice Deposit MIM and receive sMIM
     * @param assets Amount of MIM to deposit
     * @return shares Amount of sMIM received
     */
    function deposit(uint256 assets) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        
        accrueInterest();
        
        shares = convertToShares(assets);
        if (shares == 0) revert ZeroShares();
        
        mim.safeTransferFrom(msg.sender, address(this), assets);
        _mint(msg.sender, shares);
        
        emit Deposit(msg.sender, assets, shares);
    }
    
    /**
     * @notice Withdraw MIM by burning sMIM
     * @param shares Amount of sMIM to burn
     * @return assets Amount of MIM received
     */
    function withdraw(uint256 shares) external nonReentrant returns (uint256 assets) {
        if (shares == 0) revert ZeroAmount();
        
        accrueInterest();
        
        assets = convertToAssets(shares);
        if (assets == 0) revert ZeroAmount();
        if (assets > getCash()) revert InsufficientLiquidity();
        
        _burn(msg.sender, shares);
        mim.safeTransfer(msg.sender, assets);
        
        emit Withdraw(msg.sender, assets, shares);
    }
    
    // ============ Borrower Functions ============
    
    /**
     * @notice Borrow MIM from vault (borrower only)
     * @param amount Amount to borrow
     */
    function borrow(uint256 amount) external nonReentrant {
        if (!isBorrower[msg.sender]) revert NotBorrower();
        if (amount == 0) revert ZeroAmount();
        
        accrueInterest();
        
        // Check utilization after borrow
        uint256 newBorrows = totalBorrows + amount;
        uint256 cash = getCash();
        uint256 newUtil = (newBorrows * WAD) / (cash + newBorrows);
        if (newUtil > MAX_UTILIZATION) revert ExceedsMaxUtilization();
        
        if (amount > cash) revert InsufficientLiquidity();
        
        // Update borrow state
        uint256 principalIncrease = (amount * WAD) / borrowIndex;
        borrowPrincipal[msg.sender] += principalIncrease;
        totalBorrows += amount;
        
        // Transfer MIM
        mim.safeTransfer(msg.sender, amount);
        
        emit Borrow(msg.sender, amount);
    }
    
    /**
     * @notice Repay borrowed MIM (borrower only)
     * @param amount Amount to repay
     */
    function repay(uint256 amount) external nonReentrant {
        if (!isBorrower[msg.sender]) revert NotBorrower();
        if (amount == 0) revert ZeroAmount();
        
        accrueInterest();
        
        uint256 borrowBalance = borrowBalanceOf(msg.sender);
        uint256 repayAmount = amount > borrowBalance ? borrowBalance : amount;
        
        // Update borrow state
        uint256 principalDecrease = (repayAmount * WAD) / borrowIndex;
        borrowPrincipal[msg.sender] -= principalDecrease;
        totalBorrows -= repayAmount;
        
        // Transfer MIM from borrower
        mim.safeTransferFrom(msg.sender, address(this), repayAmount);
        
        emit Repay(msg.sender, repayAmount);
    }
    
    // ============ Internal Functions ============
    
    /**
     * @notice Accrue interest since last update
     */
    function accrueInterest() public {
        uint256 blockDelta = block.number - lastAccrualBlock;
        if (blockDelta == 0) return;
        
        uint256 currentBorrows = totalBorrows;
        if (currentBorrows == 0) {
            lastAccrualBlock = block.number;
            return;
        }
        
        // Calculate interest
        uint256 rate = borrowRate();
        uint256 interestFactor = (rate * blockDelta) / BLOCKS_PER_YEAR;
        uint256 interestAccumulated = (currentBorrows * interestFactor) / WAD;
        
        // Update state
        totalBorrows = currentBorrows + interestAccumulated;
        totalReserves += (interestAccumulated * reserveFactor) / WAD;
        borrowIndex = (borrowIndex * (WAD + interestFactor)) / WAD;
        lastAccrualBlock = block.number;
        
        emit InterestAccrued(interestAccumulated, borrowIndex);
    }
}

