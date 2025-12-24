// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title GatewayVaultComplete
 * @notice Gateway for cross-chain deposits with RESCUE functionality
 * @dev This is a simplified gateway with rescue tokens for safety
 *      In production, this integrates with LayerZero OApp
 *
 * SAFETY FEATURES:
 *   - rescueTokens(): Owner can rescue stuck tokens if Hub fails
 *   - rescueUserTokens(): Users can rescue their own deposits after timeout
 *   - Emergency mode: Pauses cross-chain and enables local withdrawals
 */
contract GatewayVaultComplete is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Structs ============

    struct PendingDeposit {
        address user;
        address token;
        uint256 amount;
        uint256 timestamp;
        bool completed;
        bool rescued;
    }

    struct AvailableToken {
        bool enabled;
        address tokenAddress;
        uint256 minBridgeAmount;
        uint256 totalDeposited;
        uint256 totalWithdrawn;
    }

    // ============ Constants ============

    /// @notice Rescue timeout - users can rescue after this time if not completed
    uint256 public constant RESCUE_TIMEOUT = 24 hours;

    /// @notice Hub chain EID (Sonic = 30332)
    uint32 public constant HUB_EID = 30332;

    // ============ State Variables ============

    /// @notice Emergency mode - allows local withdrawals
    bool public emergencyMode;

    /// @notice Mapping of available tokens
    mapping(address => AvailableToken) public availableTokens;

    /// @notice List of token addresses
    address[] public tokenList;

    /// @notice Pending deposits by ID
    mapping(uint256 => PendingDeposit) public pendingDeposits;

    /// @notice Next deposit ID
    uint256 public nextDepositId;

    /// @notice User's pending deposit IDs
    mapping(address => uint256[]) public userPendingDeposits;

    /// @notice Rescued amounts per user per token
    mapping(address => mapping(address => uint256)) public rescuedAmounts;

    // ============ Events ============

    event TokenEnabled(address indexed token, uint256 minAmount);
    event TokenDisabled(address indexed token);
    event DepositInitiated(uint256 indexed depositId, address indexed user, address token, uint256 amount);
    event DepositCompleted(uint256 indexed depositId);
    event WithdrawalReceived(address indexed user, address token, uint256 amount);
    event TokensRescuedByOwner(address indexed token, address indexed to, uint256 amount);
    event TokensRescuedByUser(uint256 indexed depositId, address indexed user, address token, uint256 amount);
    event EmergencyModeEnabled();
    event EmergencyModeDisabled();

    // ============ Constructor ============

    constructor() Ownable(msg.sender) {}

    // ============ Admin Functions ============

    /**
     * @notice Enable a token for bridging
     */
    function enableToken(address token, uint256 minAmount) external onlyOwner {
        if (!availableTokens[token].enabled) {
            tokenList.push(token);
        }

        availableTokens[token] = AvailableToken({
            enabled: true,
            tokenAddress: token,
            minBridgeAmount: minAmount,
            totalDeposited: availableTokens[token].totalDeposited,
            totalWithdrawn: availableTokens[token].totalWithdrawn
        });

        emit TokenEnabled(token, minAmount);
    }

    /**
     * @notice Disable a token
     */
    function disableToken(address token) external onlyOwner {
        availableTokens[token].enabled = false;
        emit TokenDisabled(token);
    }

    /**
     * @notice Enable emergency mode
     * @dev Allows users to withdraw their pending deposits locally
     */
    function enableEmergencyMode() external onlyOwner {
        emergencyMode = true;
        emit EmergencyModeEnabled();
    }

    /**
     * @notice Disable emergency mode
     */
    function disableEmergencyMode() external onlyOwner {
        emergencyMode = false;
        emit EmergencyModeDisabled();
    }

    /**
     * @notice RESCUE: Owner can rescue any stuck tokens
     * @dev Use this if Hub chain fails and tokens are stuck
     * @param token Token to rescue
     * @param to Recipient address
     * @param amount Amount to rescue
     */
    function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        IERC20(token).safeTransfer(to, amount);
        emit TokensRescuedByOwner(token, to, amount);
    }

    /**
     * @notice RESCUE: Rescue multiple tokens at once
     */
    function rescueTokensBatch(
        address[] calldata tokens,
        address to,
        uint256[] calldata amounts
    ) external onlyOwner {
        require(tokens.length == amounts.length, "Length mismatch");
        for (uint256 i = 0; i < tokens.length; i++) {
            IERC20(tokens[i]).safeTransfer(to, amounts[i]);
            emit TokensRescuedByOwner(tokens[i], to, amounts[i]);
        }
    }

    /**
     * @notice RESCUE: Rescue ETH
     */
    function rescueETH(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        (bool success, ) = to.call{value: amount}("");
        require(success, "ETH transfer failed");
    }

    // ============ User Functions ============

    /**
     * @notice Deposit tokens to bridge to Hub
     * @param token Token address to deposit
     * @param amount Amount to deposit
     */
    function deposit(address token, uint256 amount) external payable nonReentrant {
        require(!emergencyMode, "Emergency mode active");
        require(availableTokens[token].enabled, "Token not enabled");
        require(amount >= availableTokens[token].minBridgeAmount, "Amount too small");

        // Transfer tokens from user
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Create pending deposit
        uint256 depositId = nextDepositId++;
        pendingDeposits[depositId] = PendingDeposit({
            user: msg.sender,
            token: token,
            amount: amount,
            timestamp: block.timestamp,
            completed: false,
            rescued: false
        });

        userPendingDeposits[msg.sender].push(depositId);
        availableTokens[token].totalDeposited += amount;

        // In production: Send LayerZero message to Hub
        // _lzSend(HUB_EID, payload, options, fee);

        emit DepositInitiated(depositId, msg.sender, token, amount);
    }

    /**
     * @notice RESCUE: User can rescue their own pending deposit after timeout
     * @dev Only works if deposit hasn't been completed on Hub
     * @param depositId Deposit ID to rescue
     */
    function rescueMyDeposit(uint256 depositId) external nonReentrant {
        PendingDeposit storage pd = pendingDeposits[depositId];

        require(pd.user == msg.sender, "Not your deposit");
        require(!pd.completed, "Already completed");
        require(!pd.rescued, "Already rescued");
        require(
            block.timestamp >= pd.timestamp + RESCUE_TIMEOUT || emergencyMode,
            "Rescue timeout not reached"
        );

        pd.rescued = true;

        // Return tokens to user
        IERC20(pd.token).safeTransfer(msg.sender, pd.amount);
        rescuedAmounts[msg.sender][pd.token] += pd.amount;

        emit TokensRescuedByUser(depositId, msg.sender, pd.token, pd.amount);
    }

    /**
     * @notice Emergency withdraw in emergency mode
     */
    function emergencyWithdraw(uint256 depositId) external nonReentrant {
        require(emergencyMode, "Not in emergency mode");

        PendingDeposit storage pd = pendingDeposits[depositId];
        require(pd.user == msg.sender, "Not your deposit");
        require(!pd.completed && !pd.rescued, "Invalid state");

        pd.rescued = true;

        IERC20(pd.token).safeTransfer(msg.sender, pd.amount);

        emit TokensRescuedByUser(depositId, msg.sender, pd.token, pd.amount);
    }

    // ============ Hub Callback Functions ============

    /**
     * @notice Called when Hub confirms deposit
     * @dev In production: Called via LayerZero _lzReceive
     */
    function confirmDeposit(uint256 depositId) external onlyOwner {
        PendingDeposit storage pd = pendingDeposits[depositId];
        require(!pd.completed && !pd.rescued, "Invalid state");

        pd.completed = true;

        emit DepositCompleted(depositId);
    }

    /**
     * @notice Process withdrawal from Hub
     * @dev In production: Called via LayerZero _lzReceive
     */
    function processWithdrawal(
        address user,
        address token,
        uint256 amount
    ) external onlyOwner {
        require(IERC20(token).balanceOf(address(this)) >= amount, "Insufficient balance");

        IERC20(token).safeTransfer(user, amount);
        availableTokens[token].totalWithdrawn += amount;

        emit WithdrawalReceived(user, token, amount);
    }

    // ============ View Functions ============

    /**
     * @notice Get all available tokens
     */
    function getAllAvailableTokens() external view returns (AvailableToken[] memory) {
        AvailableToken[] memory tokens = new AvailableToken[](tokenList.length);
        for (uint256 i = 0; i < tokenList.length; i++) {
            tokens[i] = availableTokens[tokenList[i]];
        }
        return tokens;
    }

    /**
     * @notice Get user's pending deposits
     */
    function getUserPendingDeposits(address user) external view returns (uint256[] memory) {
        return userPendingDeposits[user];
    }

    /**
     * @notice Check if deposit can be rescued
     */
    function canRescueDeposit(uint256 depositId) external view returns (bool) {
        PendingDeposit storage pd = pendingDeposits[depositId];
        if (pd.completed || pd.rescued) return false;
        return block.timestamp >= pd.timestamp + RESCUE_TIMEOUT || emergencyMode;
    }

    /**
     * @notice Get gateway stats
     */
    function getStats() external view returns (
        uint256 totalTokens,
        uint256 totalPendingDeposits,
        bool isEmergency
    ) {
        totalTokens = tokenList.length;
        totalPendingDeposits = nextDepositId;
        isEmergency = emergencyMode;
    }

    // ============ Receive ETH ============

    receive() external payable {}
}
