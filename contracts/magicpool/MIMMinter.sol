// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { MIMToken } from "./MIMToken.sol";

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

    function ownerOf(uint256 tokenId) external view returns (address);
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
}

/**
 * @title MIMMinter
 * @notice Mints MIM 1:1 with sUSDC and manages V3 liquidity pool (0.995-1.005 range)
 * @dev sUSDC received goes to MIM/sUSDC V3 pool in tight peg range
 */
contract MIMMinter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice MIM token contract
    MIMToken public immutable mimToken;
    
    /// @notice sUSDC token address (synthetic USDC on Sonic)
    IERC20 public immutable sUSDC;
    
    /// @notice Uniswap V3 position manager
    INonfungiblePositionManager public immutable positionManager;
    
    /// @notice Uniswap V3 factory
    IUniswapV3Factory public immutable v3Factory;
    
    /// @notice V3 pool for MIM/sUSDC
    address public pool;
    
    /// @notice V3 position token ID for the protocol's LP position
    uint256 public protocolPositionId;
    
    /// @notice Pool fee tier (0.01% = 100, 0.05% = 500, 0.3% = 3000)
    uint24 public constant POOL_FEE = 100; // 0.01% for stablecoin pair
    
    /// @notice Tick range for 0.995 - 1.005 price range
    /// For 6 decimal tokens: 1 tick = ~0.01% price change
    /// 0.995 = tick -50, 1.005 = tick +50 (approximately)
    int24 public constant TICK_LOWER = -50;
    int24 public constant TICK_UPPER = 50;
    
    /// @notice Minimum mint amount (1 sUSDC = 1e6)
    uint256 public constant MIN_MINT_AMOUNT = 1e6;

    /// @notice Total sUSDC deposited into the pool
    uint256 public totalSUSDCDeposited;
    
    /// @notice Total MIM minted
    uint256 public totalMIMMinted;

    /// @notice Emitted when MIM is minted
    event Minted(address indexed user, uint256 sUSDCAmount, uint256 mimAmount);
    
    /// @notice Emitted when MIM is redeemed
    event Redeemed(address indexed user, uint256 mimAmount, uint256 sUSDCAmount);
    
    /// @notice Emitted when liquidity is added to V3 pool
    event LiquidityAdded(uint256 amount0, uint256 amount1, uint128 liquidity);
    
    /// @notice Emitted when pool is initialized
    event PoolInitialized(address pool, uint256 tokenId);

    constructor(
        address _mimToken,
        address _sUSDC,
        address _positionManager,
        address _v3Factory
    ) Ownable(msg.sender) {
        mimToken = MIMToken(_mimToken);
        sUSDC = IERC20(_sUSDC);
        positionManager = INonfungiblePositionManager(_positionManager);
        v3Factory = IUniswapV3Factory(_v3Factory);
    }

    /**
     * @notice Initialize the MIM/sUSDC V3 pool
     * @dev Creates pool if it doesn't exist and mints initial position
     * @param _initialSUSDC Initial sUSDC to seed the pool
     */
    function initializePool(uint256 _initialSUSDC) external onlyOwner {
        require(pool == address(0), "Pool already initialized");
        require(_initialSUSDC >= MIN_MINT_AMOUNT, "Amount too small");

        // Transfer sUSDC from owner
        sUSDC.safeTransferFrom(msg.sender, address(this), _initialSUSDC);
        
        // Mint equivalent MIM
        mimToken.mint(address(this), _initialSUSDC);

        // Determine token order (Uniswap requires token0 < token1)
        (address token0, address token1) = address(mimToken) < address(sUSDC)
            ? (address(mimToken), address(sUSDC))
            : (address(sUSDC), address(mimToken));

        // Create pool if doesn't exist
        pool = v3Factory.getPool(token0, token1, POOL_FEE);
        if (pool == address(0)) {
            pool = v3Factory.createPool(token0, token1, POOL_FEE);
            // Initialize at 1:1 price (sqrtPriceX96 for price 1.0)
            // sqrtPriceX96 = sqrt(1) * 2^96 = 2^96 = 79228162514264337593543950336
            uint160 sqrtPriceX96 = 79228162514264337593543950336;
            IUniswapV3Pool(pool).initialize(sqrtPriceX96);
        }

        // Approve tokens to position manager
        IERC20(token0).approve(address(positionManager), type(uint256).max);
        IERC20(token1).approve(address(positionManager), type(uint256).max);

        // Determine amounts based on token order
        (uint256 amount0, uint256 amount1) = token0 == address(mimToken)
            ? (_initialSUSDC, _initialSUSDC)
            : (_initialSUSDC, _initialSUSDC);

        // Mint initial position
        (uint256 tokenId, uint128 liquidity, uint256 used0, uint256 used1) = positionManager.mint(
            INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: POOL_FEE,
                tickLower: TICK_LOWER,
                tickUpper: TICK_UPPER,
                amount0Desired: amount0,
                amount1Desired: amount1,
                amount0Min: 0,
                amount1Min: 0,
                recipient: address(this),
                deadline: block.timestamp
            })
        );

        protocolPositionId = tokenId;
        totalSUSDCDeposited = _initialSUSDC;
        totalMIMMinted = _initialSUSDC;

        emit PoolInitialized(pool, tokenId);
        emit LiquidityAdded(used0, used1, liquidity);
    }

    /**
     * @notice Mint MIM tokens 1:1 with sUSDC
     * @param _amount Amount of sUSDC to deposit
     * @return mimAmount Amount of MIM minted
     */
    function mint(uint256 _amount) external nonReentrant returns (uint256 mimAmount) {
        require(_amount >= MIN_MINT_AMOUNT, "Amount too small");
        require(pool != address(0), "Pool not initialized");

        // Transfer sUSDC from user
        sUSDC.safeTransferFrom(msg.sender, address(this), _amount);
        
        // Mint MIM to this contract first (for adding to LP)
        mimAmount = _amount; // 1:1 ratio
        mimToken.mint(address(this), mimAmount);
        
        // Add liquidity to V3 pool (both MIM and sUSDC)
        _addLiquidity(_amount, mimAmount);
        
        // Mint MIM to user
        mimToken.mint(msg.sender, mimAmount);
        
        totalSUSDCDeposited += _amount;
        totalMIMMinted += mimAmount * 2; // We minted twice (for LP and for user)

        emit Minted(msg.sender, _amount, mimAmount);
    }

    /**
     * @notice Redeem MIM for sUSDC
     * @param _amount Amount of MIM to burn
     * @return sUSDCAmount Amount of sUSDC returned
     */
    function redeem(uint256 _amount) external nonReentrant returns (uint256 sUSDCAmount) {
        require(_amount >= MIN_MINT_AMOUNT, "Amount too small");
        require(pool != address(0), "Pool not initialized");

        // Get available sUSDC from removing liquidity
        sUSDCAmount = _removeLiquidity(_amount);
        
        // Burn MIM from user
        mimToken.burnFrom(msg.sender, _amount);
        
        // Transfer sUSDC to user
        sUSDC.safeTransfer(msg.sender, sUSDCAmount);
        
        totalSUSDCDeposited -= sUSDCAmount;
        totalMIMMinted -= _amount;

        emit Redeemed(msg.sender, _amount, sUSDCAmount);
    }

    /**
     * @notice Add liquidity to the V3 pool
     */
    function _addLiquidity(uint256 _sUSDCAmount, uint256 _mimAmount) internal {
        if (protocolPositionId == 0) return;

        (address token0, address token1) = address(mimToken) < address(sUSDC)
            ? (address(mimToken), address(sUSDC))
            : (address(sUSDC), address(mimToken));

        (uint256 amount0, uint256 amount1) = token0 == address(mimToken)
            ? (_mimAmount, _sUSDCAmount)
            : (_sUSDCAmount, _mimAmount);

        (uint128 liquidity, uint256 used0, uint256 used1) = positionManager.increaseLiquidity(
            INonfungiblePositionManager.IncreaseLiquidityParams({
                tokenId: protocolPositionId,
                amount0Desired: amount0,
                amount1Desired: amount1,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            })
        );

        emit LiquidityAdded(used0, used1, liquidity);
    }

    /**
     * @notice Remove liquidity from the V3 pool
     */
    function _removeLiquidity(uint256 _mimAmount) internal returns (uint256 sUSDCAmount) {
        if (protocolPositionId == 0) return 0;

        // Get current position liquidity
        (,,,,,,,uint128 liquidity,,,,) = positionManager.positions(protocolPositionId);
        
        // Calculate how much liquidity to remove proportionally
        // This is approximate - in production, calculate more precisely
        uint128 liquidityToRemove = uint128((uint256(liquidity) * _mimAmount) / totalMIMMinted);
        if (liquidityToRemove == 0) liquidityToRemove = 1;

        // Decrease liquidity
        (uint256 amount0, uint256 amount1) = positionManager.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: protocolPositionId,
                liquidity: liquidityToRemove,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            })
        );

        // Collect tokens
        (uint256 collected0, uint256 collected1) = positionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: protocolPositionId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );

        // Determine which is sUSDC
        (address token0,) = address(mimToken) < address(sUSDC)
            ? (address(mimToken), address(sUSDC))
            : (address(sUSDC), address(mimToken));

        sUSDCAmount = token0 == address(sUSDC) ? collected0 : collected1;
        
        // Burn MIM received from LP
        uint256 mimReceived = token0 == address(mimToken) ? collected0 : collected1;
        if (mimReceived > 0) {
            mimToken.burn(address(this), mimReceived);
        }
    }

    /**
     * @notice Collect trading fees from the V3 position
     * @return amount0 Fees in token0
     * @return amount1 Fees in token1
     */
    function collectFees() external onlyOwner returns (uint256 amount0, uint256 amount1) {
        require(protocolPositionId != 0, "No position");
        
        (amount0, amount1) = positionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: protocolPositionId,
                recipient: owner(),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );
    }

    /**
     * @notice Get pool statistics
     */
    function getPoolStats() external view returns (
        uint256 _totalSUSDCDeposited,
        uint256 _totalMIMMinted,
        uint128 _liquidity,
        int24 _currentTick
    ) {
        _totalSUSDCDeposited = totalSUSDCDeposited;
        _totalMIMMinted = totalMIMMinted;
        
        if (protocolPositionId != 0) {
            (,,,,,,,_liquidity,,,,) = positionManager.positions(protocolPositionId);
        }
        
        if (pool != address(0)) {
            (, _currentTick,,,,,) = IUniswapV3Pool(pool).slot0();
        }
    }
}

