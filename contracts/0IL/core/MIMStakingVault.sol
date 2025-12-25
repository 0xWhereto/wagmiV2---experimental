// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MIMStakingVault (sMIM)
 * @notice Staking vault for MIM that earns borrow interest from 0IL vaults
 * @dev Features:
 *   - 7-day rolling average utilization for rate calculation
 *   - Weekly interest payment cycle from 0IL pools
 *   - Priority payment: sMIM gets paid first, then 0IL keeps remainder
 *   - 15% protocol performance fee
 */
contract MIMStakingVault is ERC20, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ============ Constants ============
    
    uint256 public constant WAD = 1e18;
    uint256 public constant SECONDS_PER_YEAR = 31_536_000;
    uint256 public constant SECONDS_PER_WEEK = 604_800;
    uint256 public constant UTILIZATION_SAMPLES = 7; // 7-day average
    
    // Interest Rate Model Parameters
    uint256 public constant BASE_RATE = 0.10e18;          // 10% base rate
    uint256 public constant MULTIPLIER = 0.12e18;          // 12% multiplier
    uint256 public constant JUMP_MULTIPLIER = 1.00e18;     // 100% jump multiplier
    uint256 public constant KINK = 0.80e18;                // 80% kink point
    uint256 public constant MAX_UTILIZATION = 0.90e18;     // 90% max utilization
    
    // Protocol performance fee (15%)
    uint256 public constant PROTOCOL_FEE = 0.15e18;
    
    // ============ State Variables ============
    
    /// @notice The underlying MIM token
    IERC20 public immutable mim;
    
    /// @notice Total amount borrowed from the vault
    uint256 public totalBorrows;
    
    /// @notice Accumulated reserves (protocol fee)
    uint256 public totalReserves;
    
    /// @notice Last timestamp when interest was accrued
    uint256 public lastAccrualTime;
    
    /// @notice Borrow index for interest calculation
    uint256 public borrowIndex = WAD;
    
    /// @notice Authorized borrowers (0IL LeverageAMM contracts)
    mapping(address => bool) public isBorrower;
    
    /// @notice Individual borrow balances (in borrow index units)
    mapping(address => uint256) public borrowPrincipal;
    
    // ============ 7-Day Average Utilization ============
    
    /// @notice Daily utilization snapshots (circular buffer)
    uint256[7] public dailyUtilization;
    
    /// @notice Current day index in circular buffer
    uint256 public currentDayIndex;
    
    /// @notice Last snapshot timestamp
    uint256 public lastSnapshotTime;
    
    // ============ Weekly Interest Cycle ============
    
    /// @notice Start of current weekly cycle
    uint256 public weekStartTime;
    
    /// @notice Expected interest for this week
    uint256 public weeklyExpectedInterest;
    
    /// @notice Interest actually paid this week
    uint256 public weeklyPaidInterest;
    
    /// @notice Protocol treasury address
    address public treasury;
    
    // ============ Events ============
    
    event Deposit(address indexed user, uint256 assets, uint256 shares);
    event Withdraw(address indexed user, uint256 assets, uint256 shares);
    event Borrow(address indexed borrower, uint256 amount);
    event Repay(address indexed borrower, uint256 amount);
    event InterestAccrued(uint256 interestEarned, uint256 newBorrowIndex);
    event BorrowerSet(address indexed borrower, bool authorized);
    event WeeklyInterestPaid(address indexed pool, uint256 requested, uint256 paid, uint256 protocolFee);
    event WeeklyCycleStarted(uint256 weekStart, uint256 expectedInterest);
    event UtilizationSnapshot(uint256 dayIndex, uint256 utilization);
    event ReservesWithdrawn(address indexed to, uint256 amount);
    event TreasurySet(address indexed treasury);
    
    // ============ Errors ============
    
    error NotBorrower();
    error ExceedsMaxUtilization();
    error InsufficientLiquidity();
    error ZeroAmount();
    error ZeroShares();
    error WeekNotComplete();
    error ZeroAddress();
    
    // ============ Constructor ============
    
    constructor(address _mim, address _treasury) 
        ERC20("Staked MIM", "sMIM") 
        Ownable(msg.sender)
    {
        if (_mim == address(0) || _treasury == address(0)) revert ZeroAddress();
        
        mim = IERC20(_mim);
        treasury = _treasury;
        lastAccrualTime = block.timestamp;
        lastSnapshotTime = block.timestamp;
        weekStartTime = block.timestamp;
        
        // Initialize utilization snapshots to 0
        for (uint256 i = 0; i < 7; i++) {
            dailyUtilization[i] = 0;
        }
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Set borrower authorization (0IL pools)
     * @param borrower Address to authorize/deauthorize
     * @param authorized Whether to authorize or not
     */
    function setBorrower(address borrower, bool authorized) external onlyOwner {
        isBorrower[borrower] = authorized;
        emit BorrowerSet(borrower, authorized);
    }
    
    /**
     * @notice Set treasury address for protocol fees
     * @param _treasury New treasury address
     */
    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
        emit TreasurySet(_treasury);
    }
    
    /**
     * @notice Withdraw accumulated reserves to treasury
     * @param amount Amount to withdraw
     */
    function withdrawReserves(uint256 amount) external onlyOwner {
        require(amount <= totalReserves, "Exceeds reserves");
        totalReserves -= amount;
        mim.safeTransfer(treasury, amount);
        emit ReservesWithdrawn(treasury, amount);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get current (instantaneous) utilization rate
     * @return Utilization rate (18 decimals)
     */
    function utilizationRate() public view returns (uint256) {
        uint256 cash = getCash();
        if (cash + totalBorrows == 0) return 0;
        return (totalBorrows * WAD) / (cash + totalBorrows);
    }
    
    /**
     * @notice Get 7-day average utilization rate (used for rate calculation)
     * @return Average utilization rate (18 decimals)
     */
    function averageUtilization() public view returns (uint256) {
        uint256 sum = 0;
        for (uint256 i = 0; i < UTILIZATION_SAMPLES; i++) {
            sum += dailyUtilization[i];
        }
        return sum / UTILIZATION_SAMPLES;
    }
    
    /**
     * @notice Get current borrow rate per year (based on 7-day avg utilization)
     * @return Annual borrow rate (18 decimals)
     */
    function borrowRate() public view returns (uint256) {
        uint256 util = averageUtilization();
        
        if (util <= KINK) {
            return BASE_RATE + (util * MULTIPLIER / WAD);
        } else {
            uint256 normalRate = BASE_RATE + (KINK * MULTIPLIER / WAD);
            uint256 excessUtil = util - KINK;
            return normalRate + (excessUtil * JUMP_MULTIPLIER / WAD);
        }
    }
    
    /**
     * @notice Get current supply rate per year (after 15% protocol fee)
     * @return Annual supply rate (18 decimals)
     */
    function supplyRate() public view returns (uint256) {
        uint256 util = averageUtilization();
        uint256 bRate = borrowRate();
        
        // supplyRate = borrowRate * util * (1 - PROTOCOL_FEE)
        uint256 rateToSuppliers = bRate * (WAD - PROTOCOL_FEE) / WAD;
        return rateToSuppliers * util / WAD;
    }
    
    /**
     * @notice Get expected weekly interest owed by all 0IL pools
     * @return Expected interest for the week
     */
    function getWeeklyExpectedInterest() public view returns (uint256) {
        uint256 rate = borrowRate();
        return (totalBorrows * rate * SECONDS_PER_WEEK) / (SECONDS_PER_YEAR * WAD);
    }
    
    /**
     * @notice Check if current week is complete
     */
    function isWeekComplete() public view returns (bool) {
        return block.timestamp >= weekStartTime + SECONDS_PER_WEEK;
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
    
    // ============ Weekly Interest Payment (from 0IL Pools) ============
    
    /**
     * @notice Called by 0IL pools to pay weekly interest
     * @dev Pool pays what it can; if insufficient, pays all available fees
     * @param requestedAmount Expected interest amount
     * @return paidAmount Actual amount paid
     * @return shortfall Any unpaid amount
     */
    function payWeeklyInterest(uint256 requestedAmount) external nonReentrant returns (uint256 paidAmount, uint256 shortfall) {
        if (!isBorrower[msg.sender]) revert NotBorrower();
        
        // Get what the pool can actually pay
        uint256 poolBalance = mim.balanceOf(msg.sender);
        paidAmount = requestedAmount > poolBalance ? poolBalance : requestedAmount;
        shortfall = requestedAmount > paidAmount ? requestedAmount - paidAmount : 0;
        
        if (paidAmount > 0) {
            // Transfer MIM from 0IL pool
            mim.safeTransferFrom(msg.sender, address(this), paidAmount);
            
            // Calculate 15% protocol fee
            uint256 protocolFee = (paidAmount * PROTOCOL_FEE) / WAD;
            
            // Protocol fee goes to reserves
            totalReserves += protocolFee;
            
            // Remaining 85% goes to sMIM holders (reduces debt effectively)
            uint256 toStakers = paidAmount - protocolFee;
            
            // Update weekly tracking
            weeklyPaidInterest += paidAmount;
            
            emit WeeklyInterestPaid(msg.sender, requestedAmount, paidAmount, protocolFee);
        }
        
        return (paidAmount, shortfall);
    }
    
    /**
     * @notice Start a new weekly cycle
     * @dev Anyone can call after week is complete
     */
    function startNewWeek() external {
        if (!isWeekComplete()) revert WeekNotComplete();
        
        // Snapshot utilization before starting new week
        _snapshotUtilization();
        
        // Calculate expected interest for new week
        weeklyExpectedInterest = getWeeklyExpectedInterest();
        weeklyPaidInterest = 0;
        weekStartTime = block.timestamp;
        
        emit WeeklyCycleStarted(weekStartTime, weeklyExpectedInterest);
    }
    
    /**
     * @notice Get interest owed by a specific 0IL pool for this week
     * @param pool The 0IL pool address
     * @return Interest amount owed
     */
    function getPoolWeeklyInterest(address pool) external view returns (uint256) {
        if (borrowPrincipal[pool] == 0) return 0;
        
        uint256 poolDebt = borrowBalanceOf(pool);
        uint256 rate = borrowRate();
        
        return (poolDebt * rate * SECONDS_PER_WEEK) / (SECONDS_PER_YEAR * WAD);
    }
    
    // ============ Utilization Snapshot ============
    
    /**
     * @notice Take daily utilization snapshot (should be called daily)
     */
    function snapshotUtilization() external {
        _snapshotUtilization();
    }
    
    function _snapshotUtilization() internal {
        // Only snapshot once per day
        if (block.timestamp < lastSnapshotTime + 1 days) return;
        
        // Store current utilization in circular buffer
        dailyUtilization[currentDayIndex] = utilizationRate();
        
        emit UtilizationSnapshot(currentDayIndex, dailyUtilization[currentDayIndex]);
        
        // Move to next slot
        currentDayIndex = (currentDayIndex + 1) % UTILIZATION_SAMPLES;
        lastSnapshotTime = block.timestamp;
    }
    
    // ============ Internal Functions ============
    
    /**
     * @notice Accrue interest since last update
     */
    function accrueInterest() public {
        uint256 timeDelta = block.timestamp - lastAccrualTime;
        if (timeDelta == 0) return;
        
        // Auto-snapshot utilization if a day has passed
        if (block.timestamp >= lastSnapshotTime + 1 days) {
            _snapshotUtilization();
        }
        
        uint256 currentBorrows = totalBorrows;
        if (currentBorrows == 0) {
            lastAccrualTime = block.timestamp;
            return;
        }
        
        // Calculate interest using 7-day average utilization
        uint256 rate = borrowRate();
        uint256 interestFactor = (rate * timeDelta) / SECONDS_PER_YEAR;
        uint256 interestAccumulated = (currentBorrows * interestFactor) / WAD;
        
        // Update state
        totalBorrows = currentBorrows + interestAccumulated;
        borrowIndex = (borrowIndex * (WAD + interestFactor)) / WAD;
        lastAccrualTime = block.timestamp;
        
        emit InterestAccrued(interestAccumulated, borrowIndex);
    }
}


