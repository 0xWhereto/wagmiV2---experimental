// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title INonfungiblePositionManager
 * @notice Minimal interface for Uniswap V3 position manager
 */
interface INonfungiblePositionManager {
    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    struct IncreaseLiquidityParams {
        uint256 tokenId;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }

    struct DecreaseLiquidityParams {
        uint256 tokenId;
        uint128 liquidity;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }

    struct CollectParams {
        uint256 tokenId;
        address recipient;
        uint128 amount0Max;
        uint128 amount1Max;
    }

    function mint(MintParams calldata params) external payable returns (
        uint256 tokenId,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
    );

    function increaseLiquidity(IncreaseLiquidityParams calldata params) external payable returns (
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
    );

    function decreaseLiquidity(DecreaseLiquidityParams calldata params) external payable returns (
        uint256 amount0,
        uint256 amount1
    );

    function collect(CollectParams calldata params) external payable returns (
        uint256 amount0,
        uint256 amount1
    );

    function positions(uint256 tokenId) external view returns (
        uint96 nonce,
        address operator,
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        uint256 feeGrowthInside0LastX128,
        uint256 feeGrowthInside1LastX128,
        uint128 tokensOwed0,
        uint128 tokensOwed1
    );

    function safeTransferFrom(address from, address to, uint256 tokenId) external;
}

interface IUniswapV3Factory {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
    function createPool(address tokenA, address tokenB, uint24 fee) external returns (address pool);
}

interface IUniswapV3Pool {
    function initialize(uint160 sqrtPriceX96) external;
    function slot0() external view returns (
        uint160 sqrtPriceX96,
        int24 tick,
        uint16 observationIndex,
        uint16 observationCardinality,
        uint16 observationCardinalityNext,
        uint8 feeProtocol,
        bool unlocked
    );
    function liquidity() external view returns (uint128);
}

/**
 * @title ZeroILStrategy
 * @notice Strategy for Zero IL vaults - manages V3 positions with leverage
 * @dev Deploys assets + borrowed MIM to Uniswap V3 concentrated LP
 * 
 * The 2x leverage transforms IL:
 * - Normal LP: value = sqrt(price_new / price_old) × initial
 * - 2x Leveraged: value ≈ (price_new / price_old) × initial
 * 
 * This means your position tracks the underlying asset 1:1
 */
