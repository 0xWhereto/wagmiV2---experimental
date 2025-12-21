// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { ERC4626 } from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title StakingVault
 * @notice ERC4626 vault for staking MIM and receiving sMIM
 * @dev sMIM is used as liquidity for Zero IL vaults
 * 
 * Interest Rate Model (Jump Rate):
 * - Base Rate: 10% at 0% utilization
 * - Multiplier: 12% (linear increase until kink)
 * - Kink: 80% utilization
 * - Jump Multiplier: 100% (steep increase after kink)
 * - Max Utilization: 90% (hard cap)
 */
contract StakingVault is ERC4626, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;

    // ============ Constants ============
    
    /// @notice Base interest rate (10% = 1000 basis points)
    uint256 public constant BASE_RATE_BP = 1000;
    
    /// @notice Multiplier before kink (12% = 1200 basis points)
    uint256 public constant MULTIPLIER_BP = 1200;
    
    /// @notice Jump multiplier after kink (100% = 10000 basis points)
    uint256 public constant JUMP_MULTIPLIER_BP = 10000;
    
    /// @notice Kink utilization point (80% = 8000 basis points)
    uint256 public constant KINK_BP = 8000;
    
    /// @notice Maximum utilization (90% = 9000 basis points)
    uint256 public constant MAX_UTILIZATION_BP = 9000;
    
    /// @notice Basis points denominator
    uint256 public constant BP_DENOMINATOR = 10000;
    
    /// @notice Seconds per year (for APR calculations)
    uint256 public constant SECONDS_PER_YEAR = 365 days;

    // ============ State Variables ============
    
    /// @notice Total amount borrowed by Zero IL vaults
    uint256 public totalBorrowed;
    
    /// @notice Mapping of authorized borrowers (Zero IL vaults)
    mapping(address => bool) public authorizedBorrowers;
    
    /// @notice Mapping of borrowed amounts by address
    mapping(address => uint256) public borrowedAmount;
    
    /// @notice Accumulated interest per share (scaled by 1e18)
    uint256 public accInterestPerShare;
    
    /// @notice Last update timestamp for interest accrual
    uint256 public lastUpdateTimestamp;
    
    /// @notice Total interest earned (for tracking)
    uint256 public totalInterestEarned;

    // ============ Events ============
    
    event BorrowerAuthorized(address indexed borrower, bool authorized);
    event Borrowed(address indexed borrower, uint256 amount);
    event Repaid(address indexed borrower, uint256 amount, uint256 interest);
    event InterestAccrued(uint256 interestAmount, uint256 newAccPerShare);

    // ============ Constructor ============
    
    constructor(
        IERC20 _mimToken
    ) ERC4626(_mimToken) ERC20("Staked MIM", "sMIM") Ownable(msg.sender) {
        lastUpdateTimestamp = block.timestamp;
    }

    // ============ Admin Functions ============
    
    /**
     * @notice Authorize or deauthorize a borrower (Zero IL vault)
     * @param _borrower Address of the borrower
     * @param _authorized Whether to authorize
     */
    function setBorrower(address _borrower, bool _authorized) external onlyOwner {
        authorizedBorrowers[_borrower] = _authorized;
        emit BorrowerAuthorized(_borrower, _authorized);
    }

    // ============ Borrowing Functions ============
    
    /**
     * @notice Borrow MIM from the vault (only for Zero IL vaults)
     * @param _amount Amount to borrow
     */
    function borrow(uint256 _amount) external nonReentrant {
        require(authorizedBorrowers[msg.sender], "Not authorized borrower");
        
        // Accrue interest first
        _accrueInterest();
        
        // Check utilization won't exceed max
        uint256 totalAssets_ = totalAssets();
        uint256 newBorrowed = totalBorrowed + _amount;
        uint256 newUtilization = (newBorrowed * BP_DENOMINATOR) / totalAssets_;
        require(newUtilization <= MAX_UTILIZATION_BP, "Exceeds max utilization");
        
        // Check available liquidity
        uint256 available = totalAssets_ - totalBorrowed;
        require(_amount <= available, "Insufficient liquidity");
        
        // Update state
        totalBorrowed = newBorrowed;
        borrowedAmount[msg.sender] += _amount;
        
        // Transfer MIM to borrower
        IERC20(asset()).safeTransfer(msg.sender, _amount);
        
        emit Borrowed(msg.sender, _amount);
    }

    /**
     * @notice Repay borrowed MIM with interest
     * @param _amount Principal amount to repay
     * @param _interest Interest amount to pay
     */
    function repay(uint256 _amount, uint256 _interest) external nonReentrant {
        require(authorizedBorrowers[msg.sender], "Not authorized borrower");
        require(borrowedAmount[msg.sender] >= _amount, "Repay exceeds borrowed");
        
        // Accrue interest first
        _accrueInterest();
        
        // Transfer tokens from borrower
        uint256 totalRepayment = _amount + _interest;
        IERC20(asset()).safeTransferFrom(msg.sender, address(this), totalRepayment);
        
        // Update state
        totalBorrowed -= _amount;
        borrowedAmount[msg.sender] -= _amount;
        totalInterestEarned += _interest;
        
        emit Repaid(msg.sender, _amount, _interest);
    }

    // ============ Interest Calculation ============
    
    /**
     * @notice Get current utilization rate in basis points
     */
    function getUtilization() public view returns (uint256) {
        uint256 totalAssets_ = totalAssets();
        if (totalAssets_ == 0) return 0;
        return (totalBorrowed * BP_DENOMINATOR) / totalAssets_;
    }

    /**
     * @notice Calculate interest rate based on utilization (Jump Rate Model)
     * @param _utilization Utilization in basis points
     * @return Interest rate in basis points (annual)
     */
    function calculateInterestRate(uint256 _utilization) public pure returns (uint256) {
        if (_utilization <= KINK_BP) {
            // Linear rate: baseRate + (utilization * multiplier / BP_DENOMINATOR)
            return BASE_RATE_BP + (_utilization * MULTIPLIER_BP) / BP_DENOMINATOR;
        } else {
            // Jump rate after kink
            uint256 baseAtKink = BASE_RATE_BP + (KINK_BP * MULTIPLIER_BP) / BP_DENOMINATOR;
            uint256 excessUtilization = _utilization - KINK_BP;
            return baseAtKink + (excessUtilization * JUMP_MULTIPLIER_BP) / BP_DENOMINATOR;
        }
    }

    /**
     * @notice Get current annual interest rate in basis points
     */
    function getCurrentInterestRate() public view returns (uint256) {
        return calculateInterestRate(getUtilization());
    }

    /**
     * @notice Accrue interest based on time elapsed
     */
    function _accrueInterest() internal {
        uint256 timeElapsed = block.timestamp - lastUpdateTimestamp;
        if (timeElapsed == 0 || totalBorrowed == 0) {
            lastUpdateTimestamp = block.timestamp;
            return;
        }

        uint256 interestRate = getCurrentInterestRate();
        
        // Calculate interest: borrowed * rate * time / (BP_DENOMINATOR * SECONDS_PER_YEAR)
        uint256 interestAmount = (totalBorrowed * interestRate * timeElapsed) / 
            (BP_DENOMINATOR * SECONDS_PER_YEAR);
        
        if (interestAmount > 0) {
            // Update accumulated interest per share
            uint256 supply = totalSupply();
            if (supply > 0) {
                accInterestPerShare += (interestAmount * 1e18) / supply;
            }
            totalInterestEarned += interestAmount;
        }
        
        lastUpdateTimestamp = block.timestamp;
        
        emit InterestAccrued(interestAmount, accInterestPerShare);
    }

    // ============ ERC4626 Overrides ============
    
    /**
     * @notice Total assets = deposits + interest earned (excluding borrowed)
     */
    function totalAssets() public view override returns (uint256) {
        // Include borrowed amount as it's still owed to the vault
        return IERC20(asset()).balanceOf(address(this)) + totalBorrowed;
    }

    /**
     * @notice Available liquidity for withdrawals
     */
    function availableLiquidity() public view returns (uint256) {
        return IERC20(asset()).balanceOf(address(this));
    }

    /**
     * @notice Override deposit to accrue interest first
     */
    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256) {
        _accrueInterest();
        return super.deposit(assets, receiver);
    }

    /**
     * @notice Override withdraw to check available liquidity
     */
    function withdraw(uint256 assets, address receiver, address owner_) public override nonReentrant returns (uint256) {
        _accrueInterest();
        require(assets <= availableLiquidity(), "Insufficient liquidity");
        return super.withdraw(assets, receiver, owner_);
    }

    /**
     * @notice Override redeem to accrue interest first
     */
    function redeem(uint256 shares, address receiver, address owner_) public override nonReentrant returns (uint256) {
        _accrueInterest();
        uint256 assets = previewRedeem(shares);
        require(assets <= availableLiquidity(), "Insufficient liquidity");
        return super.redeem(shares, receiver, owner_);
    }

    // ============ View Functions ============
    
    /**
     * @notice Get vault statistics
     */
    function getVaultStats() external view returns (
        uint256 _totalAssets,
        uint256 _totalBorrowed,
        uint256 _availableLiquidity,
        uint256 _utilization,
        uint256 _interestRate,
        uint256 _totalInterestEarned
    ) {
        _totalAssets = totalAssets();
        _totalBorrowed = totalBorrowed;
        _availableLiquidity = availableLiquidity();
        _utilization = getUtilization();
        _interestRate = getCurrentInterestRate();
        _totalInterestEarned = totalInterestEarned;
    }

    /**
     * @notice Returns number of decimals (6 to match MIM)
     */
    function decimals() public view override(ERC4626) returns (uint8) {
        return 6;
    }
}

