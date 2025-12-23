// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title WToken
 * @notice Receipt token for zero-IL leveraged LP positions (wETH, wBTC)
 * @dev Represents shares in the LeverageAMM vault with linear price exposure
 */
contract WToken is ERC20, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ============ State Variables ============
    
    /// @notice The underlying asset (ETH/WETH, BTC/WBTC)
    IERC20 public immutable underlyingAsset;
    
    /// @notice The LeverageAMM managing positions
    ILeverageAMM public immutable leverageAMM;
    
    /// @notice The V3LPVault holding liquidity positions
    IV3LPVault public immutable v3LPVault;
    
    /// @notice Entry price for each depositor (for PnL tracking)
    mapping(address => uint256) public entryPrice;
    
    /// @notice Total deposited value (in underlying asset terms)
    uint256 public totalDeposited;
    
    /// @notice Whether deposits are paused
    bool public depositsPaused;
    
    /// @notice Whether withdrawals are paused
    bool public withdrawalsPaused;
    
    // ============ Events ============
    
    event Deposited(address indexed user, uint256 assetAmount, uint256 sharesReceived, uint256 priceAtDeposit);
    event Withdrawn(address indexed user, uint256 sharesBurned, uint256 assetReceived, uint256 priceAtWithdraw);
    event PositionRebalanced(uint256 oldDTV, uint256 newDTV);
    event DepositsPaused(bool paused);
    event WithdrawalsPaused(bool paused);
    
    // ============ Errors ============
    
    error DepositsPaused_();
    error WithdrawalsPaused_();
    error ZeroAmount();
    error InsufficientShares();
    error SlippageExceeded();
    
    // ============ Constructor ============
    
    constructor(
        string memory name,
        string memory symbol,
        address _underlyingAsset,
        address _leverageAMM,
        address _v3LPVault
    ) ERC20(name, symbol) Ownable(msg.sender) {
        underlyingAsset = IERC20(_underlyingAsset);
        leverageAMM = ILeverageAMM(_leverageAMM);
        v3LPVault = IV3LPVault(_v3LPVault);
        
        // Approve LeverageAMM to spend underlying
        underlyingAsset.approve(_leverageAMM, type(uint256).max);
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Pause/unpause deposits
     */
    function setDepositsPaused(bool paused) external onlyOwner {
        depositsPaused = paused;
        emit DepositsPaused(paused);
    }
    
    /**
     * @notice Pause/unpause withdrawals
     */
    function setWithdrawalsPaused(bool paused) external onlyOwner {
        withdrawalsPaused = paused;
        emit WithdrawalsPaused(paused);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get current price per share in underlying asset terms
     * @return Price per share (18 decimals)
     */
    function pricePerShare() public view returns (uint256) {
        if (totalSupply() == 0) return 1e18;
        
        uint256 totalValue = getTotalValue();
        return (totalValue * 1e18) / totalSupply();
    }
    
    /**
     * @notice Get total value of all positions in underlying asset terms
     * @return Total value
     */
    function getTotalValue() public view returns (uint256) {
        // Get LP value from V3LPVault
        (uint256 amount0, uint256 amount1) = v3LPVault.getTotalAssets();
        
        // Get debt from LeverageAMM
        uint256 totalDebt = leverageAMM.getTotalDebt();
        
        // Get price from oracle
        uint256 price = leverageAMM.getPrice();
        
        // Calculate net value in underlying terms
        // Assuming token0 is underlying, token1 is MIM
        uint256 lpValueInUnderlying = amount0 + (amount1 * 1e18 / price);
        uint256 debtInUnderlying = totalDebt * 1e18 / price;
        
        if (lpValueInUnderlying > debtInUnderlying) {
            return lpValueInUnderlying - debtInUnderlying;
        }
        return 0;
    }
    
    /**
     * @notice Get user's position value
     * @param user User address
     * @return Value in underlying asset terms
     */
    function getPositionValue(address user) external view returns (uint256) {
        uint256 shares = balanceOf(user);
        if (shares == 0) return 0;
        
        return (shares * pricePerShare()) / 1e18;
    }
    
    /**
     * @notice Get user's PnL since deposit
     * @param user User address
     * @return pnl Profit/loss in underlying terms (can be negative)
     * @return pnlPercent PnL percentage (18 decimals)
     */
    function getUserPnL(address user) external view returns (int256 pnl, int256 pnlPercent) {
        uint256 shares = balanceOf(user);
        if (shares == 0) return (0, 0);
        
        uint256 currentValue = (shares * pricePerShare()) / 1e18;
        uint256 entryValue = (shares * entryPrice[user]) / 1e18;
        
        pnl = int256(currentValue) - int256(entryValue);
        if (entryValue > 0) {
            pnlPercent = (pnl * 1e18) / int256(entryValue);
        }
    }
    
    /**
     * @notice Convert asset amount to shares
     * @param assets Amount of underlying asset
     * @return shares Equivalent shares
     */
    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return assets;
        
        uint256 totalValue = getTotalValue();
        if (totalValue == 0) return assets;
        
        return (assets * supply) / totalValue;
    }
    
    /**
     * @notice Convert shares to asset amount
     * @param shares Amount of shares
     * @return assets Equivalent underlying asset
     */
    function convertToAssets(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return shares;
        
        uint256 totalValue = getTotalValue();
        return (shares * totalValue) / supply;
    }
    
    // ============ User Functions ============
    
    /**
     * @notice Deposit underlying asset and receive wTokens
     * @param amount Amount of underlying asset to deposit
     * @param minShares Minimum shares to receive (slippage protection)
     * @return shares Amount of wTokens received
     */
    function deposit(
        uint256 amount,
        uint256 minShares
    ) external nonReentrant returns (uint256 shares) {
        if (depositsPaused) revert DepositsPaused_();
        if (amount == 0) revert ZeroAmount();
        
        // Calculate shares before deposit
        shares = convertToShares(amount);
        if (shares < minShares) revert SlippageExceeded();
        
        // Transfer underlying from user
        underlyingAsset.safeTransferFrom(msg.sender, address(this), amount);
        
        // Create leveraged position via LeverageAMM
        leverageAMM.openPosition(amount);
        
        // Record entry price for PnL tracking
        if (balanceOf(msg.sender) == 0) {
            entryPrice[msg.sender] = pricePerShare();
        } else {
            // Weighted average entry price
            uint256 existingValue = balanceOf(msg.sender) * entryPrice[msg.sender] / 1e18;
            uint256 newValue = shares * pricePerShare() / 1e18;
            entryPrice[msg.sender] = ((existingValue + newValue) * 1e18) / (balanceOf(msg.sender) + shares);
        }
        
        // Mint shares
        _mint(msg.sender, shares);
        totalDeposited += amount;
        
        emit Deposited(msg.sender, amount, shares, pricePerShare());
    }
    
    /**
     * @notice Deposit ETH directly (for wETH vault)
     * @param minShares Minimum shares to receive
     * @return shares Amount of wTokens received
     */
    function depositETH(uint256 minShares) external payable nonReentrant returns (uint256 shares) {
        if (depositsPaused) revert DepositsPaused_();
        if (msg.value == 0) revert ZeroAmount();
        
        // Wrap ETH to WETH
        IWETH(address(underlyingAsset)).deposit{value: msg.value}();
        
        // Calculate shares
        shares = convertToShares(msg.value);
        if (shares < minShares) revert SlippageExceeded();
        
        // Create leveraged position
        leverageAMM.openPosition(msg.value);
        
        // Record entry price
        if (balanceOf(msg.sender) == 0) {
            entryPrice[msg.sender] = pricePerShare();
        } else {
            uint256 existingValue = balanceOf(msg.sender) * entryPrice[msg.sender] / 1e18;
            uint256 newValue = shares * pricePerShare() / 1e18;
            entryPrice[msg.sender] = ((existingValue + newValue) * 1e18) / (balanceOf(msg.sender) + shares);
        }
        
        _mint(msg.sender, shares);
        totalDeposited += msg.value;
        
        emit Deposited(msg.sender, msg.value, shares, pricePerShare());
    }
    
    /**
     * @notice Withdraw underlying asset by burning wTokens
     * @param shares Amount of wTokens to burn
     * @param minAssets Minimum assets to receive (slippage protection)
     * @return assets Amount of underlying asset received
     */
    function withdraw(
        uint256 shares,
        uint256 minAssets
    ) external nonReentrant returns (uint256 assets) {
        if (withdrawalsPaused) revert WithdrawalsPaused_();
        if (shares == 0) revert ZeroAmount();
        if (shares > balanceOf(msg.sender)) revert InsufficientShares();
        
        // Calculate assets to receive
        assets = convertToAssets(shares);
        if (assets < minAssets) revert SlippageExceeded();
        
        // Close leveraged position via LeverageAMM
        assets = leverageAMM.closePosition(shares, totalSupply());
        
        // Burn shares
        _burn(msg.sender, shares);
        totalDeposited -= (totalDeposited * shares) / (totalSupply() + shares);
        
        // Transfer underlying to user
        underlyingAsset.safeTransfer(msg.sender, assets);
        
        emit Withdrawn(msg.sender, shares, assets, pricePerShare());
    }
    
    /**
     * @notice Withdraw as ETH (for wETH vault)
     * @param shares Amount of wTokens to burn
     * @param minAssets Minimum ETH to receive
     * @return assets Amount of ETH received
     */
    function withdrawETH(
        uint256 shares,
        uint256 minAssets
    ) external nonReentrant returns (uint256 assets) {
        if (withdrawalsPaused) revert WithdrawalsPaused_();
        if (shares == 0) revert ZeroAmount();
        if (shares > balanceOf(msg.sender)) revert InsufficientShares();
        
        // Calculate assets
        assets = convertToAssets(shares);
        if (assets < minAssets) revert SlippageExceeded();
        
        // Close position
        assets = leverageAMM.closePosition(shares, totalSupply());
        
        // Burn shares
        _burn(msg.sender, shares);
        totalDeposited -= (totalDeposited * shares) / (totalSupply() + shares);
        
        // Unwrap WETH to ETH
        IWETH(address(underlyingAsset)).withdraw(assets);
        
        // Transfer ETH to user
        (bool success, ) = msg.sender.call{value: assets}("");
        require(success, "ETH transfer failed");
        
        emit Withdrawn(msg.sender, shares, assets, pricePerShare());
    }
    
    // ============ Rebalancing ============
    
    /**
     * @notice Trigger rebalancing of leveraged position
     * @dev Can be called by anyone, incentivized with small reward
     */
    function rebalance() external nonReentrant {
        (bool needsRebalance, ) = leverageAMM.checkRebalance();
        require(needsRebalance, "No rebalance needed");
        
        uint256 oldDTV = leverageAMM.getCurrentDTV();
        leverageAMM.rebalance();
        uint256 newDTV = leverageAMM.getCurrentDTV();
        
        emit PositionRebalanced(oldDTV, newDTV);
    }
    
    // ============ Receive ETH ============
    
    receive() external payable {}
}

// ============ Interfaces ============

interface ILeverageAMM {
    function openPosition(uint256 amount) external;
    function closePosition(uint256 shares, uint256 totalShares) external returns (uint256);
    function rebalance() external;
    function checkRebalance() external view returns (bool needsRebalance, bool isDeleverage);
    function getCurrentDTV() external view returns (uint256);
    function getTotalDebt() external view returns (uint256);
    function getPrice() external view returns (uint256);
}

interface IV3LPVault {
    function getTotalAssets() external view returns (uint256 amount0, uint256 amount1);
}

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
}

