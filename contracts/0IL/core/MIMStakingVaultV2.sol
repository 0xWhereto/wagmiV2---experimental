// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MIMStakingVault V2 (sMIM)
 * @notice Staking vault for MIM that earns borrow interest from 0IL vaults
 * @dev MERGED VERSION with fixes:
 *   - BUG-003: Fixed withdrawal logic to cap at available liquidity
 *   - Added liquidAssets() and maxWithdrawable() view functions
 *   - Added repayDirect() for direct MIM receipt without double-transfer
 *   - Improved error handling with detailed revert reasons
 */
contract MIMStakingVaultV2 is ERC20, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ============ Constants ============
    
    uint256 public constant WAD = 1e18;
    uint256 public constant SECONDS_PER_YEAR = 31_536_000;
    uint256 public constant SECONDS_PER_WEEK = 604_800;
    uint256 public constant UTILIZATION_SAMPLES = 7;
    
    // Interest Rate Model Parameters (per year)
    uint256 public constant BASE_RATE = 0.10e18;      // 10% base
    uint256 public constant MULTIPLIER = 0.12e18;     // 12% slope before kink
    uint256 public constant JUMP_MULTIPLIER = 1.00e18; // 100% slope after kink
    uint256 public constant KINK = 0.80e18;           // 80% utilization kink
    uint256 public constant MAX_UTILIZATION = 0.90e18; // 90% max utilization
    
    // Protocol performance fee (15%)
    uint256 public constant PROTOCOL_FEE = 0.15e18;
    
    // ============ State Variables ============
    
    IERC20 public immutable mim;
    
    uint256 public totalBorrows;
    uint256 public totalReserves;
    uint256 public lastAccrualTime;
    uint256 public borrowIndex = WAD;
    
    mapping(address => bool) public isBorrower;
    mapping(address => uint256) public borrowPrincipal;
    
    // 7-Day Average Utilization
    uint256[7] public dailyUtilization;
    uint256 public currentDayIndex;
    uint256 public lastSnapshotTime;
    
    // Weekly Interest Cycle
    uint256 public weekStartTime;
    uint256 public weeklyExpectedInterest;
    uint256 public weeklyPaidInterest;
    
    address public treasury;
    
    // ============ Events ============
    
    event Deposit(address indexed user, uint256 assets, uint256 shares);
    event Withdraw(address indexed user, uint256 assets, uint256 shares);
    event PartialWithdraw(address indexed user, uint256 requestedShares, uint256 actualShares, uint256 assets);
    event Borrow(address indexed borrower, uint256 amount);
    event Repay(address indexed borrower, uint256 amount);
    event RepayDirect(address indexed borrower, uint256 amount);
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
    error InsufficientLiquidity(uint256 requested, uint256 available);
    error ZeroAmount();
    error ZeroShares();
    error WeekNotComplete();
    error ZeroAddress();
    
    // ============ Constructor ============
    
    constructor(
        address _mim,
        address _treasury
    ) ERC20("Staked MIM V2", "sMIM") Ownable(msg.sender) {
        if (_mim == address(0)) revert ZeroAddress();
        
        mim = IERC20(_mim);
        treasury = _treasury;
        lastAccrualTime = block.timestamp;
        lastSnapshotTime = block.timestamp;
        weekStartTime = block.timestamp;
        
        // Initialize utilization samples
        for (uint256 i = 0; i < 7; i++) {
            dailyUtilization[i] = 0;
        }
    }
    
    // ============ Admin Functions ============
    
    function setBorrower(address borrower, bool authorized) external onlyOwner {
        isBorrower[borrower] = authorized;
        emit BorrowerSet(borrower, authorized);
    }
    
    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
        emit TreasurySet(_treasury);
    }
    
    function withdrawReserves(uint256 amount) external onlyOwner {
        require(amount <= totalReserves, "Exceeds reserves");
        totalReserves -= amount;
        if (treasury != address(0)) {
            mim.safeTransfer(treasury, amount);
        } else {
            mim.safeTransfer(msg.sender, amount);
        }
        emit ReservesWithdrawn(treasury, amount);
    }
    
    // ============ View Functions ============
    
    function utilizationRate() public view returns (uint256) {
        uint256 cash = getCash();
        if (cash + totalBorrows == 0) return 0;
        return (totalBorrows * WAD) / (cash + totalBorrows);
    }
    
    function averageUtilization() public view returns (uint256) {
        uint256 sum = 0;
        for (uint256 i = 0; i < UTILIZATION_SAMPLES; i++) {
            sum += dailyUtilization[i];
        }
        return sum / UTILIZATION_SAMPLES;
    }
    
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
    
    function supplyRate() public view returns (uint256) {
        uint256 util = averageUtilization();
        uint256 bRate = borrowRate();
        uint256 rateToSuppliers = bRate * (WAD - PROTOCOL_FEE) / WAD;
        return rateToSuppliers * util / WAD;
    }
    
    function getWeeklyExpectedInterest() public view returns (uint256) {
        uint256 rate = borrowRate();
        return (totalBorrows * rate * SECONDS_PER_WEEK) / (SECONDS_PER_YEAR * WAD);
    }
    
    function isWeekComplete() public view returns (bool) {
        return block.timestamp >= weekStartTime + SECONDS_PER_WEEK;
    }
    
    function getCash() public view returns (uint256) {
        return mim.balanceOf(address(this));
    }
    
    /**
     * @notice Get liquid assets available for withdrawal
     * @return Available liquid MIM
     */
    function liquidAssets() public view returns (uint256) {
        return getCash();
    }
    
    function totalAssets() public view returns (uint256) {
        return getCash() + totalBorrows - totalReserves;
    }
    
    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return assets;
        return (assets * supply) / totalAssets();
    }
    
    function convertToAssets(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return shares;
        return (shares * totalAssets()) / supply;
    }
    
    /**
     * @notice Get maximum shares that can be withdrawn given current liquidity
     * @param user The user address
     * @return Maximum withdrawable shares
     */
    function maxWithdrawableShares(address user) public view returns (uint256) {
        uint256 userShares = balanceOf(user);
        uint256 cash = getCash();
        uint256 total = totalAssets();
        
        if (total == 0 || cash == 0) return 0;
        
        uint256 maxSharesFromCash = (cash * totalSupply()) / total;
        return userShares < maxSharesFromCash ? userShares : maxSharesFromCash;
    }
    
    /**
     * @notice Get maximum assets that can be withdrawn given current liquidity
     * @param user The user address
     * @return Maximum withdrawable assets
     */
    function maxWithdrawableAssets(address user) public view returns (uint256) {
        uint256 maxShares = maxWithdrawableShares(user);
        return convertToAssets(maxShares);
    }
    
    /**
     * @notice Get the withdrawal ratio (what % of position can be withdrawn)
     * @return Ratio in WAD (1e18 = 100%)
     */
    function withdrawableRatio() public view returns (uint256) {
        uint256 cash = getCash();
        uint256 total = totalAssets();
        if (total == 0) return WAD;
        return (cash * WAD) / total;
    }
    
    function borrowBalanceOf(address account) public view returns (uint256) {
        if (borrowPrincipal[account] == 0) return 0;
        return (borrowPrincipal[account] * borrowIndex) / WAD;
    }
    
    // ============ User Functions ============
    
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
     * @notice Withdraw MIM by burning sMIM - FIXED VERSION
     * @dev If requested amount exceeds available liquidity, withdraws maximum available
     * @param shares Amount of sMIM to burn
     * @return assets Amount of MIM received
     */
    function withdraw(uint256 shares) external nonReentrant returns (uint256 assets) {
        if (shares == 0) revert ZeroAmount();
        
        accrueInterest();
        
        uint256 userShares = balanceOf(msg.sender);
        require(shares <= userShares, "Exceeds balance");
        
        // Calculate theoretical assets for requested shares
        uint256 theoreticalAssets = convertToAssets(shares);
        
        // Get available cash
        uint256 availableCash = getCash();
        
        // Determine actual withdrawal amount
        if (theoreticalAssets <= availableCash) {
            // Full withdrawal possible
            assets = theoreticalAssets;
            _burn(msg.sender, shares);
        } else {
            // Partial withdrawal - cap at available cash
            assets = availableCash;
            
            // Calculate how many shares correspond to available cash
            uint256 actualShares = (assets * totalSupply()) / totalAssets();
            
            // Ensure we don't burn more than requested
            if (actualShares > shares) actualShares = shares;
            
            _burn(msg.sender, actualShares);
            
            emit PartialWithdraw(msg.sender, shares, actualShares, assets);
        }
        
        if (assets == 0) revert InsufficientLiquidity(theoreticalAssets, availableCash);
        
        mim.safeTransfer(msg.sender, assets);
        
        emit Withdraw(msg.sender, assets, shares);
    }
    
    /**
     * @notice Withdraw exact assets amount
     * @param assets Exact amount of MIM to withdraw
     * @return shares Amount of sMIM burned
     */
    function withdrawExact(uint256 assets) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        
        accrueInterest();
        
        uint256 availableCash = getCash();
        if (assets > availableCash) {
            revert InsufficientLiquidity(assets, availableCash);
        }
        
        shares = (assets * totalSupply()) / totalAssets();
        
        uint256 userShares = balanceOf(msg.sender);
        require(shares <= userShares, "Exceeds balance");
        
        _burn(msg.sender, shares);
        mim.safeTransfer(msg.sender, assets);
        
        emit Withdraw(msg.sender, assets, shares);
    }
    
    // ============ Borrower Functions ============
    
    function borrow(uint256 amount) external nonReentrant {
        if (!isBorrower[msg.sender]) revert NotBorrower();
        if (amount == 0) revert ZeroAmount();
        
        accrueInterest();
        
        uint256 newBorrows = totalBorrows + amount;
        uint256 cash = getCash();
        uint256 newUtil = (newBorrows * WAD) / (cash + newBorrows);
        if (newUtil > MAX_UTILIZATION) revert ExceedsMaxUtilization();
        
        if (amount > cash) revert InsufficientLiquidity(amount, cash);
        
        uint256 principalIncrease = (amount * WAD) / borrowIndex;
        borrowPrincipal[msg.sender] += principalIncrease;
        totalBorrows += amount;
        
        mim.safeTransfer(msg.sender, amount);
        
        emit Borrow(msg.sender, amount);
    }
    
    /**
     * @notice Repay borrowed MIM (pulls from caller)
     */
    function repay(uint256 amount) external nonReentrant {
        if (!isBorrower[msg.sender]) revert NotBorrower();
        if (amount == 0) revert ZeroAmount();
        
        accrueInterest();
        
        uint256 borrowBalance = borrowBalanceOf(msg.sender);
        uint256 repayAmount = amount > borrowBalance ? borrowBalance : amount;
        
        uint256 principalDecrease = (repayAmount * WAD) / borrowIndex;
        borrowPrincipal[msg.sender] -= principalDecrease;
        totalBorrows -= repayAmount;
        
        mim.safeTransferFrom(msg.sender, address(this), repayAmount);
        
        emit Repay(msg.sender, repayAmount);
    }
    
    /**
     * @notice Repay borrowed MIM directly (caller already transferred MIM to vault)
     * @dev Use this when MIM has already been transferred to avoid double-transfer
     * @param amount Amount of MIM already transferred to repay
     */
    function repayDirect(uint256 amount) external nonReentrant {
        if (!isBorrower[msg.sender]) revert NotBorrower();
        if (amount == 0) revert ZeroAmount();
        
        accrueInterest();
        
        uint256 borrowBalance = borrowBalanceOf(msg.sender);
        uint256 repayAmount = amount > borrowBalance ? borrowBalance : amount;
        
        uint256 principalDecrease = (repayAmount * WAD) / borrowIndex;
        borrowPrincipal[msg.sender] -= principalDecrease;
        totalBorrows -= repayAmount;
        
        // MIM already in contract - just update accounting
        emit RepayDirect(msg.sender, repayAmount);
    }
    
    // ============ Weekly Interest Payment ============
    
    function payWeeklyInterest(uint256 requestedAmount) external nonReentrant returns (uint256 paidAmount, uint256 shortfall) {
        if (!isBorrower[msg.sender]) revert NotBorrower();
        
        uint256 poolBalance = mim.balanceOf(msg.sender);
        paidAmount = requestedAmount > poolBalance ? poolBalance : requestedAmount;
        shortfall = requestedAmount > paidAmount ? requestedAmount - paidAmount : 0;
        
        if (paidAmount > 0) {
            mim.safeTransferFrom(msg.sender, address(this), paidAmount);
            
            uint256 protocolFee = (paidAmount * PROTOCOL_FEE) / WAD;
            totalReserves += protocolFee;
            
            weeklyPaidInterest += paidAmount;
            
            emit WeeklyInterestPaid(msg.sender, requestedAmount, paidAmount, protocolFee);
        }
        
        return (paidAmount, shortfall);
    }
    
    function startNewWeek() external {
        if (!isWeekComplete()) revert WeekNotComplete();
        
        _snapshotUtilization();
        
        weeklyExpectedInterest = getWeeklyExpectedInterest();
        weeklyPaidInterest = 0;
        weekStartTime = block.timestamp;
        
        emit WeeklyCycleStarted(weekStartTime, weeklyExpectedInterest);
    }
    
    function getPoolWeeklyInterest(address pool) external view returns (uint256) {
        if (borrowPrincipal[pool] == 0) return 0;
        
        uint256 poolDebt = borrowBalanceOf(pool);
        uint256 rate = borrowRate();
        
        return (poolDebt * rate * SECONDS_PER_WEEK) / (SECONDS_PER_YEAR * WAD);
    }
    
    // ============ Utilization Snapshot ============
    
    function snapshotUtilization() external {
        _snapshotUtilization();
    }
    
    function _snapshotUtilization() internal {
        if (block.timestamp < lastSnapshotTime + 1 days) return;
        
        dailyUtilization[currentDayIndex] = utilizationRate();
        
        emit UtilizationSnapshot(currentDayIndex, dailyUtilization[currentDayIndex]);
        
        currentDayIndex = (currentDayIndex + 1) % UTILIZATION_SAMPLES;
        lastSnapshotTime = block.timestamp;
    }
    
    // ============ Internal Functions ============
    
    function accrueInterest() public {
        uint256 timeDelta = block.timestamp - lastAccrualTime;
        if (timeDelta == 0) return;
        
        if (block.timestamp >= lastSnapshotTime + 1 days) {
            _snapshotUtilization();
        }
        
        uint256 currentBorrows = totalBorrows;
        if (currentBorrows == 0) {
            lastAccrualTime = block.timestamp;
            return;
        }
        
        uint256 rate = borrowRate();
        uint256 interestFactor = (rate * timeDelta) / SECONDS_PER_YEAR;
        uint256 interestAccumulated = (currentBorrows * interestFactor) / WAD;
        
        totalBorrows = currentBorrows + interestAccumulated;
        borrowIndex = (borrowIndex * (WAD + interestFactor)) / WAD;
        lastAccrualTime = block.timestamp;
        
        emit InterestAccrued(interestAccumulated, borrowIndex);
    }
    
    /**
     * @notice Rescue any stuck tokens from the contract
     * @param token The token to rescue
     * @param to Recipient address
     * @param amount Amount to rescue (0 for all)
     */
    function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 toTransfer = amount == 0 ? balance : (amount > balance ? balance : amount);
        IERC20(token).safeTransfer(to, toTransfer);
    }
}

