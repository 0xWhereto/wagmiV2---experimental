// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { ERC4626 } from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { StakingVault } from "./StakingVault.sol";

/**
 * @title ZeroILVault
 * @notice Zero Impermanent Loss Vault for ETH/BTC
 * @dev Uses 2x leverage with borrowed MIM to eliminate IL
 * 
 * How Zero IL works:
 * 1. User deposits ETH/BTC → receives wETH/wBTC tokens
 * 2. Protocol borrows MIM at 50% DTV (Debt-to-Value) ratio
 * 3. Assets + MIM deployed to Uniswap V3 concentrated LP
 * 4. 2x leverage transforms √p growth → linear p growth = Zero IL
 * 
 * Example:
 * - Deposit 1 ETH ($3000)
 * - Borrow $3000 MIM (50% DTV = 2x leverage)
 * - LP position: 1 ETH + $3000 MIM in concentrated range
 * - If ETH goes to $6000:
 *   - Traditional LP: √2 × initial = 1.41x = $4243
 *   - Zero IL (2x leverage): 2 × √2 - 1 = ~2x = $6000
 */
contract ZeroILVault is ERC4626, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;

    // ============ State Variables ============
    
    /// @notice Staking vault for borrowing MIM
    StakingVault public immutable stakingVault;
    
    /// @notice MIM token
    IERC20 public immutable mimToken;
    
    /// @notice Zero IL Strategy contract
    address public strategy;
    
    /// @notice Target DTV ratio (50% = 5000 basis points)
    uint256 public constant TARGET_DTV_BP = 5000;
    
    /// @notice Maximum DTV ratio before liquidation (75% = 7500 basis points)
    uint256 public constant MAX_DTV_BP = 7500;
    
    /// @notice Basis points denominator
    uint256 public constant BP_DENOMINATOR = 10000;
    
    /// @notice Current borrowed MIM amount
    uint256 public totalBorrowed;
    
    /// @notice Price oracle for the underlying asset (simplified - in production use Chainlink)
    uint256 public assetPrice; // In 6 decimals (USD)
    
    /// @notice Total deposited assets (for tracking)
    uint256 public totalDeposited;
    
    /// @notice Pending yield to be claimed
    uint256 public pendingYield;

    // ============ Events ============
    
    event StrategyUpdated(address indexed oldStrategy, address indexed newStrategy);
    event Borrowed(uint256 amount);
    event Repaid(uint256 amount, uint256 interest);
    event PriceUpdated(uint256 newPrice);
    event YieldHarvested(uint256 amount);
    event Rebalanced(uint256 newDTV);

    // ============ Constructor ============
    
    constructor(
        IERC20 _asset,
        string memory _name,
        string memory _symbol,
        address _stakingVault,
        address _mimToken,
        uint256 _initialPrice
    ) ERC4626(_asset) ERC20(_name, _symbol) Ownable(msg.sender) {
        stakingVault = StakingVault(_stakingVault);
        mimToken = IERC20(_mimToken);
        assetPrice = _initialPrice;
    }

    // ============ Admin Functions ============
    
    /**
     * @notice Set the strategy contract
     * @param _strategy New strategy address
     */
    function setStrategy(address _strategy) external onlyOwner {
        address oldStrategy = strategy;
        strategy = _strategy;
        
        // Approve strategy to use assets and MIM
        IERC20(asset()).approve(_strategy, type(uint256).max);
        mimToken.approve(_strategy, type(uint256).max);
        
        emit StrategyUpdated(oldStrategy, _strategy);
    }

    /**
     * @notice Update asset price (in production, use Chainlink oracle)
     * @param _price New price in 6 decimals
     */
    function updatePrice(uint256 _price) external onlyOwner {
        assetPrice = _price;
        emit PriceUpdated(_price);
    }

    // ============ Core Functions ============
    
    /**
     * @notice Get current Debt-to-Value ratio in basis points
     */
    function getCurrentDTV() public view returns (uint256) {
        uint256 totalValue = _getTotalValue();
        if (totalValue == 0) return 0;
        return (totalBorrowed * BP_DENOMINATOR) / totalValue;
    }

    /**
     * @notice Get total value of deposited assets in USD (6 decimals)
     */
    function _getTotalValue() internal view returns (uint256) {
        uint256 assetDecimals = ERC20(asset()).decimals();
        return (totalDeposited * assetPrice) / (10 ** assetDecimals);
    }

    /**
     * @notice Calculate how much MIM to borrow for given deposit
     */
    function calculateBorrowAmount(uint256 _depositAmount) public view returns (uint256) {
        uint256 assetDecimals = ERC20(asset()).decimals();
        uint256 depositValue = (_depositAmount * assetPrice) / (10 ** assetDecimals);
        // Borrow 100% of deposit value for 2x leverage (50% DTV)
        return depositValue;
    }

    /**
     * @notice Rebalance to maintain target DTV
     */
    function rebalance() external onlyOwner {
        uint256 currentDTV = getCurrentDTV();
        
        if (currentDTV < TARGET_DTV_BP - 500) {
            // Under-leveraged, borrow more
            uint256 targetBorrow = (_getTotalValue() * TARGET_DTV_BP) / BP_DENOMINATOR;
            uint256 toBorrow = targetBorrow - totalBorrowed;
            if (toBorrow > 0) {
                _borrowMIM(toBorrow);
            }
        } else if (currentDTV > TARGET_DTV_BP + 500) {
            // Over-leveraged, repay some
            uint256 targetBorrow = (_getTotalValue() * TARGET_DTV_BP) / BP_DENOMINATOR;
            uint256 toRepay = totalBorrowed - targetBorrow;
            if (toRepay > 0 && mimToken.balanceOf(address(this)) >= toRepay) {
                _repayMIM(toRepay);
            }
        }
        
        emit Rebalanced(getCurrentDTV());
    }

    /**
     * @notice Borrow MIM from staking vault
     */
    function _borrowMIM(uint256 _amount) internal {
        stakingVault.borrow(_amount);
        totalBorrowed += _amount;
        emit Borrowed(_amount);
    }

    /**
     * @notice Repay MIM to staking vault
     */
    function _repayMIM(uint256 _amount) internal {
        // Calculate interest (simplified - in production track accrued interest)
        uint256 interestRate = stakingVault.getCurrentInterestRate();
        uint256 interest = (_amount * interestRate) / (10000 * 365); // Daily interest approx
        
        mimToken.approve(address(stakingVault), _amount + interest);
        stakingVault.repay(_amount, interest);
        totalBorrowed -= _amount;
        
        emit Repaid(_amount, interest);
    }

    /**
     * @notice Harvest yield from strategy
     */
    function harvestYield() external onlyOwner {
        if (strategy == address(0)) return;
        
        // In production, call strategy to harvest and return yield
        // For now, pendingYield is set by strategy callbacks
        uint256 yield = pendingYield;
        pendingYield = 0;
        
        emit YieldHarvested(yield);
    }

    // ============ ERC4626 Overrides ============
    
    /**
     * @notice Override deposit to borrow MIM and deploy to strategy
     */
    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256 shares) {
        shares = super.deposit(assets, receiver);
        
        totalDeposited += assets;
        
        // Borrow MIM for leverage
        uint256 borrowAmount = calculateBorrowAmount(assets);
        if (borrowAmount > 0) {
            try stakingVault.borrow(borrowAmount) {
                totalBorrowed += borrowAmount;
                emit Borrowed(borrowAmount);
                
                // Deploy to strategy if set
                if (strategy != address(0)) {
                    // In production: call strategy.deploy(assets, borrowAmount)
                }
            } catch {
                // If borrowing fails, deposit still succeeds but without leverage
            }
        }
        
        return shares;
    }

    /**
     * @notice Override withdraw to handle leverage unwinding
     */
    function withdraw(uint256 assets, address receiver, address owner_) public override nonReentrant returns (uint256 shares) {
        // Calculate proportional debt to repay
        uint256 debtToRepay = 0;
        if (totalDeposited > 0) {
            debtToRepay = (totalBorrowed * assets) / totalDeposited;
        }
        
        // Repay debt if we have MIM
        if (debtToRepay > 0 && mimToken.balanceOf(address(this)) >= debtToRepay) {
            _repayMIM(debtToRepay);
        }
        
        totalDeposited -= assets;
        shares = super.withdraw(assets, receiver, owner_);
        
        return shares;
    }

    /**
     * @notice Total assets includes yield earned
     */
    function totalAssets() public view override returns (uint256) {
        return IERC20(asset()).balanceOf(address(this)) + _getStrategyBalance();
    }

    /**
     * @notice Get balance held by strategy
     */
    function _getStrategyBalance() internal view returns (uint256) {
        if (strategy == address(0)) return 0;
        // In production: call strategy.getBalance()
        return 0;
    }

    // ============ View Functions ============
    
    /**
     * @notice Get vault statistics
     */
    function getVaultStats() external view returns (
        uint256 _totalDeposited,
        uint256 _totalBorrowed,
        uint256 _currentDTV,
        uint256 _assetPrice,
        uint256 _totalValueUSD,
        uint256 _pendingYield
    ) {
        _totalDeposited = totalDeposited;
        _totalBorrowed = totalBorrowed;
        _currentDTV = getCurrentDTV();
        _assetPrice = assetPrice;
        _totalValueUSD = _getTotalValue();
        _pendingYield = pendingYield;
    }

    /**
     * @notice Estimated APR based on strategy performance
     */
    function estimatedAPR() external view returns (uint256) {
        // In production: calculate from actual yield history
        // For now, return a placeholder
        return 1500; // 15% APR in basis points
    }

    /**
     * @notice Check if vault is healthy (DTV within limits)
     */
    function isHealthy() external view returns (bool) {
        return getCurrentDTV() <= MAX_DTV_BP;
    }
}


