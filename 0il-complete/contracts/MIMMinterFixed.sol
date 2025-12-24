// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IMIMToken
 * @notice Interface for MIM token
 */
interface IMIMToken {
    function mint(address _to, uint256 _amount) external;
    function burn(address _from, uint256 _amount) external;
    function burnFrom(address _from, uint256 _amount) external;
}

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
 * @title MIMMinterFixed
 * @notice Mints MIM 1:1 with sUSDC and manages V3 liquidity pool
 * @dev FIXES APPLIED:
 *   - BUG-001: Removed double minting - now only mints ONCE to user
 *   - sUSDC goes to protocol-owned LP, MIM minted only for user
 *   - Proper 1:1 backing maintained
 */
contract MIMMinterFixed is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice MIM token contract
    IMIMToken public immutable mimToken;

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

    /// @notice Pool fee tier (0.01% = 100)
    uint24 public constant POOL_FEE = 100;

    /// @notice Tick range for 0.995 - 1.005 price range
    int24 public constant TICK_LOWER = -50;
    int24 public constant TICK_UPPER = 50;

    /// @notice Minimum mint amount (1 sUSDC = 1e6)
    uint256 public constant MIN_MINT_AMOUNT = 1e6;

    /// @notice Total sUSDC deposited (equals total MIM minted for 1:1)
    uint256 public totalSUSDCDeposited;

    /// @notice Total MIM minted to users (NOT double counted)
    uint256 public totalMIMMinted;

    /// @notice Protocol-owned MIM in LP (separate tracking)
    uint256 public protocolMIMInLP;

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
        mimToken = IMIMToken(_mimToken);
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

        // Mint equivalent MIM for LP only (protocol-owned)
        mimToken.mint(address(this), _initialSUSDC);
        protocolMIMInLP = _initialSUSDC;

        // Determine token order (Uniswap requires token0 < token1)
        (address token0, address token1) = address(mimToken) < address(sUSDC)
            ? (address(mimToken), address(sUSDC))
            : (address(sUSDC), address(mimToken));

        // Create pool if doesn't exist
        pool = v3Factory.getPool(token0, token1, POOL_FEE);
        if (pool == address(0)) {
            pool = v3Factory.createPool(token0, token1, POOL_FEE);
            // Initialize at 1:1 price (sqrtPriceX96 for price 1.0)
            uint160 sqrtPriceX96 = 79228162514264337593543950336;
            IUniswapV3Pool(pool).initialize(sqrtPriceX96);
        }

        // Approve tokens to position manager
        IERC20(token0).approve(address(positionManager), type(uint256).max);
        IERC20(token1).approve(address(positionManager), type(uint256).max);

        // Mint initial position
        (uint256 tokenId, uint128 liquidity, uint256 used0, uint256 used1) = positionManager.mint(
            INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: POOL_FEE,
                tickLower: TICK_LOWER,
                tickUpper: TICK_UPPER,
                amount0Desired: _initialSUSDC,
                amount1Desired: _initialSUSDC,
                amount0Min: 0,
                amount1Min: 0,
                recipient: address(this),
                deadline: block.timestamp
            })
        );

        protocolPositionId = tokenId;
        totalSUSDCDeposited = _initialSUSDC;

        emit PoolInitialized(pool, tokenId);
        emit LiquidityAdded(used0, used1, liquidity);
    }

    /**
     * @notice Mint MIM tokens 1:1 with sUSDC
     * @dev FIX: Only mints ONCE to user - no double minting!
     * @param _amount Amount of sUSDC to deposit
     * @return mimAmount Amount of MIM minted
     */
    function mint(uint256 _amount) external nonReentrant returns (uint256 mimAmount) {
        require(_amount >= MIN_MINT_AMOUNT, "Amount too small");
        require(pool != address(0), "Pool not initialized");

        // Transfer sUSDC from user to this contract
        sUSDC.safeTransferFrom(msg.sender, address(this), _amount);

        // FIX: Only mint MIM ONCE to the user (not to LP)
        // The sUSDC deposited stays in this contract as backing
        mimAmount = _amount; // 1:1 ratio
        mimToken.mint(msg.sender, mimAmount);

        // Update totals
        totalSUSDCDeposited += _amount;
        totalMIMMinted += mimAmount;

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
        require(_amount <= totalMIMMinted, "Exceeds minted amount");

        // Calculate sUSDC to return (1:1 ratio)
        sUSDCAmount = _amount;

        // Check we have enough sUSDC
        uint256 availableSUSDC = sUSDC.balanceOf(address(this));
        require(availableSUSDC >= sUSDCAmount, "Insufficient sUSDC liquidity");

        // Burn MIM from user
        mimToken.burnFrom(msg.sender, _amount);

        // Transfer sUSDC to user
        sUSDC.safeTransfer(msg.sender, sUSDCAmount);

        totalSUSDCDeposited -= sUSDCAmount;
        totalMIMMinted -= _amount;

        emit Redeemed(msg.sender, _amount, sUSDCAmount);
    }

    /**
     * @notice Add sUSDC to LP pool (for yield generation)
     * @dev Only owner can add liquidity to protocol position
     * @param _amount Amount of sUSDC to add to LP
     */
    function addToLiquidity(uint256 _amount) external onlyOwner {
        require(protocolPositionId != 0, "Pool not initialized");
        require(sUSDC.balanceOf(address(this)) >= _amount, "Insufficient sUSDC");

        // Mint matching MIM for LP
        mimToken.mint(address(this), _amount);
        protocolMIMInLP += _amount;

        _addLiquidity(_amount, _amount);
    }

    /**
     * @notice Internal function to add liquidity to V3 pool
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
        uint256 _protocolMIMInLP,
        uint128 _liquidity,
        int24 _currentTick,
        uint256 _backingRatio // Should always be >= 1e18 (100%)
    ) {
        _totalSUSDCDeposited = totalSUSDCDeposited;
        _totalMIMMinted = totalMIMMinted;
        _protocolMIMInLP = protocolMIMInLP;

        if (protocolPositionId != 0) {
            (,,,,,,,_liquidity,,,,) = positionManager.positions(protocolPositionId);
        }

        if (pool != address(0)) {
            (, _currentTick,,,,,) = IUniswapV3Pool(pool).slot0();
        }

        // Calculate backing ratio (sUSDC / MIM minted) - should be 1:1 or better
        if (_totalMIMMinted > 0) {
            _backingRatio = (totalSUSDCDeposited * 1e18) / _totalMIMMinted;
        } else {
            _backingRatio = 1e18; // 100% backed when no minting
        }
    }

    /**
     * @notice Emergency withdraw sUSDC (owner only)
     * @param _to Recipient address
     * @param _amount Amount to withdraw
     */
    function emergencyWithdraw(address _to, uint256 _amount) external onlyOwner {
        sUSDC.safeTransfer(_to, _amount);
    }
}
