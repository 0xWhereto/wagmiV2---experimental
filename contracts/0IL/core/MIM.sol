// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MIM - Magic Internet Money
 * @notice The native stablecoin of the 0IL Protocol
 * @dev 1:1 USDC-backed stablecoin
 *      USDC deposited goes to MIM/USDC V3 pool at 0.995-1.005 range (0.1% fee tier)
 *      This creates deep peg liquidity and earns trading fees
 */
contract MIM is ERC20, ERC20Permit, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    /// @notice Mapping of authorized minters and their allowances
    mapping(address => uint256) public minterAllowance;
    
    /// @notice Mapping to check if an address is a minter
    mapping(address => bool) public isMinter;
    
    /// @notice USDC token address
    address public immutable usdc;
    
    /// @notice Uniswap V3 Position Manager
    INonfungiblePositionManager public immutable positionManager;
    
    /// @notice MIM/USDC V3 Pool
    address public mimUsdcPool;
    
    /// @notice V3 Position NFT ID for our liquidity
    uint256 public liquidityPositionId;
    
    /// @notice Total liquidity in the V3 position
    uint128 public totalLiquidity;
    
    /// @notice Fee tier for MIM/USDC pool (0.01% = 100 for stablecoins)
    uint24 public constant POOL_FEE = 100; // 0.01% fee tier
    
    /// @notice Tick range - set dynamically based on token ordering
    /// For 1:1 peg with 6 vs 18 decimal adjustment:
    /// If USDC is token0 (lower address): price = MIM/USDC = 1e12, tick ≈ +276325
    /// If MIM is token0 (lower address): price = USDC/MIM = 1e-12, tick ≈ -276325
    int24 public immutable TICK_LOWER;
    int24 public immutable TICK_UPPER;
    
    /// @notice Whether USDC is token0 (lower address)
    bool public immutable usdcIsToken0;
    
    /// @notice Events
    event MinterSet(address indexed minter, uint256 allowance);
    event MinterRemoved(address indexed minter);
    event Minted(address indexed to, uint256 amount, address indexed minter);
    event Burned(address indexed from, uint256 amount);
    event MintedWithUSDC(address indexed user, uint256 usdcAmount, uint256 mimAmount, uint128 liquidityAdded);
    event RedeemedForUSDC(address indexed user, uint256 mimAmount, uint256 usdcAmount, uint128 liquidityRemoved);
    event PoolSet(address indexed pool);
    event FeesCollected(uint256 fee0, uint256 fee1);
    
    /// @notice Errors
    error NotMinter();
    error ExceedsAllowance();
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientLiquidity();
    error PoolNotSet();
    
    constructor(
        address _usdc,
        address _positionManager
    ) 
        ERC20("Magic Internet Money", "MIM") 
        ERC20Permit("Magic Internet Money")
        Ownable(msg.sender)
    {
        if (_usdc == address(0) || _positionManager == address(0)) revert ZeroAddress();
        usdc = _usdc;
        positionManager = INonfungiblePositionManager(_positionManager);
        
        // Determine token ordering
        // MIM address is known at construction via address(this)
        usdcIsToken0 = _usdc < address(this);
        
        // Set tick range based on token ordering
        // For 1:1 peg between 6 decimal USDC and 18 decimal MIM:
        // tick = ln(price) / ln(1.0001) where price = token1/token0 in raw units
        if (usdcIsToken0) {
            // USDC is token0, MIM is token1
            // price = MIM/USDC = 1e12 in raw units for 1:1 USD peg
            // tick = ln(1e12) / ln(1.0001) ≈ 276325
            TICK_LOWER = 275700;  // ~0.995 parity
            TICK_UPPER = 276900;  // ~1.005 parity
        } else {
            // MIM is token0, USDC is token1
            // price = USDC/MIM = 1e-12 in raw units for 1:1 USD peg
            // tick = ln(1e-12) / ln(1.0001) ≈ -276325
            TICK_LOWER = -276900; // ~0.995 parity (inverted)
            TICK_UPPER = -275700; // ~1.005 parity (inverted)
        }
        
        // Approve position manager to spend USDC held by this contract
        IERC20(_usdc).approve(_positionManager, type(uint256).max);
        
        // Approve position manager to spend MIM minted to this contract
        // This is needed for adding liquidity to the V3 pool
        _approve(address(this), _positionManager, type(uint256).max);
    }
    
    /**
     * @notice Set the MIM/USDC pool address
     */
    function setPool(address _pool) external onlyOwner {
        if (_pool == address(0)) revert ZeroAddress();
        mimUsdcPool = _pool;
        emit PoolSet(_pool);
    }
    
    /**
     * @notice Set minter allowance
     * @param minter Address to authorize as minter
     * @param allowance Maximum amount the minter can mint
     */
    function setMinter(address minter, uint256 allowance) external onlyOwner {
        if (minter == address(0)) revert ZeroAddress();
        
        minterAllowance[minter] = allowance;
        isMinter[minter] = allowance > 0;
        
        emit MinterSet(minter, allowance);
    }
    
    /**
     * @notice Remove minter authorization
     * @param minter Address to remove as minter
     */
    function removeMinter(address minter) external onlyOwner {
        minterAllowance[minter] = 0;
        isMinter[minter] = false;
        
        emit MinterRemoved(minter);
    }
    
    /**
     * @notice Mint MIM tokens (minter only)
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external {
        if (!isMinter[msg.sender]) revert NotMinter();
        if (amount > minterAllowance[msg.sender]) revert ExceedsAllowance();
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        
        minterAllowance[msg.sender] -= amount;
        _mint(to, amount);
        
        emit Minted(to, amount, msg.sender);
    }
    
    /**
     * @notice Burn MIM tokens
     * @param amount Amount to burn
     */
    function burn(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        
        _burn(msg.sender, amount);
        
        emit Burned(msg.sender, amount);
    }
    
    /**
     * @notice Mint MIM by depositing USDC (1:1)
     * @dev USDC + newly minted MIM go to V3 pool at 0.995-1.005 range
     * @param amount Amount of USDC to deposit (and MIM to receive)
     */
    function mintWithUSDC(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (mimUsdcPool == address(0)) revert PoolNotSet();
        
        // Transfer USDC from user
        IERC20(usdc).safeTransferFrom(msg.sender, address(this), amount);
        
        // Mint MIM 1:1 (USDC has 6 decimals, MIM has 18)
        uint256 mimAmount = amount * 1e12;
        _mint(address(this), mimAmount); // Mint to contract first for LP
        
        // Add liquidity to MIM/USDC V3 pool at tight range
        uint128 liquidityAdded = _addLiquidityToPool(amount, mimAmount);
        
        // Also mint MIM to user
        _mint(msg.sender, mimAmount);
        
        emit MintedWithUSDC(msg.sender, amount, mimAmount, liquidityAdded);
    }
    
    /**
     * @notice Redeem MIM for USDC (1:1)
     * @dev Removes liquidity from V3 pool to return USDC
     * @param mimAmount Amount of MIM to redeem
     */
    function redeemForUSDC(uint256 mimAmount) external nonReentrant {
        if (mimAmount == 0) revert ZeroAmount();
        if (mimUsdcPool == address(0)) revert PoolNotSet();
        
        // Calculate USDC amount (18 decimals to 6 decimals)
        uint256 usdcAmount = mimAmount / 1e12;
        
        // Burn user's MIM
        _burn(msg.sender, mimAmount);
        
        // Remove liquidity from pool to get USDC
        uint256 usdcReceived = _removeLiquidityFromPool(usdcAmount, mimAmount);
        
        if (usdcReceived < usdcAmount) revert InsufficientLiquidity();
        
        // Transfer USDC to user
        IERC20(usdc).safeTransfer(msg.sender, usdcAmount);
        
        // Burn the MIM we got back from LP
        uint256 mimBalance = balanceOf(address(this));
        if (mimBalance > 0) {
            _burn(address(this), mimBalance);
        }
        
        emit RedeemedForUSDC(msg.sender, mimAmount, usdcAmount, uint128(usdcAmount));
    }
    
    /**
     * @notice Add liquidity to MIM/USDC V3 pool at tight peg range
     */
    function _addLiquidityToPool(
        uint256 usdcAmount,
        uint256 mimAmount
    ) internal returns (uint128 liquidity) {
        // Determine token ordering for params
        address token0 = usdcIsToken0 ? usdc : address(this);
        address token1 = usdcIsToken0 ? address(this) : usdc;
        uint256 amount0Desired = usdcIsToken0 ? usdcAmount : mimAmount;
        uint256 amount1Desired = usdcIsToken0 ? mimAmount : usdcAmount;
        
        if (liquidityPositionId == 0) {
            // Create new position
            INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: POOL_FEE,
                tickLower: TICK_LOWER,
                tickUpper: TICK_UPPER,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: 0,
                amount1Min: 0,
                recipient: address(this),
                deadline: block.timestamp
            });
            
            (liquidityPositionId, liquidity,,) = positionManager.mint(params);
        } else {
            // Add to existing position
            INonfungiblePositionManager.IncreaseLiquidityParams memory params = 
                INonfungiblePositionManager.IncreaseLiquidityParams({
                    tokenId: liquidityPositionId,
                    amount0Desired: amount0Desired,
                    amount1Desired: amount1Desired,
                    amount0Min: 0,
                    amount1Min: 0,
                    deadline: block.timestamp
                });
            
            (liquidity,,) = positionManager.increaseLiquidity(params);
        }
        
        totalLiquidity += liquidity;
    }
    
    /**
     * @notice Remove liquidity from MIM/USDC V3 pool
     */
    function _removeLiquidityFromPool(
        uint256 usdcAmount,
        uint256 mimAmount
    ) internal returns (uint256 usdcReceived) {
        if (liquidityPositionId == 0 || totalLiquidity == 0) revert InsufficientLiquidity();
        
        // Calculate liquidity to remove (proportional)
        // Simplified: remove based on USDC amount ratio
        (,,,,,,, uint128 positionLiquidity,,,,) = positionManager.positions(liquidityPositionId);
        
        // Estimate liquidity needed (simplified)
        uint128 liquidityToRemove = uint128((uint256(positionLiquidity) * usdcAmount * 1e12) / (totalSupply() + mimAmount));
        
        if (liquidityToRemove > totalLiquidity) {
            liquidityToRemove = totalLiquidity;
        }
        
        // Remove liquidity
        INonfungiblePositionManager.DecreaseLiquidityParams memory params =
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: liquidityPositionId,
                liquidity: liquidityToRemove,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            });
        
        positionManager.decreaseLiquidity(params);
        
        // Collect tokens
        INonfungiblePositionManager.CollectParams memory collectParams =
            INonfungiblePositionManager.CollectParams({
                tokenId: liquidityPositionId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            });
        
        (uint256 amount0, uint256 amount1) = positionManager.collect(collectParams);
        
        totalLiquidity -= liquidityToRemove;
        
        // Return USDC amount (depends on token order)
        usdcReceived = usdcIsToken0 ? amount0 : amount1;
    }
    
    /**
     * @notice Collect trading fees from the V3 position
     * @dev Anyone can call, fees stay in contract to deepen liquidity
     */
    function collectFees() external nonReentrant returns (uint256 fee0, uint256 fee1) {
        if (liquidityPositionId == 0) return (0, 0);
        
        INonfungiblePositionManager.CollectParams memory params =
            INonfungiblePositionManager.CollectParams({
                tokenId: liquidityPositionId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            });
        
        (fee0, fee1) = positionManager.collect(params);
        
        emit FeesCollected(fee0, fee1);
    }
    
    /**
     * @notice Get current liquidity position info
     */
    function getLiquidityInfo() external view returns (
        uint256 positionId,
        uint128 liquidity,
        uint256 usdcInPool,
        uint256 mimInPool
    ) {
        positionId = liquidityPositionId;
        liquidity = totalLiquidity;
        
        if (positionId > 0) {
            // Would need to calculate from position - simplified
            usdcInPool = IERC20(usdc).balanceOf(mimUsdcPool);
            mimInPool = balanceOf(mimUsdcPool);
        }
    }
    
    /**
     * @notice Rescue any stuck tokens from the contract
     * @param token The token to rescue
     * @param to Recipient address
     * @param amount Amount to rescue (0 for all)
     */
    function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 toTransfer = amount == 0 ? balance : (amount > balance ? balance : amount);
        IERC20(token).safeTransfer(to, toTransfer);
    }
}

// ============ Interfaces ============

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
    
    function mint(MintParams calldata params) external returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);
    function increaseLiquidity(IncreaseLiquidityParams calldata params) external returns (uint128 liquidity, uint256 amount0, uint256 amount1);
    function decreaseLiquidity(DecreaseLiquidityParams calldata params) external returns (uint256 amount0, uint256 amount1);
    function collect(CollectParams calldata params) external returns (uint256 amount0, uint256 amount1);
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
}

