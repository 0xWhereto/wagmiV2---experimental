// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title LeverageAMM
 * @notice Manages 2x leveraged LP positions for zero-IL exposure
 * @dev Borrows MIM to create leveraged positions, maintains 50% DTV
 */
contract LeverageAMM is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ============ Constants ============
    
    uint256 public constant WAD = 1e18;
    uint256 public constant TARGET_DTV = 0.50e18;    // 50% target debt-to-value
    uint256 public constant MIN_DTV = 0.40e18;       // 40% - add leverage trigger
    uint256 public constant MAX_DTV = 0.60e18;       // 60% - reduce leverage trigger
    uint256 public constant LIQUIDATION_DTV = 0.66e18; // 66% - emergency threshold
    uint256 public constant REBALANCE_REWARD = 0.001e18; // 0.1% reward for rebalancer
    
    // ============ State Variables ============
    
    /// @notice The underlying asset (WETH, WBTC)
    IERC20 public immutable underlyingAsset;
    
    /// @notice MIM stablecoin
    IERC20 public immutable mim;
    
    /// @notice MIM Staking Vault for borrowing
    IMIMStakingVault public immutable stakingVault;
    
    /// @notice V3 LP Vault for liquidity positions
    IV3LPVault public immutable v3LPVault;
    
    /// @notice Oracle for price feeds
    IOracleAdapter public immutable oracle;
    
    /// @notice Authorized WToken contract
    address public wToken;
    
    /// @notice Total debt borrowed from staking vault
    uint256 public totalDebt;
    
    /// @notice Total underlying deposited
    uint256 public totalUnderlying;
    
    /// @notice Last rebalance timestamp
    uint256 public lastRebalanceTime;
    
    /// @notice Minimum time between rebalances
    uint256 public rebalanceCooldown = 1 hours;
    
    // ============ Events ============
    
    event PositionOpened(uint256 underlyingAmount, uint256 borrowedAmount, uint256 lpValue);
    event PositionClosed(uint256 sharePercent, uint256 underlyingReturned);
    event Rebalanced(bool isDeleverage, uint256 amountAdjusted, uint256 newDTV);
    event WTokenSet(address indexed wToken);
    event RebalanceCooldownSet(uint256 cooldown);
    
    // ============ Errors ============
    
    error NotWToken();
    error ZeroAmount();
    error RebalanceNotNeeded();
    error CooldownNotPassed();
    error PositionUnhealthy();
    
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
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Set the authorized WToken contract
     */
    function setWToken(address _wToken) external onlyOwner {
        wToken = _wToken;
        emit WTokenSet(_wToken);
    }
    
    /**
     * @notice Set rebalance cooldown
     */
    function setRebalanceCooldown(uint256 _cooldown) external onlyOwner {
        rebalanceCooldown = _cooldown;
        emit RebalanceCooldownSet(_cooldown);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get current underlying price from oracle
     * @return Price in MIM terms (18 decimals)
     */
    function getPrice() external view returns (uint256) {
        return oracle.getPrice();
    }
    
    /**
     * @notice Get total value of LP positions
     * @return Value in MIM terms
     */
    function getTotalLPValue() public view returns (uint256) {
        (uint256 amount0, uint256 amount1) = v3LPVault.getTotalAssets();
        uint256 price = oracle.getPrice();
        
        // Assuming token0 is underlying, token1 is MIM
        return (amount0 * price / WAD) + amount1;
    }
    
    /**
     * @notice Get total debt owed
     */
    function getTotalDebt() external view returns (uint256) {
        return totalDebt;
    }
    
    /**
     * @notice Get current debt-to-value ratio
     * @return DTV ratio (18 decimals)
     */
    function getCurrentDTV() public view returns (uint256) {
        uint256 lpValue = getTotalLPValue();
        if (lpValue == 0) return 0;
        return (totalDebt * WAD) / lpValue;
    }
    
    /**
     * @notice Get equity (LP value - debt)
     * @return Equity in MIM terms
     */
    function getEquity() public view returns (uint256) {
        uint256 lpValue = getTotalLPValue();
        if (lpValue <= totalDebt) return 0;
        return lpValue - totalDebt;
    }
    
    /**
     * @notice Check if rebalancing is needed
     * @return needsRebalance Whether rebalancing is needed
     * @return isDeleverage Whether to deleverage (true) or add leverage (false)
     */
    function checkRebalance() external view returns (bool needsRebalance, bool isDeleverage) {
        uint256 currentDTV = getCurrentDTV();
        
        if (currentDTV < MIN_DTV) {
            // Price went up, need to borrow more (add leverage)
            return (true, false);
        } else if (currentDTV > MAX_DTV) {
            // Price went down, need to repay (deleverage)
            return (true, true);
        }
        
        return (false, false);
    }
    
    /**
     * @notice Calculate amount needed to rebalance to target DTV
     * @return amount Amount to borrow or repay
     * @return isDeleverage Whether to repay (true) or borrow (false)
     */
    function calculateRebalanceAmount() public view returns (uint256 amount, bool isDeleverage) {
        uint256 currentDTV = getCurrentDTV();
        uint256 lpValue = getTotalLPValue();
        
        // Target debt = lpValue * TARGET_DTV
        uint256 targetDebt = (lpValue * TARGET_DTV) / WAD;
        
        if (totalDebt > targetDebt) {
            // Need to repay
            amount = totalDebt - targetDebt;
            isDeleverage = true;
        } else {
            // Need to borrow more
            amount = targetDebt - totalDebt;
            isDeleverage = false;
        }
    }
    
    // ============ Position Management ============
    
    /**
     * @notice Open a leveraged position
     * @param underlyingAmount Amount of underlying asset deposited
     */
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
        
        // Add liquidity to V3 vault
        // Half in underlying, half in MIM
        v3LPVault.addLiquidity(
            underlyingAmount,
            borrowAmount,
            0, // No slippage protection for internal tx
            0
        );
        
        totalUnderlying += underlyingAmount;
        
        emit PositionOpened(underlyingAmount, borrowAmount, underlyingValue * 2);
    }
    
    /**
     * @notice Close part of the position
     * @param shares Number of shares being redeemed
     * @param totalShares Total supply of shares
     * @return underlyingReturned Amount of underlying returned
     */
    function closePosition(
        uint256 shares,
        uint256 totalShares
    ) external onlyWToken nonReentrant returns (uint256 underlyingReturned) {
        if (shares == 0) revert ZeroAmount();
        
        // Calculate percentage to withdraw
        uint256 withdrawPercent = (shares * WAD) / totalShares;
        
        // Remove liquidity proportionally
        (uint256 amount0, uint256 amount1) = v3LPVault.removeLiquidity(
            (withdrawPercent * 10000) / WAD, // Convert to basis points
            0,
            0
        );
        
        // Repay proportional debt
        uint256 debtToRepay = (totalDebt * withdrawPercent) / WAD;
        
        // Use token1 (MIM) to repay debt first
        if (amount1 >= debtToRepay) {
            mim.safeTransfer(address(stakingVault), debtToRepay);
            stakingVault.repay(debtToRepay);
            
            // Convert remaining MIM to underlying if any
            uint256 remainingMIM = amount1 - debtToRepay;
            if (remainingMIM > 0) {
                // Swap MIM for underlying (simplified - would use actual swap)
                uint256 price = oracle.getPrice();
                underlyingReturned = amount0 + (remainingMIM * WAD / price);
            } else {
                underlyingReturned = amount0;
            }
        } else {
            // Need to swap some underlying to cover debt
            uint256 mimShortfall = debtToRepay - amount1;
            uint256 price = oracle.getPrice();
            uint256 underlyingNeeded = (mimShortfall * WAD / price);
            
            // Swap underlying for MIM (simplified)
            underlyingReturned = amount0 - underlyingNeeded;
            
            // Repay full debt
            mim.safeTransfer(address(stakingVault), debtToRepay);
            stakingVault.repay(debtToRepay);
        }
        
        totalDebt -= debtToRepay;
        totalUnderlying -= (totalUnderlying * withdrawPercent) / WAD;
        
        // Transfer underlying to WToken
        underlyingAsset.safeTransfer(msg.sender, underlyingReturned);
        
        emit PositionClosed(withdrawPercent, underlyingReturned);
    }
    
    /**
     * @notice Rebalance the position to maintain target DTV
     */
    function rebalance() external nonReentrant {
        // Check cooldown
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
        
        // Reward rebalancer (small fee from protocol)
        uint256 reward = (amount * REBALANCE_REWARD) / WAD;
        if (reward > 0 && mim.balanceOf(address(this)) >= reward) {
            mim.safeTransfer(msg.sender, reward);
        }
        
        emit Rebalanced(isDeleverage, amount, getCurrentDTV());
    }
    
    // ============ Internal Functions ============
    
    /**
     * @notice Remove leverage by repaying debt
     */
    function _deleverage(uint256 repayAmount) internal {
        // Remove some liquidity to get MIM for repayment
        uint256 lpValue = getTotalLPValue();
        uint256 percentToRemove = (repayAmount * WAD * 10000) / lpValue / WAD;
        
        (uint256 amount0, uint256 amount1) = v3LPVault.removeLiquidity(
            percentToRemove,
            0,
            0
        );
        
        // Repay debt with the MIM
        uint256 actualRepay = amount1 > repayAmount ? repayAmount : amount1;
        mim.safeTransfer(address(stakingVault), actualRepay);
        stakingVault.repay(actualRepay);
        totalDebt -= actualRepay;
        
        // Re-add the underlying back
        if (amount0 > 0) {
            v3LPVault.addLiquidity(amount0, 0, 0, 0);
        }
    }
    
    /**
     * @notice Add leverage by borrowing more
     */
    function _addLeverage(uint256 borrowAmount) internal {
        // Borrow more MIM
        stakingVault.borrow(borrowAmount);
        totalDebt += borrowAmount;
        
        // Add the borrowed MIM to LP
        v3LPVault.addLiquidity(0, borrowAmount, 0, 0);
    }
    
    // ============ Emergency Functions ============
    
    /**
     * @notice Emergency deleverage if position becomes unhealthy
     */
    function emergencyDeleverage() external onlyOwner {
        uint256 currentDTV = getCurrentDTV();
        require(currentDTV > LIQUIDATION_DTV, "Position is healthy");
        
        // Remove all liquidity
        (uint256 amount0, uint256 amount1) = v3LPVault.removeLiquidity(10000, 0, 0);
        
        // Repay as much debt as possible
        uint256 repayAmount = amount1 > totalDebt ? totalDebt : amount1;
        mim.safeTransfer(address(stakingVault), repayAmount);
        stakingVault.repay(repayAmount);
        totalDebt -= repayAmount;
        
        // Store remaining assets
        // Users can withdraw what's left
    }
}

// ============ Interfaces ============

interface IMIMStakingVault {
    function borrow(uint256 amount) external;
    function repay(uint256 amount) external;
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
}

interface IOracleAdapter {
    function getPrice() external view returns (uint256);
}

