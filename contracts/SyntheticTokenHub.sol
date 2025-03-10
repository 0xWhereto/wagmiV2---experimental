// SPDX-License-Identifier: MIT

pragma solidity 0.8.23;

import { TransferHelper } from "./libraries/TransferHelper.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { OApp, MessagingFee, Origin } from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import { MessagingReceipt } from "@layerzerolabs/oapp-evm/contracts/oapp/OAppSender.sol";
import { OAppOptionsType3 } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OAppOptionsType3.sol";
import { ISyntheticToken } from "./interfaces/ISyntheticToken.sol";
import { SyntheticToken } from "./SyntheticToken.sol";

/**
 * @title SyntheticTokenHub
 * @notice Central contract managing synthetic tokens for cross-chain interaction
 * @dev This contract receives deposits from other networks via GatewayVault and mints synthetic tokens
 */
contract SyntheticTokenHub is OApp, OAppOptionsType3 {
    using TransferHelper for address;

    struct Asset {
        address tokenAddress;
        uint256 tokenAmount;
    }

    struct AssetEntry {
        uint256 tokenIndex;
        uint256 tokenAmount;
    }

    struct SyntheticTokenInfo {
        address tokenAddress;
        string tokenSymbol;
        uint8 tokenDecimals;
        bool isPaused;
        mapping(uint32 => RemoteTokenInfo) remoteTokens; // eid => RemoteTokenInfo
        mapping(uint32 => bool) supportedChains; // eid => isSupported
        uint32[] chainList; // List of supported chains for iteration
    }

    struct RemoteTokenInfo {
        address remoteAddress;
        bool isPaused;
        uint256 totalBalance;
        int8 decimalsDelta;
    }

    struct RemoteChainInfo {
        uint32 eid;
        address gatewayVault;
        bool isActive;
    }

    struct SyntheticTokenView {
        address tokenAddress;
        string tokenSymbol;
        uint8 tokenDecimals;
        bool isPaused;
        uint32[] supportedChains;
    }

    struct RemoteTokenView {
        uint32 eid;
        address remoteAddress;
        bool isPaused;
        uint256 totalBalance;
        int8 decimalsDelta;
    }

    // Synthetic tokens registry
    mapping(uint256 => SyntheticTokenInfo) public syntheticTokens;
    uint256 public syntheticTokenCount;

    // Mapping for quick chain lookup: eid => RemoteChainInfo index + 1 (0 means not found)
    mapping(uint32 => uint256) private _chainIndexByEid;

    // Mapping for token lookup: tokenAddress => tokenIndex + 1 (0 means not found)
    mapping(address => uint256) private _tokenIndexByAddress;

    // Mapping for token lookup by network and remote address
    mapping(uint32 => mapping(address => uint256)) private _tokenIndexByRemoteAddress; // eid => remote address => token index + 1

    // Supported chains registry
    RemoteChainInfo[] public supportedChains;

    // Mapping to validate gateways in different networks
    mapping(uint32 => mapping(address => bool)) public validGateways;

    // Add constant for the base token name
    string public constant TOKEN_NAME_PREFIX = "Synthetic ";

    // Events
    event SyntheticTokenAdded(
        uint256 indexed tokenIndex,
        address tokenAddress,
        string symbol,
        uint8 decimals
    );
    event RemoteTokenLinked(
        uint256 indexed tokenIndex,
        uint32 eid,
        address remoteAddress,
        int8 decimalsDelta
    );
    event TokenMinted(
        uint256 indexed tokenIndex,
        address recipient,
        uint256 amount,
        uint32 sourceEid
    );
    event TokenBurned(uint256 indexed tokenIndex, address sender, uint256 amount, uint32 targetEid);
    event ChainAdded(uint32 eid, address gatewayVault);
    event ChainStatusUpdated(uint32 eid, bool isActive);
    event TokenPaused(uint256 indexed tokenIndex, bool isPaused);
    event RemoteTokenPaused(uint256 indexed tokenIndex, uint32 eid, bool isPaused);
    event MessageSent(bytes32 guid, address recipient, Asset[] assets, uint32 dstEid);
    event MessageReceived(bytes32 guid, address recipient, Asset[] assets, uint32 srcEid);

    /**
     * @dev Modifier to check if token index is valid
     * @param _tokenIndex Token index to check
     */
    modifier validTokenIndex(uint256 _tokenIndex) {
        require(_tokenIndex < syntheticTokenCount, "Invalid token index");
        _;
    }

    constructor(address _endpoint, address _owner) OApp(_endpoint, _owner) Ownable(_owner) {}

    /**
     * @notice Adds a new supported chain
     * @param _eid Chain endpoint identifier in LayerZero
     * @param _gatewayVault GatewayVault contract address in that chain
     */
    function addSupportedChain(uint32 _eid, address _gatewayVault) external onlyOwner {
        require(_chainIndexByEid[_eid] == 0, "Chain already supported");

        uint256 newIndex = supportedChains.length;
        supportedChains.push(
            RemoteChainInfo({ eid: _eid, gatewayVault: _gatewayVault, isActive: true })
        );

        // Store index + 1 for easier checks (0 means not found)
        _chainIndexByEid[_eid] = newIndex + 1;
        validGateways[_eid][_gatewayVault] = true;

        emit ChainAdded(_eid, _gatewayVault);
    }

    /**
     * @notice Updates chain activity status
     * @param _eid Chain endpoint identifier
     * @param _isActive New activity status
     */
    function updateChainStatus(uint32 _eid, bool _isActive) external onlyOwner {
        uint256 chainIndexPlusOne = _chainIndexByEid[_eid];
        require(chainIndexPlusOne > 0, "Chain not supported");

        uint256 chainIndex = chainIndexPlusOne - 1;
        supportedChains[chainIndex].isActive = _isActive;

        emit ChainStatusUpdated(_eid, _isActive);
    }

    /**
     * @notice Creates and adds a new synthetic token
     * @param _symbol Token symbol
     * @param _decimals Token decimals
     * @return tokenAddress Address of the newly created token
     */
    function addSyntheticToken(
        string memory _symbol,
        uint8 _decimals
    ) external onlyOwner returns (address tokenAddress) {
        // Deploy new synthetic token
        string memory tokenName = string(abi.encodePacked(TOKEN_NAME_PREFIX, _symbol));

        // Create token (hub will automatically be the owner)
        SyntheticToken syntheticToken = new SyntheticToken(tokenName, _symbol, _decimals);
        tokenAddress = address(syntheticToken);

        // Store token information
        uint256 tokenIndex = syntheticTokenCount;
        syntheticTokenCount++;

        SyntheticTokenInfo storage tokenInfo = syntheticTokens[tokenIndex];
        tokenInfo.tokenAddress = tokenAddress;
        tokenInfo.tokenSymbol = _symbol;
        tokenInfo.tokenDecimals = _decimals;
        tokenInfo.isPaused = false;

        // Add token to lookup mapping
        _tokenIndexByAddress[tokenAddress] = tokenIndex + 1;

        emit SyntheticTokenAdded(tokenIndex, tokenAddress, _symbol, _decimals);

        return tokenAddress;
    }

    /**
     * @notice Links a synthetic token with a remote token in another network
     * @param _tokenIndex Synthetic token index
     * @param _eid Network identifier
     * @param _remoteAddress Remote token address
     * @param _decimalsDelta Decimal places difference between tokens
     */
    function linkRemoteToken(
        uint256 _tokenIndex,
        uint32 _eid,
        address _remoteAddress,
        int8 _decimalsDelta
    ) external onlyOwner validTokenIndex(_tokenIndex) {
        // Check that chain is supported
        require(_chainIndexByEid[_eid] > 0, "Chain not supported");

        SyntheticTokenInfo storage tokenInfo = syntheticTokens[_tokenIndex];

        // Add chain to supported list if not already supported
        if (!tokenInfo.supportedChains[_eid]) {
            tokenInfo.supportedChains[_eid] = true;
            tokenInfo.chainList.push(_eid);
        }

        RemoteTokenInfo storage remoteToken = tokenInfo.remoteTokens[_eid];
        remoteToken.remoteAddress = _remoteAddress;
        remoteToken.isPaused = false;
        remoteToken.decimalsDelta = _decimalsDelta;

        // Add token to lookup by remote address
        _tokenIndexByRemoteAddress[_eid][_remoteAddress] = _tokenIndex + 1;

        emit RemoteTokenLinked(_tokenIndex, _eid, _remoteAddress, _decimalsDelta);
    }

    /**
     * @notice Enables/disables pause for a synthetic token
     * @param _tokenIndex Token index
     * @param _isPaused New pause status
     */
    function pauseSyntheticToken(
        uint256 _tokenIndex,
        bool _isPaused
    ) external onlyOwner validTokenIndex(_tokenIndex) {
        syntheticTokens[_tokenIndex].isPaused = _isPaused;
        emit TokenPaused(_tokenIndex, _isPaused);
    }

    /**
     * @notice Enables/disables pause for a remote token in a specific network
     * @param _tokenIndex Token index
     * @param _eid Network identifier
     * @param _isPaused New pause status
     */
    function pauseRemoteToken(
        uint256 _tokenIndex,
        uint32 _eid,
        bool _isPaused
    ) external onlyOwner validTokenIndex(_tokenIndex) {
        SyntheticTokenInfo storage tokenInfo = syntheticTokens[_tokenIndex];
        require(tokenInfo.supportedChains[_eid], "Chain not supported for this token");

        tokenInfo.remoteTokens[_eid].isPaused = _isPaused;
        emit RemoteTokenPaused(_tokenIndex, _eid, _isPaused);
    }

    /**
     * @dev Validates tokens and prepares asset array without state changes (view function)
     * @param _assetEntries Array of token indices and amounts
     * @param _targetEid Target network identifier
     * @return assets Array of prepared assets
     */
    function _validateAndPrepareAssets(
        AssetEntry[] calldata _assetEntries,
        uint32 _targetEid
    ) private view returns (Asset[] memory assets) {
        uint256 inputLength = _assetEntries.length;
        assets = new Asset[](inputLength);

        for (uint256 i = 0; i < inputLength; i++) {
            uint256 tokenIndex = _assetEntries[i].tokenIndex;
            uint256 amount = _assetEntries[i].tokenAmount;

            require(tokenIndex < syntheticTokenCount, "Invalid token index");
            SyntheticTokenInfo storage tokenInfo = syntheticTokens[tokenIndex];

            require(!tokenInfo.isPaused, "Token is paused");

            require(tokenInfo.supportedChains[_targetEid], "Token not supported on target chain");

            RemoteTokenInfo storage remoteToken = tokenInfo.remoteTokens[_targetEid];

            require(!remoteToken.isPaused, "Remote token is paused");
            amount = _removeDust(amount, -remoteToken.decimalsDelta);
            require(remoteToken.totalBalance >= amount, "Insufficient balance on target chain");

            uint256 normalizedAmount = _normalizeAmount(amount, -remoteToken.decimalsDelta);

            assets[i] = Asset({
                tokenAddress: remoteToken.remoteAddress,
                tokenAmount: normalizedAmount
            });
        }

        return assets;
    }

    /**
     * @dev Burns tokens and updates balances (without repeating validation)
     * @param _assetEntries Array of token indices and amounts
     * @param _targetEid Target network identifier
     */
    function _burnTokens(AssetEntry[] calldata _assetEntries, uint32 _targetEid) private {
        for (uint256 i = 0; i < _assetEntries.length; i++) {
            uint256 tokenIndex = _assetEntries[i].tokenIndex;
            uint256 amount = _assetEntries[i].tokenAmount;

            SyntheticTokenInfo storage tokenInfo = syntheticTokens[tokenIndex];
            RemoteTokenInfo storage remoteToken = tokenInfo.remoteTokens[_targetEid];
            amount = _removeDust(amount, -remoteToken.decimalsDelta);
            // Burn the synthetic token
            ISyntheticToken(tokenInfo.tokenAddress).burn(msg.sender, amount);

            // Decrease the target chain balance
            remoteToken.totalBalance -= amount;

            emit TokenBurned(tokenIndex, msg.sender, amount, _targetEid);
        }
    }

    /**
     * @notice Burns multiple synthetic tokens and sends the corresponding tokens to the specified network
     * @param _recipient Recipient address in the target network
     * @param _assetEntries Array of token indices and amounts to burn
     * @param _targetEid Target network identifier
     * @param _options LayerZero transaction options
     */
    function burnAndSend(
        address _recipient,
        AssetEntry[] calldata _assetEntries,
        uint32 _targetEid,
        bytes calldata _options
    ) external payable returns (MessagingReceipt memory receipt) {
        {
            // Check that target chain is supported and active
            uint256 chainIndexPlusOne = _chainIndexByEid[_targetEid];
            require(chainIndexPlusOne > 0, "Target chain not supported");

            uint256 chainIndex = chainIndexPlusOne - 1;
            require(supportedChains[chainIndex].isActive, "Target chain is not active");
        }

        // Validate and prepare assets (view operation)
        Asset[] memory assets = _validateAndPrepareAssets(_assetEntries, _targetEid);

        // Burn tokens and update balances (state-changing operation)
        _burnTokens(_assetEntries, _targetEid);

        // Encode data for sending
        bytes memory payload = abi.encode(_recipient, assets);

        // Send message
        receipt = _lzSend(
            _targetEid,
            payload,
            _options,
            MessagingFee(msg.value, 0),
            payable(msg.sender)
        );

        emit MessageSent(receipt.guid, _recipient, assets, _targetEid);

        return receipt;
    }

    /**
     * @notice Gets information about all synthetic tokens
     * @return Array of data for all tokens
     */
    function getAllSyntheticTokens() public view returns (SyntheticTokenView[] memory) {
        SyntheticTokenView[] memory tokens = new SyntheticTokenView[](syntheticTokenCount);

        for (uint256 i = 0; i < syntheticTokenCount; i++) {
            SyntheticTokenInfo storage tokenInfo = syntheticTokens[i];

            // Create array of supported chains from mapping
            uint32[] memory supportedChainsList = new uint32[](tokenInfo.chainList.length);
            for (uint256 j = 0; j < tokenInfo.chainList.length; j++) {
                supportedChainsList[j] = tokenInfo.chainList[j];
            }

            tokens[i] = SyntheticTokenView({
                tokenAddress: tokenInfo.tokenAddress,
                tokenSymbol: tokenInfo.tokenSymbol,
                tokenDecimals: tokenInfo.tokenDecimals,
                isPaused: tokenInfo.isPaused,
                supportedChains: supportedChainsList
            });
        }

        return tokens;
    }

    /**
     * @notice Gets information about a specific synthetic token
     * @param _tokenIndex Token index
     * @return Data about the token and networks it supports
     */
    function getSyntheticTokenInfo(
        uint256 _tokenIndex
    )
        public
        view
        validTokenIndex(_tokenIndex)
        returns (SyntheticTokenView memory, RemoteTokenView[] memory)
    {
        SyntheticTokenInfo storage tokenInfo = syntheticTokens[_tokenIndex];

        // Create array of supported chains from mapping
        uint32[] memory supportedChainsList = new uint32[](tokenInfo.chainList.length);
        for (uint256 j = 0; j < tokenInfo.chainList.length; j++) {
            supportedChainsList[j] = tokenInfo.chainList[j];
        }

        SyntheticTokenView memory tokenView = SyntheticTokenView({
            tokenAddress: tokenInfo.tokenAddress,
            tokenSymbol: tokenInfo.tokenSymbol,
            tokenDecimals: tokenInfo.tokenDecimals,
            isPaused: tokenInfo.isPaused,
            supportedChains: supportedChainsList
        });

        RemoteTokenView[] memory remoteTokens = new RemoteTokenView[](tokenInfo.chainList.length);

        for (uint256 i = 0; i < tokenInfo.chainList.length; i++) {
            uint32 eid = tokenInfo.chainList[i];
            RemoteTokenInfo storage remoteToken = tokenInfo.remoteTokens[eid];

            remoteTokens[i] = RemoteTokenView({
                eid: eid,
                remoteAddress: remoteToken.remoteAddress,
                isPaused: remoteToken.isPaused,
                totalBalance: remoteToken.totalBalance,
                decimalsDelta: remoteToken.decimalsDelta
            });
        }

        return (tokenView, remoteTokens);
    }

    /**
     * @notice Gets information about supported networks
     * @return Array of data about supported networks
     */
    function getSupportedChains() public view returns (RemoteChainInfo[] memory) {
        return supportedChains;
    }

    /**
     * @notice Calculates the cost of sending a message for multiple token burning
     * @param _recipient Recipient address
     * @param _assetEntries Array of token indices and amounts
     * @param _targetEid Target network
     * @param _options LayerZero transaction options
     * @return nativeFee Cost in native currency
     */
    function quoteBurnAndSend(
        address _recipient,
        AssetEntry[] calldata _assetEntries,
        uint32 _targetEid,
        bytes calldata _options
    ) public view returns (uint256 nativeFee) {
        // Use the view function to validate and prepare assets
        Asset[] memory assets = _validateAndPrepareAssets(_assetEntries, _targetEid);

        bytes memory payload = abi.encode(_recipient, assets);
        nativeFee = (_quote(_targetEid, payload, _options, false)).nativeFee;
    }

    /**
     * @dev Processes incoming LayerZero message
     */
    function _lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata _payload,
        address /*_executor*/,
        bytes calldata /*_extraData*/
    ) internal override {
        // Check that the message came from a valid gateway
        address sender = address(uint160(uint256(_origin.sender)));
        require(validGateways[_origin.srcEid][sender], "Invalid gateway");

        _processMessage(_payload, _guid, _origin.srcEid);
    }

    /**
     * @dev Processes the received message and mints synthetic tokens
     */
    function _processMessage(bytes memory _payload, bytes32 _guid, uint32 _srcEid) internal {
        (address recipient, Asset[] memory assets) = abi.decode(_payload, (address, Asset[]));

        for (uint256 i = 0; i < assets.length; i++) {
            Asset memory asset = assets[i];

            // Find the corresponding synthetic token using the optimized mapping
            uint256 tokenIndexPlusOne = _tokenIndexByRemoteAddress[_srcEid][asset.tokenAddress];
            require(tokenIndexPlusOne > 0, "Token not found");

            uint256 idx = tokenIndexPlusOne - 1;
            SyntheticTokenInfo storage tokenInfo = syntheticTokens[idx];
            require(tokenInfo.supportedChains[_srcEid], "Token not supported on source chain");

            RemoteTokenInfo storage remoteToken = tokenInfo.remoteTokens[_srcEid];

            // Normalize amount
            uint256 normalizedAmount = _normalizeAmount(
                asset.tokenAmount,
                remoteToken.decimalsDelta
            );

            // Increase source network balance
            remoteToken.totalBalance += normalizedAmount;

            // Mint synthetic token
            ISyntheticToken(tokenInfo.tokenAddress).mint(recipient, normalizedAmount);

            // Update asset for event
            assets[i].tokenAmount = normalizedAmount;
            assets[i].tokenAddress = tokenInfo.tokenAddress;
        }

        emit MessageReceived(_guid, recipient, assets, _srcEid);
    }

    /**
     * @dev Normalizes token amount considering decimal places difference
     */
    function _normalizeAmount(
        uint256 _amount,
        int8 _decimalsDelta
    ) internal pure returns (uint256) {
        if (_decimalsDelta < 0) {
            return _amount / 10 ** uint8(-_decimalsDelta);
        } else {
            return _amount * 10 ** uint8(_decimalsDelta);
        }
    }

    function _removeDust(uint256 _amount, int8 _decimalsDelta) internal pure returns (uint256) {
        if (_decimalsDelta < 0) {
            uint8 absDecimalsDelta = uint8(-_decimalsDelta);
            return (_amount / 10 ** absDecimalsDelta) * 10 ** absDecimalsDelta;
        }
        return _amount;
    }

    /**
     * @notice Returns the index of a chain by its EID
     * @param _eid Network endpoint identifier
     * @return Chain index
     */
    function getChainIndex(uint32 _eid) public view returns (uint256) {
        uint256 indexPlusOne = _chainIndexByEid[_eid];
        require(indexPlusOne > 0, "Chain not found");
        return indexPlusOne - 1;
    }

    /**
     * @notice Returns the index of a token by its address
     * @param _tokenAddress Token contract address
     * @return Token index
     */
    function getTokenIndex(address _tokenAddress) public view returns (uint256) {
        uint256 indexPlusOne = _tokenIndexByAddress[_tokenAddress];
        require(indexPlusOne > 0, "Token not found");
        return indexPlusOne - 1;
    }

    /**
     * @notice Returns the index of a token by its remote address in a specific network
     * @param _eid Network endpoint identifier
     * @param _remoteAddress Remote token address
     * @return Token index
     */
    function getTokenIndexByRemote(
        uint32 _eid,
        address _remoteAddress
    ) public view returns (uint256) {
        uint256 indexPlusOne = _tokenIndexByRemoteAddress[_eid][_remoteAddress];
        require(indexPlusOne > 0, "Remote token not found");
        return indexPlusOne - 1;
    }

    /**
     * @notice Checks if a chain is supported
     * @param _eid Network endpoint identifier
     * @return True if chain is supported
     */
    function isChainSupported(uint32 _eid) public view returns (bool) {
        return _chainIndexByEid[_eid] > 0;
    }

    /**
     * @notice Checks if a token exists
     * @param _tokenAddress Token contract address
     * @return True if token exists
     */
    function isTokenRegistered(address _tokenAddress) public view returns (bool) {
        return _tokenIndexByAddress[_tokenAddress] > 0;
    }
}
