// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IStakingVault {
    function borrow(uint256 amount) external;
    function repay(uint256 amount) external;
    function borrowRate() external view returns (uint256);
}

interface IV3LPVault {
    function addLiquidity(uint256 amount0, uint256 amount1, uint256 minAmount0, uint256 minAmount1) external returns (uint128);
    function removeLiquidity(uint256 percent, uint256 minAmount0, uint256 minAmount1) external returns (uint256, uint256);
    function collectFees() external returns (uint256, uint256);
    function getTotalAssets() external view returns (uint256, uint256);
    function getPendingFees() external view returns (uint256, uint256);
}

interface IOracle {
    function getPrice(address token) external view returns (uint256);
}

/**
 * @title LeverageAMMComplete
 * @notice Manages 2x leveraged LP positions
 * @dev FIXES APPLIED:
 *   - BUG-003: lastCyclePayment properly initialized in constructor
 *   - Changed 7 days to 7 hours for testing
 *   - Proper DTV management and rebalancing
 */
contract LeverageAMMComplete is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    uint256 public constant WAD = 1e18;
    uint256 public constant BASIS_POINTS = 10000;

    // TESTING: 7 hours instead of 7 days
    uint256 public constant CYCLE_DURATION = 7 hours;

    // DTV thresholds
    uint256 public constant TARGET_DTV = 0.50e18;      // 50%
    uint256 public constant MIN_DTV = 0.40e18;         // 40%
    uint256 public constant MAX_DTV = 0.60e18;         // 60%
    uint256 public constant LIQUIDATION_DTV = 0.66e18; // 66%

    // Fee parameters
    uint256 public constant PROTOCOL_FEE = 0.15e18;    // 15%
    uint256 public constant REBALANCE_REWARD = 0.001e18; // 0.1%

    // ============ State Variables ============

    /// @notice Underlying asset (e.g., sWETH)
    IERC20 public immutable underlying;

    /// @notice MIM token
    IERC20 public immutable mim;

    /// @notice Staking vault for borrowing MIM
    IStakingVault public immutable stakingVault;

    /// @notice V3 LP vault for managing positions
    IV3LPVault public immutable v3LPVault;

    /// @notice Price oracle
    IOracle public immutable oracle;

    /// @notice Treasury address
    address public treasury;

    /// @notice wToken receipt token
    address public wToken;

    /// @notice Total debt to staking vault
    uint256 public totalDebt;

    /// @notice Total underlying deposited
    uint256 public totalUnderlying;

    /// @notice Accumulated trading fees
    uint256 public accumulatedFees;

    /// @notice Pending fees for wToken holders
    uint256 public pendingWTokenFees;

    /// @notice Last cycle payment timestamp - FIX: Properly initialized!
    uint256 public lastCyclePayment;

    /// @notice Last rebalance timestamp
    uint256 public lastRebalanceTime;

    // ============ Events ============

    event Deposited(address indexed user, uint256 underlying, uint256 mimBorrowed, uint256 shares);
    event Withdrawn(address indexed user, uint256 shares, uint256 underlying, uint256 mimRepaid);
    event Rebalanced(address indexed caller, bool isDeleverage, uint256 amount, uint256 reward);
    event FeesCollected(uint256 fee0, uint256 fee1);
    event CyclePaymentProcessed(uint256 interestPaid, uint256 protocolFee, uint256 wTokenShare);
    event WTokenSet(address indexed wToken);
    event TreasurySet(address indexed treasury);

    // ============ Constructor ============

    constructor(
        address _underlying,
        address _mim,
        address _stakingVault,
        address _v3LPVault,
        address _oracle,
        address _treasury
    ) Ownable(msg.sender) {
        underlying = IERC20(_underlying);
        mim = IERC20(_mim);
        stakingVault = IStakingVault(_stakingVault);
        v3LPVault = IV3LPVault(_v3LPVault);
        oracle = IOracle(_oracle);
        treasury = _treasury;

        // FIX BUG-003: Initialize cycle payment timestamp!
        lastCyclePayment = block.timestamp;
        lastRebalanceTime = block.timestamp;

        // Approve tokens
        underlying.approve(_v3LPVault, type(uint256).max);
        mim.approve(_v3LPVault, type(uint256).max);
        mim.approve(_stakingVault, type(uint256).max);
    }

    // ============ Admin Functions ============

    function setWToken(address _wToken) external onlyOwner {
        wToken = _wToken;
        emit WTokenSet(_wToken);
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
        emit TreasurySet(_treasury);
    }

    /**
     * @notice Fix for already deployed contracts - initialize cycle payment
     */
    function initializeCyclePayment() external onlyOwner {
        require(lastCyclePayment == 0, "Already initialized");
        lastCyclePayment = block.timestamp;
    }

    // ============ View Functions ============

    /**
     * @notice Get total LP value in MIM terms
     */
    function getTotalLPValue() public view returns (uint256) {
        (uint256 amount0, uint256 amount1) = v3LPVault.getTotalAssets();

        // Get price of underlying in MIM terms
        uint256 underlyingPrice = oracle.getPrice(address(underlying));

        // Calculate total value: underlying * price + MIM
        return (amount0 * underlyingPrice) / WAD + amount1;
    }

    /**
     * @notice Get current DTV (Debt-to-Value) ratio
     */
    function getCurrentDTV() public view returns (uint256) {
        uint256 lpValue = getTotalLPValue();
        if (lpValue == 0) return 0;
        return (totalDebt * WAD) / lpValue;
    }

    /**
     * @notice Get equity value (LP value - debt)
     */
    function getEquity() public view returns (uint256) {
        uint256 lpValue = getTotalLPValue();
        if (lpValue <= totalDebt) return 0;
        return lpValue - totalDebt;
    }

    /**
     * @notice Check if rebalance is needed
     */
    function checkRebalance() public view returns (bool needsRebalance, bool isDeleverage) {
        uint256 dtv = getCurrentDTV();
        if (dtv < MIN_DTV) {
            return (true, false); // Need to leverage up
        }
        if (dtv > MAX_DTV) {
            return (true, true); // Need to deleverage
        }
        return (false, false);
    }

    /**
     * @notice Check if cycle payment is due
     */
    function isCyclePaymentDue() public view returns (bool) {
        return block.timestamp >= lastCyclePayment + CYCLE_DURATION;
    }

    /**
     * @notice Get expected cycle interest
     */
    function getExpectedCycleInterest() public view returns (uint256) {
        uint256 borrowRate = stakingVault.borrowRate();
        return (totalDebt * borrowRate * CYCLE_DURATION) / (365 days * WAD);
    }

    /**
     * @notice Check if can pay full interest
     */
    function canPayFullInterest() public view returns (bool canPay, uint256 shortfall) {
        uint256 expected = getExpectedCycleInterest();
        if (accumulatedFees >= expected) {
            return (true, 0);
        }
        return (false, expected - accumulatedFees);
    }

    // ============ Core Functions ============

    /**
     * @notice Deposit underlying and receive leveraged LP shares
     * @param amount Amount of underlying to deposit
     * @param minShares Minimum shares to receive
     */
    function deposit(uint256 amount, uint256 minShares) external nonReentrant returns (uint256 shares) {
        require(amount > 0, "Zero amount");
        require(wToken != address(0), "wToken not set");

        // Transfer underlying from user
        underlying.safeTransferFrom(msg.sender, address(this), amount);

        // Calculate MIM to borrow (1x for 2x leverage)
        uint256 underlyingPrice = oracle.getPrice(address(underlying));
        uint256 mimToBorrow = (amount * underlyingPrice) / WAD;

        // Borrow MIM from staking vault
        stakingVault.borrow(mimToBorrow);
        totalDebt += mimToBorrow;

        // Add liquidity to V3 vault
        v3LPVault.addLiquidity(amount, mimToBorrow, 0, 0);

        // Calculate shares (simplified - in production use proper share accounting)
        shares = amount; // 1:1 for simplicity

        require(shares >= minShares, "Slippage");

        totalUnderlying += amount;

        // Mint wToken shares to user (would call wToken.mint)
        // For now, emit event
        emit Deposited(msg.sender, amount, mimToBorrow, shares);
    }

    /**
     * @notice Withdraw by burning shares
     * @param shares Shares to burn
     * @param minUnderlying Minimum underlying to receive
     */
    function withdraw(uint256 shares, uint256 minUnderlying) external nonReentrant returns (uint256 underlyingOut) {
        require(shares > 0, "Zero shares");
        require(wToken != address(0), "wToken not set");

        // Calculate proportion of position
        uint256 proportion = (shares * WAD) / totalUnderlying;

        // Remove liquidity
        (uint256 underlying0, uint256 mim0) = v3LPVault.removeLiquidity(
            (proportion * BASIS_POINTS) / WAD,
            0,
            0
        );

        underlyingOut = underlying0;

        // Repay proportional debt
        uint256 debtToRepay = (totalDebt * proportion) / WAD;
        if (mim0 >= debtToRepay) {
            stakingVault.repay(debtToRepay);
            totalDebt -= debtToRepay;
            // Excess MIM goes to fees
            if (mim0 > debtToRepay) {
                accumulatedFees += mim0 - debtToRepay;
            }
        } else {
            // Need to use underlying to cover shortfall
            stakingVault.repay(mim0);
            totalDebt -= mim0;
        }

        require(underlyingOut >= minUnderlying, "Slippage");

        // Transfer underlying to user
        underlying.safeTransfer(msg.sender, underlyingOut);
        totalUnderlying -= shares;

        emit Withdrawn(msg.sender, shares, underlyingOut, debtToRepay);
    }

    /**
     * @notice Rebalance to target DTV
     */
    function rebalance() external nonReentrant {
        (bool needsRebalance, bool isDeleverage) = checkRebalance();
        require(needsRebalance, "No rebalance needed");

        uint256 currentDTV = getCurrentDTV();
        uint256 lpValue = getTotalLPValue();
        uint256 targetDebt = (lpValue * TARGET_DTV) / WAD;
        uint256 amount;

        if (isDeleverage) {
            // Remove liquidity and repay debt
            amount = totalDebt - targetDebt;
            uint256 proportion = (amount * WAD) / totalDebt;

            (uint256 underlying0, uint256 mim0) = v3LPVault.removeLiquidity(
                (proportion * BASIS_POINTS) / WAD,
                0,
                0
            );

            // Repay debt
            if (mim0 >= amount) {
                stakingVault.repay(amount);
                totalDebt -= amount;
            } else {
                stakingVault.repay(mim0);
                totalDebt -= mim0;
            }
        } else {
            // Borrow more and add liquidity
            amount = targetDebt - totalDebt;
            stakingVault.borrow(amount);
            totalDebt += amount;

            // Add MIM to LP
            v3LPVault.addLiquidity(0, amount, 0, 0);
        }

        // Reward caller
        uint256 reward = (amount * REBALANCE_REWARD) / WAD;
        if (reward > 0 && mim.balanceOf(address(this)) >= reward) {
            mim.safeTransfer(msg.sender, reward);
        }

        lastRebalanceTime = block.timestamp;

        emit Rebalanced(msg.sender, isDeleverage, amount, reward);
    }

    /**
     * @notice Collect fees from V3 positions
     */
    function collectAllFees() external returns (uint256 fee0, uint256 fee1) {
        (fee0, fee1) = v3LPVault.collectFees();

        // Convert fee0 (underlying) to MIM value
        uint256 underlyingPrice = oracle.getPrice(address(underlying));
        uint256 fee0InMIM = (fee0 * underlyingPrice) / WAD;

        accumulatedFees += fee0InMIM + fee1;

        emit FeesCollected(fee0, fee1);
    }

    /**
     * @notice Process cycle payment (keeper function)
     */
    function processCyclePayment() external {
        require(isCyclePaymentDue(), "Cycle not due");

        // Collect any pending fees first
        this.collectAllFees();

        // Calculate interest due
        uint256 interestDue = getExpectedCycleInterest();

        // Protocol fee
        uint256 protocolFee = (interestDue * PROTOCOL_FEE) / WAD;

        // Pay interest to staking vault
        if (accumulatedFees >= interestDue) {
            // Full payment
            stakingVault.repay(interestDue);
            accumulatedFees -= interestDue;

            // Protocol fee
            if (accumulatedFees >= protocolFee) {
                mim.safeTransfer(treasury, protocolFee);
                accumulatedFees -= protocolFee;
            }

            // Remaining goes to wToken holders
            pendingWTokenFees += accumulatedFees;
            accumulatedFees = 0;
        } else {
            // Partial payment - use all available fees
            stakingVault.repay(accumulatedFees);
            accumulatedFees = 0;
        }

        lastCyclePayment = block.timestamp;

        emit CyclePaymentProcessed(interestDue, protocolFee, pendingWTokenFees);
    }

    // ============ Emergency Functions ============

    /**
     * @notice Emergency rescue tokens
     */
    function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }
}
