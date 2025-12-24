// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MIMStakingVaultComplete
 * @notice Stake MIM to receive sMIM (interest-bearing)
 * @dev FIXES APPLIED:
 *   - BUG-005: Fixed withdrawal to cap at available liquidity
 *   - Changed fee cycle from 7 days to 7 hours for testing
 *   - Proper initialization of lastWeeklyPayment
 *   - Added maxWithdrawable functions
 */
contract MIMStakingVaultComplete is ERC20, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    uint256 public constant WAD = 1e18;

    // TESTING: 7 hours instead of 7 days
    uint256 public constant SECONDS_PER_CYCLE = 7 hours; // Changed from 7 days
    uint256 public constant SECONDS_PER_YEAR = 365 days;

    // Interest rate model parameters
    uint256 public constant BASE_RATE = 0.10e18;      // 10% base rate
    uint256 public constant MULTIPLIER = 0.12e18;     // 12% multiplier
    uint256 public constant JUMP_MULTIPLIER = 1.0e18; // 100% jump multiplier
    uint256 public constant KINK = 0.80e18;           // 80% kink

    // Fee parameters
    uint256 public constant PROTOCOL_FEE = 0.15e18;   // 15% protocol fee

    // ============ State Variables ============

    /// @notice MIM token
    IERC20 public immutable mim;

    /// @notice Treasury address for protocol fees
    address public treasury;

    /// @notice Total MIM borrowed by LeverageAMM
    uint256 public totalBorrows;

    /// @notice Total reserves (protocol profit)
    uint256 public totalReserves;

    /// @notice Accrued interest index
    uint256 public borrowIndex;

    /// @notice Last time interest was accrued
    uint256 public lastAccrualTime;

    /// @notice Last fee cycle payment time
    uint256 public lastCyclePayment;

    /// @notice Authorized borrowers (LeverageAMM)
    mapping(address => bool) public isBorrower;

    /// @notice Per-borrower debt
    mapping(address => uint256) public borrowerDebt;

    // ============ Events ============

    event Deposit(address indexed user, uint256 assets, uint256 shares);
    event Withdraw(address indexed user, uint256 shares, uint256 assets);
    event PartialWithdraw(address indexed user, uint256 requestedShares, uint256 actualShares, uint256 assets);
    event Borrow(address indexed borrower, uint256 amount);
    event Repay(address indexed borrower, uint256 amount);
    event InterestAccrued(uint256 interestAccumulated, uint256 newBorrowIndex);
    event CyclePayment(uint256 interest, uint256 protocolFee);
    event BorrowerSet(address indexed borrower, bool authorized);
    event TreasurySet(address indexed treasury);

    // ============ Constructor ============

    constructor(
        address _mim,
        address _treasury
    ) ERC20("Staked MIM", "sMIM") Ownable(msg.sender) {
        mim = IERC20(_mim);
        treasury = _treasury;
        borrowIndex = WAD;
        lastAccrualTime = block.timestamp;
        lastCyclePayment = block.timestamp; // FIX: Initialize properly!
    }

    // ============ Admin Functions ============

    function setBorrower(address _borrower, bool _authorized) external onlyOwner {
        isBorrower[_borrower] = _authorized;
        emit BorrowerSet(_borrower, _authorized);
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
        emit TreasurySet(_treasury);
    }

    // ============ View Functions ============

    /**
     * @notice Get available cash (MIM not borrowed)
     */
    function getCash() public view returns (uint256) {
        return mim.balanceOf(address(this));
    }

    /**
     * @notice Alias for getCash - available liquid assets
     */
    function liquidAssets() public view returns (uint256) {
        return getCash();
    }

    /**
     * @notice Total assets under management
     */
    function totalAssets() public view returns (uint256) {
        return getCash() + totalBorrows;
    }

    /**
     * @notice Current utilization rate (WAD format)
     */
    function utilizationRate() public view returns (uint256) {
        uint256 _totalAssets = totalAssets();
        if (_totalAssets == 0) return 0;
        return (totalBorrows * WAD) / _totalAssets;
    }

    /**
     * @notice Current borrow rate (WAD format, per year)
     */
    function borrowRate() public view returns (uint256) {
        uint256 util = utilizationRate();
        if (util <= KINK) {
            return BASE_RATE + (util * MULTIPLIER) / WAD;
        } else {
            uint256 normalRate = BASE_RATE + (KINK * MULTIPLIER) / WAD;
            uint256 excessUtil = util - KINK;
            return normalRate + (excessUtil * JUMP_MULTIPLIER) / WAD;
        }
    }

    /**
     * @notice Current supply rate (what stakers earn)
     */
    function supplyRate() public view returns (uint256) {
        uint256 util = utilizationRate();
        uint256 _borrowRate = borrowRate();
        return (_borrowRate * util * (WAD - PROTOCOL_FEE)) / (WAD * WAD);
    }

    /**
     * @notice Convert shares to assets
     */
    function convertToAssets(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return shares;
        return (shares * totalAssets()) / supply;
    }

    /**
     * @notice Convert assets to shares
     */
    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply();
        uint256 _totalAssets = totalAssets();
        if (supply == 0 || _totalAssets == 0) return assets;
        return (assets * supply) / _totalAssets;
    }

    /**
     * @notice Maximum shares user can withdraw (limited by liquidity)
     */
    function maxWithdrawableShares(address user) public view returns (uint256) {
        uint256 userShares = balanceOf(user);
        if (userShares == 0) return 0;

        uint256 cash = getCash();
        uint256 _totalAssets = totalAssets();
        uint256 supply = totalSupply();

        if (_totalAssets == 0 || supply == 0) return 0;

        // Max shares that can be redeemed based on liquidity
        uint256 maxRedeemable = (cash * supply) / _totalAssets;

        return userShares < maxRedeemable ? userShares : maxRedeemable;
    }

    /**
     * @notice Maximum assets user can withdraw (limited by liquidity)
     */
    function maxWithdrawableAssets(address user) public view returns (uint256) {
        return convertToAssets(maxWithdrawableShares(user));
    }

    /**
     * @notice Ratio of position that can be withdrawn (WAD format)
     */
    function withdrawableRatio() public view returns (uint256) {
        uint256 _totalAssets = totalAssets();
        if (_totalAssets == 0) return WAD;
        return (getCash() * WAD) / _totalAssets;
    }

    /**
     * @notice Check if fee cycle payment is due
     */
    function isCyclePaymentDue() public view returns (bool) {
        return block.timestamp >= lastCyclePayment + SECONDS_PER_CYCLE;
    }

    /**
     * @notice Time until next cycle payment
     */
    function timeUntilNextCycle() public view returns (uint256) {
        uint256 nextCycle = lastCyclePayment + SECONDS_PER_CYCLE;
        if (block.timestamp >= nextCycle) return 0;
        return nextCycle - block.timestamp;
    }

    // ============ User Functions ============

    /**
     * @notice Deposit MIM and receive sMIM shares
     * @param assets Amount of MIM to deposit
     * @return shares Amount of sMIM received
     */
    function deposit(uint256 assets) external nonReentrant returns (uint256 shares) {
        require(assets > 0, "Zero amount");

        accrueInterest();

        shares = convertToShares(assets);
        require(shares > 0, "Zero shares");

        mim.safeTransferFrom(msg.sender, address(this), assets);
        _mint(msg.sender, shares);

        emit Deposit(msg.sender, assets, shares);
    }

    /**
     * @notice Withdraw MIM by burning sMIM shares
     * @dev FIX: Caps withdrawal at available liquidity
     * @param shares Amount of sMIM to burn
     * @return assets Amount of MIM received
     */
    function withdraw(uint256 shares) external nonReentrant returns (uint256 assets) {
        require(shares > 0, "Zero shares");
        require(balanceOf(msg.sender) >= shares, "Insufficient shares");

        accrueInterest();

        // Calculate theoretical assets for requested shares
        uint256 theoreticalAssets = convertToAssets(shares);
        uint256 availableCash = getCash();

        if (theoreticalAssets <= availableCash) {
            // Full withdrawal possible
            assets = theoreticalAssets;
            _burn(msg.sender, shares);
        } else {
            // FIX: Partial withdrawal - cap at available cash
            assets = availableCash;
            uint256 actualShares = convertToShares(assets);
            require(actualShares > 0, "Cannot withdraw");
            _burn(msg.sender, actualShares);
            emit PartialWithdraw(msg.sender, shares, actualShares, assets);
        }

        mim.safeTransfer(msg.sender, assets);
        emit Withdraw(msg.sender, shares, assets);
    }

    /**
     * @notice Withdraw exact amount of MIM
     * @param assets Exact amount of MIM to withdraw
     */
    function withdrawExact(uint256 assets) external nonReentrant returns (uint256 shares) {
        require(assets > 0, "Zero amount");
        require(assets <= getCash(), "Insufficient liquidity");

        accrueInterest();

        shares = convertToShares(assets);
        require(balanceOf(msg.sender) >= shares, "Insufficient shares");

        _burn(msg.sender, shares);
        mim.safeTransfer(msg.sender, assets);

        emit Withdraw(msg.sender, shares, assets);
    }

    // ============ Borrower Functions ============

    /**
     * @notice Borrow MIM (only authorized borrowers)
     */
    function borrow(uint256 amount) external nonReentrant {
        require(isBorrower[msg.sender], "Not authorized");
        require(amount <= getCash(), "Insufficient liquidity");

        accrueInterest();

        totalBorrows += amount;
        borrowerDebt[msg.sender] += amount;

        mim.safeTransfer(msg.sender, amount);
        emit Borrow(msg.sender, amount);
    }

    /**
     * @notice Repay borrowed MIM
     */
    function repay(uint256 amount) external nonReentrant {
        require(isBorrower[msg.sender], "Not authorized");

        accrueInterest();

        uint256 debt = borrowerDebt[msg.sender];
        uint256 repayAmount = amount > debt ? debt : amount;

        mim.safeTransferFrom(msg.sender, address(this), repayAmount);

        totalBorrows -= repayAmount;
        borrowerDebt[msg.sender] -= repayAmount;

        emit Repay(msg.sender, repayAmount);
    }

    // ============ Interest Functions ============

    /**
     * @notice Accrue interest to borrows
     */
    function accrueInterest() public {
        uint256 currentTime = block.timestamp;
        uint256 timeDelta = currentTime - lastAccrualTime;

        if (timeDelta == 0) return;

        uint256 _borrowRate = borrowRate();
        uint256 interestFactor = (_borrowRate * timeDelta) / SECONDS_PER_YEAR;
        uint256 interestAccumulated = (totalBorrows * interestFactor) / WAD;

        borrowIndex = borrowIndex + (borrowIndex * interestFactor) / WAD;
        totalBorrows += interestAccumulated;

        // Protocol fee goes to reserves
        uint256 protocolShare = (interestAccumulated * PROTOCOL_FEE) / WAD;
        totalReserves += protocolShare;

        lastAccrualTime = currentTime;

        emit InterestAccrued(interestAccumulated, borrowIndex);
    }

    /**
     * @notice Process cycle payment (keeper function)
     * @dev Can be called by anyone when cycle is due
     */
    function processCyclePayment() external {
        require(isCyclePaymentDue(), "Cycle not due");

        accrueInterest();

        // Calculate interest for the cycle
        uint256 cycleInterest = (totalBorrows * borrowRate() * SECONDS_PER_CYCLE) / (SECONDS_PER_YEAR * WAD);

        // Protocol fee
        uint256 protocolFee = (cycleInterest * PROTOCOL_FEE) / WAD;

        // Transfer protocol fee to treasury
        if (protocolFee > 0 && getCash() >= protocolFee) {
            mim.safeTransfer(treasury, protocolFee);
            totalReserves -= protocolFee;
        }

        lastCyclePayment = block.timestamp;

        emit CyclePayment(cycleInterest, protocolFee);
    }

    // ============ Emergency Functions ============

    /**
     * @notice Emergency rescue tokens (owner only)
     */
    function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
        require(token != address(mim) || amount <= totalReserves, "Cannot rescue user funds");
        IERC20(token).safeTransfer(to, amount);
    }
}
