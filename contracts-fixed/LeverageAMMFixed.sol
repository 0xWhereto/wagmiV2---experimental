// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title LeverageAMM - FIXED VERSION
 * @notice Manages 2x leveraged LP positions for zero-IL exposure
 * @dev FIXES APPLIED:
 *   - BUG-005: Added lastWeeklyPayment initialization in constructor
 *   - Added initializeWeeklyPayment() for already deployed contracts
 *   - Improved fee collection and distribution
 */
contract LeverageAMMFixed is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    uint256 public constant WAD = 1e18;
    uint256 public constant TARGET_DTV = 0.50e18;
    uint256 public constant MIN_DTV = 0.40e18;
    uint256 public constant MAX_DTV = 0.60e18;
    uint256 public constant LIQUIDATION_DTV = 0.66e18;
    uint256 public constant REBALANCE_REWARD = 0.001e18;
    uint256 public constant PROTOCOL_FEE = 0.15e18;
    uint256 public constant SECONDS_PER_WEEK = 604_800;

    // ============ State Variables ============

    IERC20 public immutable underlyingAsset;
    IERC20 public immutable mim;
    IMIMStakingVault public immutable stakingVault;
    IV3LPVault public immutable v3LPVault;
    IOracleAdapter public immutable oracle;

    address public wToken;
    uint256 public totalDebt;
    uint256 public totalUnderlying;
    uint256 public lastRebalanceTime;
    uint256 public rebalanceCooldown = 1 hours;

    // Fee & Weekly Payment State
    uint256 public accumulatedFees;
    uint256 public lastWeeklyPayment;
    address public treasury;
    uint256 public pendingWTokenFees;

    // ============ Events ============

    event PositionOpened(uint256 underlyingAmount, uint256 borrowedAmount, uint256 lpValue);
    event PositionClosed(uint256 sharePercent, uint256 underlyingReturned);
    event Rebalanced(bool isDeleverage, uint256 amountAdjusted, uint256 newDTV);
    event WTokenSet(address indexed wToken);
    event RebalanceCooldownSet(uint256 cooldown);
    event FeesCollected(uint256 fee0, uint256 fee1, uint256 totalInMIM);
    event WeeklyInterestPaid(uint256 requested, uint256 paid, uint256 shortfall);
    event ProtocolFeePaid(uint256 amount);
    event WTokenFeesDistributed(uint256 amount);
    event TreasurySet(address indexed treasury);
    event WeeklyPaymentInitialized(uint256 timestamp);

    // ============ Errors ============

    error NotWToken();
    error ZeroAmount();
    error RebalanceNotNeeded();
    error CooldownNotPassed();
    error PositionUnhealthy();
    error AlreadyInitialized();
    error WeekNotComplete();

    // ============ Modifiers ============

    modifier onlyWToken() {
        if (msg.sender != wToken) revert NotWToken();
        _;
    }

    // ============ Constructor ============

    constructor(
        address _underlyingAsset,
        address _mim,
        address _stakingVault,
        address _v3LPVault,
        address _oracle
    ) Ownable(msg.sender) {
        underlyingAsset = IERC20(_underlyingAsset);
        mim = IERC20(_mim);
        stakingVault = IMIMStakingVault(_stakingVault);
        v3LPVault = IV3LPVault(_v3LPVault);
        oracle = IOracleAdapter(_oracle);

        // Approvals
        underlyingAsset.approve(_v3LPVault, type(uint256).max);
        mim.approve(_v3LPVault, type(uint256).max);
        mim.approve(_stakingVault, type(uint256).max);

        // FIX: Initialize weekly payment timer
        lastWeeklyPayment = block.timestamp;
        lastRebalanceTime = block.timestamp;
    }

    // ============ Admin Functions ============

    function setWToken(address _wToken) external onlyOwner {
        wToken = _wToken;
        emit WTokenSet(_wToken);
    }

    function setRebalanceCooldown(uint256 _cooldown) external onlyOwner {
        rebalanceCooldown = _cooldown;
        emit RebalanceCooldownSet(_cooldown);
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Zero address");
        treasury = _treasury;
        emit TreasurySet(_treasury);
    }

    /**
     * @notice Initialize weekly payment timer for already deployed contracts
     * @dev Can only be called once when lastWeeklyPayment == 0
     */
    function initializeWeeklyPayment() external onlyOwner {
        if (lastWeeklyPayment != 0) revert AlreadyInitialized();
        lastWeeklyPayment = block.timestamp;
        emit WeeklyPaymentInitialized(block.timestamp);
    }

    // ============ View Functions ============

    function getPrice() external view returns (uint256) {
        return oracle.getPrice();
    }

    function getTotalLPValue() public view returns (uint256) {
        (uint256 amount0, uint256 amount1) = v3LPVault.getTotalAssets();
        uint256 price = oracle.getPrice();
        return (amount0 * price / WAD) + amount1;
    }

    function getTotalDebt() external view returns (uint256) {
        return totalDebt;
    }

    function getCurrentDTV() public view returns (uint256) {
        uint256 lpValue = getTotalLPValue();
        if (lpValue == 0) return 0;
        return (totalDebt * WAD) / lpValue;
    }

    function getEquity() public view returns (uint256) {
        uint256 lpValue = getTotalLPValue();
        if (lpValue <= totalDebt) return 0;
        return lpValue - totalDebt;
    }

    function checkRebalance() external view returns (bool needsRebalance, bool isDeleverage) {
        uint256 currentDTV = getCurrentDTV();

        if (currentDTV < MIN_DTV) {
            return (true, false);
        } else if (currentDTV > MAX_DTV) {
            return (true, true);
        }

        return (false, false);
    }

    function calculateRebalanceAmount() public view returns (uint256 amount, bool isDeleverage) {
        uint256 lpValue = getTotalLPValue();
        uint256 targetDebt = (lpValue * TARGET_DTV) / WAD;

        if (totalDebt > targetDebt) {
            amount = totalDebt - targetDebt;
            isDeleverage = true;
        } else {
            amount = targetDebt - totalDebt;
            isDeleverage = false;
        }
    }

    function isWeeklyPaymentDue() external view returns (bool) {
        return block.timestamp >= lastWeeklyPayment + SECONDS_PER_WEEK;
    }

    function getExpectedWeeklyInterest() external view returns (uint256) {
        return stakingVault.getPoolWeeklyInterest(address(this));
    }

    function canPayFullInterest() external view returns (bool, uint256 shortfall) {
        uint256 expected = stakingVault.getPoolWeeklyInterest(address(this));
        uint256 available = accumulatedFees + mim.balanceOf(address(this));

        if (available >= expected) {
            return (true, 0);
        }
        return (false, expected - available);
    }

    // ============ Position Management ============

    function openPosition(uint256 underlyingAmount) external onlyWToken nonReentrant {
        if (underlyingAmount == 0) revert ZeroAmount();

        underlyingAsset.safeTransferFrom(msg.sender, address(this), underlyingAmount);

        uint256 price = oracle.getPrice();
        uint256 underlyingValue = (underlyingAmount * price) / WAD;
        uint256 borrowAmount = underlyingValue;

        stakingVault.borrow(borrowAmount);
        totalDebt += borrowAmount;

        v3LPVault.addLiquidity(
            underlyingAmount,
            borrowAmount,
            0,
            0
        );

        totalUnderlying += underlyingAmount;

        emit PositionOpened(underlyingAmount, borrowAmount, underlyingValue * 2);
    }

    function closePosition(
        uint256 shares,
        uint256 totalShares
    ) external onlyWToken nonReentrant returns (uint256 underlyingReturned) {
        if (shares == 0) revert ZeroAmount();

        uint256 withdrawPercent = (shares * WAD) / totalShares;

        (uint256 amount0, uint256 amount1) = v3LPVault.removeLiquidity(
            (withdrawPercent * 10000) / WAD,
            0,
            0
        );

        uint256 debtToRepay = (totalDebt * withdrawPercent) / WAD;

        if (amount1 >= debtToRepay) {
            mim.safeTransfer(address(stakingVault), debtToRepay);
            stakingVault.repay(debtToRepay);

            uint256 remainingMIM = amount1 - debtToRepay;
            if (remainingMIM > 0) {
                uint256 price = oracle.getPrice();
                underlyingReturned = amount0 + (remainingMIM * WAD / price);
            } else {
                underlyingReturned = amount0;
            }
        } else {
            uint256 mimShortfall = debtToRepay - amount1;
            uint256 price = oracle.getPrice();
            uint256 underlyingNeeded = (mimShortfall * WAD / price);

            underlyingReturned = amount0 - underlyingNeeded;

            mim.safeTransfer(address(stakingVault), debtToRepay);
            stakingVault.repay(debtToRepay);
        }

        totalDebt -= debtToRepay;
        totalUnderlying -= (totalUnderlying * withdrawPercent) / WAD;

        underlyingAsset.safeTransfer(msg.sender, underlyingReturned);

        emit PositionClosed(withdrawPercent, underlyingReturned);
    }

    function rebalance() external nonReentrant {
        if (block.timestamp < lastRebalanceTime + rebalanceCooldown) {
            revert CooldownNotPassed();
        }

        (uint256 amount, bool isDeleverage) = calculateRebalanceAmount();
        if (amount == 0) revert RebalanceNotNeeded();

        if (isDeleverage) {
            _deleverage(amount);
        } else {
            _addLeverage(amount);
        }

        lastRebalanceTime = block.timestamp;

        uint256 reward = (amount * REBALANCE_REWARD) / WAD;
        if (reward > 0 && mim.balanceOf(address(this)) >= reward) {
            mim.safeTransfer(msg.sender, reward);
        }

        emit Rebalanced(isDeleverage, amount, getCurrentDTV());
    }

    // ============ Internal Functions ============

    function _deleverage(uint256 repayAmount) internal {
        uint256 lpValue = getTotalLPValue();
        uint256 percentToRemove = (repayAmount * WAD * 10000) / lpValue / WAD;

        (uint256 amount0, uint256 amount1) = v3LPVault.removeLiquidity(
            percentToRemove,
            0,
            0
        );

        uint256 actualRepay = amount1 > repayAmount ? repayAmount : amount1;
        mim.safeTransfer(address(stakingVault), actualRepay);
        stakingVault.repay(actualRepay);
        totalDebt -= actualRepay;

        if (amount0 > 0) {
            v3LPVault.addLiquidity(amount0, 0, 0, 0);
        }
    }

    function _addLeverage(uint256 borrowAmount) internal {
        stakingVault.borrow(borrowAmount);
        totalDebt += borrowAmount;
        v3LPVault.addLiquidity(0, borrowAmount, 0, 0);
    }

    // ============ Weekly Fee Payment System ============

    function collectAllFees() public nonReentrant returns (uint256 totalFeesInMIM) {
        (uint256 fee0, uint256 fee1) = v3LPVault.collectFees();

        uint256 price = oracle.getPrice();
        uint256 fee0InMIM = (fee0 * price) / WAD;

        totalFeesInMIM = fee0InMIM + fee1;
        accumulatedFees += totalFeesInMIM;

        emit FeesCollected(fee0, fee1, totalFeesInMIM);
    }

    function payWeeklyInterest() external nonReentrant {
        if (block.timestamp < lastWeeklyPayment + SECONDS_PER_WEEK) {
            revert WeekNotComplete();
        }

        collectAllFees();

        uint256 expectedInterest = stakingVault.getPoolWeeklyInterest(address(this));

        uint256 availableToPay = accumulatedFees;
        uint256 actualPayment = expectedInterest > availableToPay ? availableToPay : expectedInterest;
        uint256 shortfall = expectedInterest > actualPayment ? expectedInterest - actualPayment : 0;

        if (actualPayment > 0) {
            mim.approve(address(stakingVault), actualPayment);
            stakingVault.payWeeklyInterest(actualPayment);
            accumulatedFees -= actualPayment;
        }

        emit WeeklyInterestPaid(expectedInterest, actualPayment, shortfall);

        if (accumulatedFees > 0) {
            uint256 protocolFee = (accumulatedFees * PROTOCOL_FEE) / WAD;
            uint256 toWTokenHolders = accumulatedFees - protocolFee;

            if (protocolFee > 0 && treasury != address(0)) {
                mim.safeTransfer(treasury, protocolFee);
                emit ProtocolFeePaid(protocolFee);
            }

            pendingWTokenFees += toWTokenHolders;
            emit WTokenFeesDistributed(toWTokenHolders);

            accumulatedFees = 0;
        }

        lastWeeklyPayment = block.timestamp;
    }

    // ============ Emergency Functions ============

    function emergencyDeleverage() external onlyOwner {
        uint256 currentDTV = getCurrentDTV();
        require(currentDTV > LIQUIDATION_DTV, "Position is healthy");

        (uint256 amount0, uint256 amount1) = v3LPVault.removeLiquidity(10000, 0, 0);

        uint256 repayAmount = amount1 > totalDebt ? totalDebt : amount1;
        mim.safeTransfer(address(stakingVault), repayAmount);
        stakingVault.repay(repayAmount);
        totalDebt -= repayAmount;
    }
}

// ============ Interfaces ============

interface IMIMStakingVault {
    function borrow(uint256 amount) external;
    function repay(uint256 amount) external;
    function payWeeklyInterest(uint256 amount) external returns (uint256 paid, uint256 shortfall);
    function getPoolWeeklyInterest(address pool) external view returns (uint256);
}

interface IV3LPVault {
    function addLiquidity(
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min
    ) external returns (uint128 liquidity);

    function removeLiquidity(
        uint256 liquidityPercent,
        uint256 amount0Min,
        uint256 amount1Min
    ) external returns (uint256 amount0, uint256 amount1);

    function getTotalAssets() external view returns (uint256 amount0, uint256 amount1);

    function collectFees() external returns (uint256 fee0, uint256 fee1);
}

interface IOracleAdapter {
    function getPrice() external view returns (uint256);
}
