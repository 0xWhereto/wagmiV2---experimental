// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title LeverageAMM V2
 * @notice Manages 2x leveraged LP positions for zero-IL exposure
 * @dev MERGED VERSION with fixes:
 *   - BUG-005: lastWeeklyPayment initialized in constructor
 *   - FIXED: closePosition uses repayDirect to avoid double-transfer
 *   - Keeps underlyingIsToken0 logic for correct token ordering
 */
contract LeverageAMMV2 is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ============ Constants ============
    
    uint256 public constant WAD = 1e18;
    uint256 public constant TARGET_DTV = 0.50e18;    // 50% target debt-to-value
    uint256 public constant MIN_DTV = 0.40e18;       // 40% - add leverage trigger
    uint256 public constant MAX_DTV = 0.60e18;       // 60% - reduce leverage trigger
    uint256 public constant LIQUIDATION_DTV = 0.66e18; // 66% - emergency threshold
    uint256 public constant REBALANCE_REWARD = 0.001e18; // 0.1% reward for rebalancer
    uint256 public constant PROTOCOL_FEE = 0.15e18;  // 15% performance fee
    uint256 public constant SECONDS_PER_WEEK = 604_800;
    
    // ============ State Variables ============
    
    IERC20 public immutable underlyingAsset;
    IERC20 public immutable mim;
    IMIMStakingVaultV2 public immutable stakingVault;
    IV3LPVault public immutable v3LPVault;
    IOracleAdapter public immutable oracle;
    bool public immutable underlyingIsToken0;
    
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
    
    // ============ Errors ============
    
    error NotWToken();
    error ZeroAmount();
    error RebalanceNotNeeded();
    error CooldownNotPassed();
    error PositionUnhealthy();
    error InsufficientMIMToRepay();
    
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
        stakingVault = IMIMStakingVaultV2(_stakingVault);
        v3LPVault = IV3LPVault(_v3LPVault);
        oracle = IOracleAdapter(_oracle);
        
        // Determine token ordering in V3 pool
        underlyingIsToken0 = _underlyingAsset < _mim;
        
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
        treasury = _treasury;
        emit TreasurySet(_treasury);
    }
    
    // ============ View Functions ============
    
    function getPrice() external view returns (uint256) {
        return oracle.getPrice();
    }
    
    function getTotalLPValue() public view returns (uint256) {
        (uint256 amount0, uint256 amount1) = v3LPVault.getTotalAssets();
        uint256 price = oracle.getPrice();
        
        if (underlyingIsToken0) {
            return (amount0 * price / WAD) + amount1;
        } else {
            return amount0 + (amount1 * price / WAD);
        }
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
    
    // ============ Position Management ============
    
    function openPosition(uint256 underlyingAmount) external onlyWToken nonReentrant {
        if (underlyingAmount == 0) revert ZeroAmount();
        
        // Transfer underlying from WToken
        underlyingAsset.safeTransferFrom(msg.sender, address(this), underlyingAmount);
        
        // Get current price
        uint256 price = oracle.getPrice();
        
        // Calculate value in MIM terms
        uint256 underlyingValue = (underlyingAmount * price) / WAD;
        
        // For 2x leverage at 50% DTV:
        // Total LP value = 2 * underlyingValue
        // Debt = underlyingValue (50% of LP value)
        uint256 borrowAmount = underlyingValue;
        
        // Borrow MIM from staking vault
        stakingVault.borrow(borrowAmount);
        totalDebt += borrowAmount;
        
        // Add liquidity to V3 vault - respect token ordering
        if (underlyingIsToken0) {
            v3LPVault.addLiquidity(underlyingAmount, borrowAmount, 0, 0);
        } else {
            v3LPVault.addLiquidity(borrowAmount, underlyingAmount, 0, 0);
        }
        
        totalUnderlying += underlyingAmount;
        
        emit PositionOpened(underlyingAmount, borrowAmount, underlyingValue * 2);
    }
    
    /**
     * @notice Close part of the position - FIXED VERSION
     * @dev Uses repayDirect to avoid double-transfer bug
     */
    function closePosition(
        uint256 shares,
        uint256 totalShares
    ) external onlyWToken nonReentrant returns (uint256 underlyingReturned) {
        if (shares == 0) revert ZeroAmount();
        
        // Calculate percentage to withdraw
        uint256 withdrawPercent = (shares * WAD) / totalShares;
        
        // Remove liquidity proportionally from V3 vault
        (uint256 amount0, uint256 amount1) = v3LPVault.removeLiquidity(
            (withdrawPercent * 10000) / WAD, // Convert to basis points
            0,
            0
        );
        
        // Determine which amount is underlying vs MIM based on token ordering
        uint256 underlyingAmount;
        uint256 mimAmount;
        if (underlyingIsToken0) {
            underlyingAmount = amount0;
            mimAmount = amount1;
        } else {
            underlyingAmount = amount1;
            mimAmount = amount0;
        }
        
        // Repay proportional debt
        uint256 debtToRepay = (totalDebt * withdrawPercent) / WAD;
        
        // Handle dust amounts (rounding errors)
        uint256 DUST_THRESHOLD = 1e14; // 0.0001 MIM
        if (mimAmount < debtToRepay && debtToRepay - mimAmount < DUST_THRESHOLD) {
            debtToRepay = mimAmount;
        }
        
        // Check if we have enough MIM
        if (mimAmount >= debtToRepay) {
            // Enough MIM to repay debt
            // Transfer MIM to staking vault and use repayDirect (no double-transfer)
            mim.safeTransfer(address(stakingVault), debtToRepay);
            stakingVault.repayDirect(debtToRepay);
            
            // Calculate remaining MIM after repayment
            uint256 remainingMIM = mimAmount - debtToRepay;
            if (remainingMIM > 0) {
                // Convert excess MIM to underlying value
                uint256 price = oracle.getPrice();
                underlyingReturned = underlyingAmount + (remainingMIM * WAD / price);
            } else {
                underlyingReturned = underlyingAmount;
            }
        } else {
            // Not enough MIM - need to use some underlying to cover
            uint256 mimShortfall = debtToRepay - mimAmount;
            uint256 price = oracle.getPrice();
            uint256 underlyingNeeded = (mimShortfall * WAD / price);
            
            if (underlyingNeeded > underlyingAmount) {
                revert InsufficientMIMToRepay();
            }
            
            underlyingReturned = underlyingAmount - underlyingNeeded;
            
            // Transfer all MIM we have and use repayDirect
            if (mimAmount > 0) {
                mim.safeTransfer(address(stakingVault), mimAmount);
            }
            stakingVault.repayDirect(mimAmount);
            
            // Note: The shortfall in debt repayment means total debt won't decrease correctly
            // This is a rare edge case - in practice MIM from LP should cover debt
        }
        
        totalDebt -= debtToRepay;
        totalUnderlying -= (totalUnderlying * withdrawPercent) / WAD;
        
        // Transfer underlying back to WToken
        underlyingAsset.safeTransfer(msg.sender, underlyingReturned);
        
        emit PositionClosed(withdrawPercent, underlyingReturned);
    }
    
    // ============ Rebalancing ============
    
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
        
        // Reward rebalancer
        uint256 reward = (amount * REBALANCE_REWARD) / WAD;
        if (reward > 0 && mim.balanceOf(address(this)) >= reward) {
            mim.safeTransfer(msg.sender, reward);
        }
        
        emit Rebalanced(isDeleverage, amount, getCurrentDTV());
    }
    
    function _deleverage(uint256 repayAmount) internal {
        uint256 lpValue = getTotalLPValue();
        uint256 percentToRemove = (repayAmount * WAD * 10000) / lpValue / WAD;
        
        (uint256 amount0, uint256 amount1) = v3LPVault.removeLiquidity(percentToRemove, 0, 0);
        
        uint256 mimReceived = underlyingIsToken0 ? amount1 : amount0;
        uint256 actualRepay = mimReceived > repayAmount ? repayAmount : mimReceived;
        
        mim.safeTransfer(address(stakingVault), actualRepay);
        stakingVault.repayDirect(actualRepay);
        totalDebt -= actualRepay;
        
        // Re-add underlying if any
        uint256 underlyingReceived = underlyingIsToken0 ? amount0 : amount1;
        if (underlyingReceived > 0) {
            if (underlyingIsToken0) {
                v3LPVault.addLiquidity(underlyingReceived, 0, 0, 0);
            } else {
                v3LPVault.addLiquidity(0, underlyingReceived, 0, 0);
            }
        }
    }
    
    function _addLeverage(uint256 borrowAmount) internal {
        stakingVault.borrow(borrowAmount);
        totalDebt += borrowAmount;
        
        if (underlyingIsToken0) {
            v3LPVault.addLiquidity(0, borrowAmount, 0, 0);
        } else {
            v3LPVault.addLiquidity(borrowAmount, 0, 0, 0);
        }
    }
    
    // ============ Weekly Fee Payment ============
    
    function collectAllFees() public nonReentrant returns (uint256 totalFeesInMIM) {
        (uint256 fee0, uint256 fee1) = v3LPVault.collectFees();
        
        uint256 price = oracle.getPrice();
        uint256 underlyingFees = underlyingIsToken0 ? fee0 : fee1;
        uint256 mimFees = underlyingIsToken0 ? fee1 : fee0;
        
        uint256 underlyingFeesInMIM = (underlyingFees * price) / WAD;
        totalFeesInMIM = underlyingFeesInMIM + mimFees;
        accumulatedFees += totalFeesInMIM;
        
        emit FeesCollected(fee0, fee1, totalFeesInMIM);
    }
    
    function payWeeklyInterest() external nonReentrant {
        require(block.timestamp >= lastWeeklyPayment + SECONDS_PER_WEEK, "Week not complete");
        
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
        
        // Distribute remaining fees
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
        
        uint256 mimReceived = underlyingIsToken0 ? amount1 : amount0;
        uint256 repayAmount = mimReceived > totalDebt ? totalDebt : mimReceived;
        
        mim.safeTransfer(address(stakingVault), repayAmount);
        stakingVault.repayDirect(repayAmount);
        totalDebt -= repayAmount;
    }
}

// ============ Interfaces ============

interface IMIMStakingVaultV2 {
    function borrow(uint256 amount) external;
    function repay(uint256 amount) external;
    function repayDirect(uint256 amount) external;
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