contract ZeroILStrategy is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ State Variables ============
    
    /// @notice Uniswap V3 position manager
    INonfungiblePositionManager public immutable positionManager;
    
    /// @notice Uniswap V3 factory
    IUniswapV3Factory public immutable v3Factory;
    
    /// @notice Asset token (sWETH or sWBTC)
    IERC20 public immutable assetToken;
    
    /// @notice MIM token
    IERC20 public immutable mimToken;
    
    /// @notice V3 pool address
    address public pool;
    
    /// @notice Current V3 position token ID
    uint256 public positionId;
    
    /// @notice Pool fee tier (0.3% = 3000)
    uint24 public constant POOL_FEE = 3000;
    
    /// @notice Tick range width (concentrated liquidity)
    /// For ~20% price range: tickSpacing * 20 on each side
    int24 public tickRangeWidth = 1200; // Approximately ±12% price range
    
    /// @notice Authorized vault that can call strategy
    address public vault;
    
    /// @notice Total assets deployed
    uint256 public totalAssetsDeployed;
    
    /// @notice Total MIM deployed
    uint256 public totalMIMDeployed;
    
    /// @notice Accumulated fees
    uint256 public accumulatedAssetFees;
    uint256 public accumulatedMIMFees;

    // ============ Events ============
    
    event VaultSet(address indexed vault);
    event PoolInitialized(address pool, uint256 tokenId);
    event LiquidityAdded(uint256 assetAmount, uint256 mimAmount, uint128 liquidity);
    event LiquidityRemoved(uint256 assetAmount, uint256 mimAmount);
    event FeesCollected(uint256 assetFees, uint256 mimFees);
    event Rebalanced(int24 newTickLower, int24 newTickUpper);

    // ============ Constructor ============
    
    constructor(
        address _positionManager,
        address _v3Factory,
        address _assetToken,
        address _mimToken
    ) Ownable(msg.sender) {
        positionManager = INonfungiblePositionManager(_positionManager);
        v3Factory = IUniswapV3Factory(_v3Factory);
        assetToken = IERC20(_assetToken);
        mimToken = IERC20(_mimToken);
    }

    // ============ Modifiers ============
    
    modifier onlyVault() {
        require(msg.sender == vault, "Only vault");
        _;
    }

    // ============ Admin Functions ============
    
    /**
     * @notice Set the vault address
     */
    function setVault(address _vault) external onlyOwner {
        vault = _vault;
        emit VaultSet(_vault);
    }

    /**
     * @notice Set tick range width for concentrated liquidity
     */
    function setTickRangeWidth(int24 _width) external onlyOwner {
        tickRangeWidth = _width;
    }

    /**
     * @notice Initialize the V3 pool (if needed) and create initial position
     */
    function initializePool(
        uint256 _initialAsset,
        uint256 _initialMIM,
        uint160 _sqrtPriceX96
    ) external onlyOwner {
        require(pool == address(0), "Already initialized");
        
        // Transfer initial tokens
        assetToken.safeTransferFrom(msg.sender, address(this), _initialAsset);
        mimToken.safeTransferFrom(msg.sender, address(this), _initialMIM);
        
        // Determine token order
        (address token0, address token1) = _sortTokens(address(assetToken), address(mimToken));
        
        // Get or create pool
        pool = v3Factory.getPool(token0, token1, POOL_FEE);
        if (pool == address(0)) {
            pool = v3Factory.createPool(token0, token1, POOL_FEE);
            IUniswapV3Pool(pool).initialize(_sqrtPriceX96);
        }
        
        // Approve tokens
        assetToken.approve(address(positionManager), type(uint256).max);
        mimToken.approve(address(positionManager), type(uint256).max);
        
        // Get current tick
        (, int24 currentTick,,,,,) = IUniswapV3Pool(pool).slot0();
        
        // Calculate tick range (centered around current price)
        int24 tickSpacing = _getTickSpacing(POOL_FEE);
        int24 tickLower = ((currentTick - tickRangeWidth) / tickSpacing) * tickSpacing;
        int24 tickUpper = ((currentTick + tickRangeWidth) / tickSpacing) * tickSpacing;
        
        // Determine amounts based on token order
        (uint256 amount0, uint256 amount1) = token0 == address(assetToken)
            ? (_initialAsset, _initialMIM)
            : (_initialMIM, _initialAsset);
        
        // Mint initial position
        (uint256 tokenId, uint128 liquidity, , ) = positionManager.mint(
            INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: POOL_FEE,
                tickLower: tickLower,
                tickUpper: tickUpper,
                amount0Desired: amount0,
                amount1Desired: amount1,
                amount0Min: 0,
                amount1Min: 0,
                recipient: address(this),
                deadline: block.timestamp
            })
        );
        
        positionId = tokenId;
        totalAssetsDeployed = _initialAsset;
        totalMIMDeployed = _initialMIM;
        
        emit PoolInitialized(pool, tokenId);
        emit LiquidityAdded(_initialAsset, _initialMIM, liquidity);
    }

    // ============ Strategy Functions ============
    
    /**
     * @notice Deploy assets to V3 LP
     * @param _assetAmount Amount of asset to deploy
     * @param _mimAmount Amount of MIM to deploy
     */
    function deploy(uint256 _assetAmount, uint256 _mimAmount) external onlyVault nonReentrant {
        require(positionId != 0, "Not initialized");
        
        // Transfer tokens from vault
        if (_assetAmount > 0) {
            assetToken.safeTransferFrom(msg.sender, address(this), _assetAmount);
        }
        if (_mimAmount > 0) {
            mimToken.safeTransferFrom(msg.sender, address(this), _mimAmount);
        }
        
        // Add liquidity to existing position
        (address token0,) = _sortTokens(address(assetToken), address(mimToken));
        (uint256 amount0, uint256 amount1) = token0 == address(assetToken)
            ? (_assetAmount, _mimAmount)
            : (_mimAmount, _assetAmount);
        
        (uint128 liquidity, , ) = positionManager.increaseLiquidity(
            INonfungiblePositionManager.IncreaseLiquidityParams({
                tokenId: positionId,
                amount0Desired: amount0,
                amount1Desired: amount1,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            })
        );
        
        totalAssetsDeployed += _assetAmount;
        totalMIMDeployed += _mimAmount;
        
        emit LiquidityAdded(_assetAmount, _mimAmount, liquidity);
    }

    /**
     * @notice Withdraw assets from V3 LP
     * @param _assetAmount Amount of asset to withdraw
     * @param _mimAmount Amount of MIM to withdraw
     */
    function withdraw(uint256 _assetAmount, uint256 _mimAmount) external onlyVault nonReentrant returns (
        uint256 actualAsset,
        uint256 actualMIM
    ) {
        require(positionId != 0, "Not initialized");
        
        // Calculate liquidity to remove proportionally
        (,,,,,,,uint128 totalLiquidity,,,,) = positionManager.positions(positionId);
        
        uint256 assetRatio = totalAssetsDeployed > 0 ? (_assetAmount * 1e18) / totalAssetsDeployed : 0;
        uint256 mimRatio = totalMIMDeployed > 0 ? (_mimAmount * 1e18) / totalMIMDeployed : 0;
        uint256 maxRatio = assetRatio > mimRatio ? assetRatio : mimRatio;
        
        uint128 liquidityToRemove = uint128((uint256(totalLiquidity) * maxRatio) / 1e18);
        if (liquidityToRemove == 0) liquidityToRemove = 1;
        if (liquidityToRemove > totalLiquidity) liquidityToRemove = totalLiquidity;
        
        // Decrease liquidity
        positionManager.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: positionId,
                liquidity: liquidityToRemove,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            })
        );
        
        // Collect tokens
        (uint256 collected0, uint256 collected1) = positionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: positionId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );
        
        // Determine actual amounts
        (address token0,) = _sortTokens(address(assetToken), address(mimToken));
        (actualAsset, actualMIM) = token0 == address(assetToken)
            ? (collected0, collected1)
            : (collected1, collected0);
        
        // Update totals
        totalAssetsDeployed = totalAssetsDeployed > actualAsset ? totalAssetsDeployed - actualAsset : 0;
        totalMIMDeployed = totalMIMDeployed > actualMIM ? totalMIMDeployed - actualMIM : 0;
        
        // Transfer to vault
        if (actualAsset > 0) {
            assetToken.safeTransfer(msg.sender, actualAsset);
        }
        if (actualMIM > 0) {
            mimToken.safeTransfer(msg.sender, actualMIM);
        }
        
        emit LiquidityRemoved(actualAsset, actualMIM);
    }

    /**
     * @notice Collect trading fees from the position
     */
    function collectFees() external onlyOwner returns (uint256 assetFees, uint256 mimFees) {
        require(positionId != 0, "Not initialized");
        
        // First decrease 0 liquidity to trigger fee collection
        positionManager.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: positionId,
                liquidity: 0,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            })
        );
        
        // Collect fees
        (uint256 collected0, uint256 collected1) = positionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: positionId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );
        
        // Determine fee amounts
        (address token0,) = _sortTokens(address(assetToken), address(mimToken));
        (assetFees, mimFees) = token0 == address(assetToken)
            ? (collected0, collected1)
            : (collected1, collected0);
        
        accumulatedAssetFees += assetFees;
        accumulatedMIMFees += mimFees;
        
        emit FeesCollected(assetFees, mimFees);
    }

    /**
     * @notice Rebalance position to new price range
     */
    function rebalance() external onlyOwner {
        require(positionId != 0, "Not initialized");
        
        // Get current position info
        (,,,,,,,uint128 currentLiquidity,,,,) = positionManager.positions(positionId);
        
        if (currentLiquidity == 0) return;
        
        // Remove all liquidity
        positionManager.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: positionId,
                liquidity: currentLiquidity,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            })
        );
        
        // Collect tokens
        (uint256 amount0, uint256 amount1) = positionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: positionId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );
        
        // Get new tick range centered on current price
        (, int24 currentTick,,,,,) = IUniswapV3Pool(pool).slot0();
        int24 tickSpacing = _getTickSpacing(POOL_FEE);
        int24 newTickLower = ((currentTick - tickRangeWidth) / tickSpacing) * tickSpacing;
        int24 newTickUpper = ((currentTick + tickRangeWidth) / tickSpacing) * tickSpacing;
        
        (address token0, address token1) = _sortTokens(address(assetToken), address(mimToken));
        
        // Mint new position at new range
        (uint256 newTokenId, uint128 newLiquidity, , ) = positionManager.mint(
            INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: POOL_FEE,
                tickLower: newTickLower,
                tickUpper: newTickUpper,
                amount0Desired: amount0,
                amount1Desired: amount1,
                amount0Min: 0,
                amount1Min: 0,
                recipient: address(this),
                deadline: block.timestamp
            })
        );
        
        positionId = newTokenId;
        
        emit Rebalanced(newTickLower, newTickUpper);
    }

    // ============ View Functions ============
    
    /**
     * @notice Get current position value
     */
    function getPositionValue() external view returns (
        uint256 assetValue,
        uint256 mimValue,
        uint128 liquidity
    ) {
        if (positionId == 0) return (0, 0, 0);
        
        (,,,,,,,liquidity,,,,) = positionManager.positions(positionId);
        assetValue = totalAssetsDeployed;
        mimValue = totalMIMDeployed;
    }

    /**
     * @notice Get strategy statistics
     */
    function getStats() external view returns (
        uint256 _totalAssets,
        uint256 _totalMIM,
        uint256 _assetFees,
        uint256 _mimFees,
        address _pool,
        uint256 _positionId
    ) {
        return (
            totalAssetsDeployed,
            totalMIMDeployed,
            accumulatedAssetFees,
            accumulatedMIMFees,
            pool,
            positionId
        );
    }

    // ============ Internal Functions ============
    
    function _sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    }

    function _getTickSpacing(uint24 fee) internal pure returns (int24) {
        if (fee == 100) return 1;
        if (fee == 500) return 10;
        if (fee == 3000) return 60;
        if (fee == 10000) return 200;
        return 60; // Default
    }
}

