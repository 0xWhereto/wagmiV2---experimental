// SPDX-License-Identifier: MIT

pragma solidity 0.8.23;

import { TransferHelper } from "./libraries/TransferHelper.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { OApp, MessagingFee, Origin } from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import { MessagingReceipt } from "@layerzerolabs/oapp-evm/contracts/oapp/OAppSender.sol";
import { OAppOptionsType3 } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OAppOptionsType3.sol";
import { ISyntheticToken } from "./interfaces/ISyntheticToken.sol";
import { SyntheticToken } from "./SyntheticToken.sol";
import { OptionsBuilder } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";

/**
 * @title SyntheticTokenHub
 * @notice Central contract managing synthetic tokens for cross-chain interaction
 * @dev This contract receives deposits from other networks via GatewayVault and mints synthetic tokens
 */
contract SyntheticTokenHub is OApp, OAppOptionsType3 {
    using TransferHelper for address;
    using OptionsBuilder for bytes;

    enum MessageType {
        Deposit,
        Withdraw,
        Swap,
        LinkToken,
        RevertSwap
    }

    struct SwapParams {
        address from;
        address to;
        address syntheticTokenOut;
        uint128 gasLimit;
        uint32 dstEid;
        uint256 value;
        Asset[] assets;
        bytes commands;
        bytes[] inputs;
    }

    struct AvailableToken {
        bool onPause;
        address tokenAddress;
        address syntheticTokenAddress;
        int8 decimalsDelta;
    }

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
        uint32[] chainList; // List of supported chains for iteration
    }

    struct RemoteTokenInfo {
        address remoteAddress;
        uint256 totalBalance;
        int8 decimalsDelta;
    }

    struct RemoteTokenView {
        uint32 eid;
        RemoteTokenInfo remoteTokenInfo;
    }

    struct SyntheticTokenView {
        uint256 tokenIndex;
        SyntheticTokenInfo syntheticTokenInfo;
        RemoteTokenView[] remoteTokens;
    }

    address public immutable uniswapUniversalRouter;
    address public immutable uniswapPermitV2;

    // Synthetic tokens registry
    mapping(uint256 => SyntheticTokenInfo) public syntheticTokens;
    mapping(address => mapping(uint32 => RemoteTokenInfo)) public remoteTokens; // token address => eid => RemoteTokenInfo
    uint256 public syntheticTokenCount;

    // Mapping for token lookup: tokenAddress => tokenIndex + 1 (0 means not found)
    mapping(address => uint256) private _tokenIndexByAddress;

    // Mapping for token lookup by network and remote address
    mapping(uint32 => mapping(address => address)) public _syntheticAddressByRemoteAddress; // eid => remote address => token address
    // Mapping for token lookup by network and synthetic address
    mapping(uint32 => mapping(address => address)) public _remoteAddressBySyntheticAddress; // eid => token address => remote address
    mapping(uint32 => address) public gatewayVaultByEid; // eid => gateway vault address

    // Add constant for the base token name
    string public constant TOKEN_NAME_PREFIX = "Synthetic ";

    // Events
    event SyntheticTokenAdded(
        uint256 indexed tokenIndex,
        address tokenAddress,
        string symbol,
        uint8 decimals
    );
    event RemoteTokenLinked(AvailableToken[] availableTokens, address gatewayVault, uint32 eid);
    event TokenMinted(
        uint256 indexed tokenIndex,
        address recipient,
        uint256 amount,
        uint32 sourceEid
    );
    event TokenBurned(uint32 dstEid, Asset[] assets);
    event MessageSent(uint32 dstEid, bytes32 guid, address from, address to, Asset[] assets);
    event MessageReceived(bytes32 guid, address from, address to, Asset[] assets, uint32 srcEid);

    constructor(
        address _endpoint,
        address _owner,
        address _uniswapUniversalRouter,
        address _uniswapPermitV2
    ) OApp(_endpoint, _owner) Ownable(_owner) {
        uniswapUniversalRouter = _uniswapUniversalRouter;
        uniswapPermitV2 = _uniswapPermitV2;
    }

    /**
     * @notice Gets information about all synthetic tokens
     * @return Array of data for all tokens
     */
    function getSyntheticTokensInfo(
        uint256[] memory _tokenIndices
    ) public view returns (SyntheticTokenView[] memory) {
        uint256 length = _tokenIndices.length > 0 ? _tokenIndices.length : syntheticTokenCount;
        SyntheticTokenView[] memory tokens = new SyntheticTokenView[](length);
        if (_tokenIndices.length == 0) {
            for (uint256 i = 1; i < length; i++) {
                tokens[i] = getSyntheticTokenInfo(i + 1);
            }
        } else {
            for (uint256 i = 0; i < length; i++) {
                tokens[i] = getSyntheticTokenInfo(_tokenIndices[i]);
            }
        }
        return tokens;
    }

    function getSyntheticTokenInfo(
        uint256 _tokenIndex
    ) public view returns (SyntheticTokenView memory) {
        SyntheticTokenInfo memory tokenInfo = syntheticTokens[_tokenIndex];
        address syntheticTokenAddress = tokenInfo.tokenAddress;
        uint256 chainListLength = tokenInfo.chainList.length;

        RemoteTokenView[] memory _remoteTokens = new RemoteTokenView[](chainListLength);
        uint32[] memory supportedChainsList = new uint32[](chainListLength);
        for (uint256 j = 0; j < chainListLength; j++) {
            uint32 eid = tokenInfo.chainList[j];
            RemoteTokenInfo memory remoteToken = remoteTokens[syntheticTokenAddress][eid];
            _remoteTokens[j] = RemoteTokenView({
                eid: eid,
                remoteTokenInfo: RemoteTokenInfo({
                    remoteAddress: remoteToken.remoteAddress,
                    totalBalance: remoteToken.totalBalance,
                    decimalsDelta: remoteToken.decimalsDelta
                })
            });
            supportedChainsList[j] = eid;
        }

        return
            SyntheticTokenView({
                tokenIndex: _tokenIndex,
                syntheticTokenInfo: SyntheticTokenInfo({
                    tokenAddress: syntheticTokenAddress,
                    tokenSymbol: tokenInfo.tokenSymbol,
                    tokenDecimals: tokenInfo.tokenDecimals,
                    chainList: supportedChainsList
                }),
                remoteTokens: _remoteTokens
            });
    }

    /**
     * @notice Creates and adds a new synthetic token
     * @param _symbol Token symbol
     * @param _decimals Token decimals
     */
    function createSyntheticToken(string memory _symbol, uint8 _decimals) external onlyOwner {
        // Deploy new synthetic token
        string memory tokenName = string(abi.encodePacked(TOKEN_NAME_PREFIX, _symbol));

        // Create token (hub will automatically be the owner)
        syntheticTokenCount++;
        uint256 tokenIndex = syntheticTokenCount;
        SyntheticToken syntheticToken = new SyntheticToken(
            tokenName,
            _symbol,
            _decimals,
            tokenIndex
        );
        address tokenAddress = address(syntheticToken);

        SyntheticTokenInfo storage tokenInfo = syntheticTokens[tokenIndex];
        tokenInfo.tokenAddress = tokenAddress;
        tokenInfo.tokenSymbol = _symbol;
        tokenInfo.tokenDecimals = _decimals;

        // Add token to lookup mapping
        _tokenIndexByAddress[tokenAddress] = tokenIndex;

        tokenAddress.safeApprove(uniswapPermitV2, type(uint256).max);

        string memory errorMessage;

        (bool success, bytes memory returndata) = uniswapPermitV2.call(
            abi.encodeWithSignature(
                "approve(address,address,uint160,uint48)",
                tokenAddress,
                uniswapUniversalRouter,
                type(uint160).max, // amount (does not decrease)
                type(uint48).max // deadline
            )
        );
        if (!success) {
            errorMessage = returndata.length > 0 ? string(returndata) : "PERMIT2_APPROVE_FAILED";
        }

        emit SyntheticTokenAdded(tokenIndex, tokenAddress, _symbol, _decimals);
    }

    /**
     * @notice Burns multiple synthetic tokens and sends the corresponding tokens to the specified network
     * @param _recipient Recipient address in the destination network
     * @param _assets Array of token indices and amounts to burn
     * @param _dstEid Destination network identifier
     * @param _options LayerZero transaction options
     */
    function bridgeTokens(
        address _recipient,
        Asset[] memory _assets,
        uint32 _dstEid,
        bytes calldata _options
    ) external payable returns (MessagingReceipt memory receipt) {
        // Validate and prepare assets (view operation)
        (Asset[] memory assetsRemote, string memory errorMessage) = _validateAndPrepareAssets(
            _assets,
            _dstEid
        );
        if (bytes(errorMessage).length > 0) {
            revert(errorMessage);
        }

        // Burn tokens and update balances (state-changing operation)
        _burnTokens(_assets, _dstEid, msg.sender);

        // Encode data for sending
        bytes memory msgData = abi.encode(msg.sender, _recipient, assetsRemote);
        bytes memory payload = abi.encode(MessageType.Withdraw, msgData);

        // Send message
        receipt = _lzSend(
            _dstEid,
            payload,
            _options,
            MessagingFee(msg.value, 0),
            payable(msg.sender)
        );

        emit MessageSent(_dstEid, receipt.guid, msg.sender, _recipient, _assets);

        return receipt;
    }

    /**
     * @notice Calculates the cost of sending a message for multiple token burning
     * @param _recipient Recipient address
     * @param _assets Array of token indices and amounts
     * @param _dstEid Destination network
     * @param _options LayerZero transaction options
     * @return nativeFee Cost in native currency
     */
    function quote(
        address _recipient,
        Asset[] memory _assets,
        uint32 _dstEid,
        bytes calldata _options
    ) public view returns (uint256 nativeFee) {
        // Use the view function to validate and prepare assets
        (Asset[] memory assetsRemote, string memory errorMessage) = _validateAndPrepareAssets(
            _assets,
            _dstEid
        );
        if (bytes(errorMessage).length > 0) {
            revert(errorMessage);
        }
        bytes memory msgData = abi.encode(_recipient, _recipient, assetsRemote);
        bytes memory payload = abi.encode(MessageType.Withdraw, msgData);
        nativeFee = (_quote(_dstEid, payload, _options, false)).nativeFee;
    }

    function quote(
        address _recipient,
        Asset[] calldata _assetsIn,
        Asset[] calldata _assetsOut,
        uint32 srcEid,
        uint32 dstEid,
        bytes calldata options
    ) public view returns (uint256) {
        bytes32 _guid = bytes32(uint256(uint160(_recipient)));

        bytes memory msgDataRevert = abi.encode(
            _recipient,
            _recipient,
            _assetsIn,
            _guid,
            "THIS_IS_FAKE_ERROR_MESSAGE"
        );
        bytes memory payloadRevert = abi.encode(MessageType.RevertSwap, msgDataRevert);
        bytes memory msgDataSwap = abi.encode(_recipient, _recipient, _assetsOut);
        bytes memory payloadSwap = abi.encode(MessageType.Swap, msgDataSwap);

        uint256 feeRevert = (_quote(dstEid, payloadRevert, options, false)).nativeFee;
        uint256 feeSwap = (_quote(srcEid, payloadSwap, options, false)).nativeFee;
        return feeRevert > feeSwap ? feeRevert : feeSwap;
    }

    /**
     * @dev Validates tokens and prepares asset array
     * @param _assets Array of token indices and amounts
     * @param _dstEid Destination network identifier
     * @return assets Array of prepared assets
     */
    function _validateAndPrepareAssets(
        Asset[] memory _assets,
        uint32 _dstEid
    ) private view returns (Asset[] memory assets, string memory errorMessage) {
        uint256 inputLength = _assets.length;
        assets = new Asset[](inputLength);

        for (uint256 i = 0; i < inputLength; i++) {
            Asset memory _asset = _assets[i];
            address syntheticTokenAddress = _asset.tokenAddress;
            uint256 amount = _asset.tokenAmount;

            RemoteTokenInfo memory remoteToken = remoteTokens[syntheticTokenAddress][_dstEid];
            if (remoteToken.remoteAddress == address(0)) {
                errorMessage = "TOKEN_NOT_FOUND_ON_DST_CHAIN";
                return (assets, errorMessage);
            }

            amount = _removeDust(amount, -remoteToken.decimalsDelta);
            _assets[i].tokenAmount = amount; // update amount

            if (amount == 0) {
                errorMessage = "AMOUNT_IS_TOO_SMALL";
                return (assets, errorMessage);
            }
            if (remoteToken.totalBalance < amount) {
                errorMessage = "INSUFFICIENT_BALANCE_ON_DST_CHAIN";
                return (assets, errorMessage);
            }

            uint256 normalizedAmount = _normalizeAmount(amount, -remoteToken.decimalsDelta);

            assets[i] = Asset({
                tokenAddress: remoteToken.remoteAddress,
                tokenAmount: normalizedAmount
            });
        }
    }

    /**
     * @dev Burns tokens and updates balances (without repeating validation)
     * @param _assets Array of token indices and amounts
     * @param _dstEid Destination network identifier
     */
    function _burnTokens(Asset[] memory _assets, uint32 _dstEid, address from) private {
        for (uint256 i = 0; i < _assets.length; i++) {
            Asset memory _asset = _assets[i];
            address syntheticTokenAddress = _asset.tokenAddress;
            uint256 amount = _asset.tokenAmount;
            RemoteTokenInfo storage remoteToken = remoteTokens[syntheticTokenAddress][_dstEid];
            // Burn the synthetic token
            ISyntheticToken(syntheticTokenAddress).burn(from, amount);

            // Decrease the target chain balance
            remoteToken.totalBalance -= amount;
        }
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
        (MessageType messageType, bytes memory payload) = abi.decode(
            _payload,
            (MessageType, bytes)
        );
        if (messageType == MessageType.Deposit) {
            _processDepositMessage(payload, _guid, _origin.srcEid);
        } else if (messageType == MessageType.Swap) {
            SwapParams memory params = abi.decode(payload, (SwapParams));
            require(msg.value >= params.value, "INSUFFICIENT_VALUE");
            bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(
                params.gasLimit,
                0
            );
            try this.processSwapMessage(params, _origin.srcEid) returns (bytes memory payloadData) {
                _lzSend(
                    params.dstEid,
                    payloadData,
                    options,
                    MessagingFee(msg.value, 0),
                    payable(params.from)
                );
            } catch (bytes memory reason) {
                bytes memory msgData = abi.encode(
                    params.from,
                    params.to,
                    params.assets,
                    _guid,
                    string(reason)
                );
                payload = abi.encode(MessageType.RevertSwap, msgData);

                _lzSend(
                    _origin.srcEid,
                    payload,
                    options,
                    MessagingFee(msg.value, 0),
                    payable(params.from)
                );
            }
        } else if (messageType == MessageType.LinkToken) {
            _processLinkTokenMessage(
                payload,
                address(uint160(uint256(_origin.sender))),
                _origin.srcEid
            );
        } else {
            revert("Invalid message type");
        }
    }

    /**
     * @notice Links a synthetic token with a remote token in another network
     * @param _payload Encoded payload
     * @param _sender GatewayVault contract address in that chain
     * @param _srcEid Network identifier
     */
    function _processLinkTokenMessage(
        bytes memory _payload,
        address _sender,
        uint32 _srcEid
    ) internal {
        AvailableToken[] memory _availableTokens = abi.decode(_payload, (AvailableToken[]));
        if (gatewayVaultByEid[_srcEid] != _sender) {
            gatewayVaultByEid[_srcEid] = _sender;
        }
        for (uint256 i = 0; i < _availableTokens.length; i++) {
            address syntheticTokenAddress = _availableTokens[i].syntheticTokenAddress;
            address remoteTokenAddress = _availableTokens[i].tokenAddress;
            uint256 _tokenIndex = getSyntheticTokenIndex(syntheticTokenAddress); // revert if not found
            RemoteTokenInfo storage remoteToken = remoteTokens[syntheticTokenAddress][_srcEid];
            require(
                remoteToken.remoteAddress == address(0) || remoteToken.totalBalance == 0,
                "Remote token already linked"
            );
            remoteToken.remoteAddress = remoteTokenAddress;
            remoteToken.decimalsDelta = _availableTokens[i].decimalsDelta;

            SyntheticTokenInfo storage tokenInfo = syntheticTokens[_tokenIndex];
            tokenInfo.chainList.push(_srcEid);
            // Add token to lookup by remote address
            _syntheticAddressByRemoteAddress[_srcEid][remoteTokenAddress] = syntheticTokenAddress;
            _remoteAddressBySyntheticAddress[_srcEid][syntheticTokenAddress] = remoteTokenAddress;
        }

        emit RemoteTokenLinked(_availableTokens, _sender, _srcEid);
    }

    function processSwapMessage(
        SwapParams memory params,
        uint32 _srcEid
    ) external returns (bytes memory payload) {
        require(msg.sender == address(this), "INVALID_SENDER");

        uint256 length = params.assets.length;
        for (uint256 i = 0; i < length; i++) {
            Asset memory asset = params.assets[i];
            address syntheticTokenAddress = _syntheticAddressByRemoteAddress[_srcEid][
                asset.tokenAddress
            ];
            require(syntheticTokenAddress != address(0), "SYNTHETIC_NOT_FOUND");

            RemoteTokenInfo storage remoteToken = remoteTokens[syntheticTokenAddress][_srcEid]; // balance not updated

            // Normalize amount
            uint256 normalizedAmount = _normalizeAmount(
                asset.tokenAmount,
                remoteToken.decimalsDelta
            );

            // Increase source network balance
            remoteToken.totalBalance += normalizedAmount;

            // Mint synthetic token
            ISyntheticToken(syntheticTokenAddress).mint(address(this), normalizedAmount);
        }

        (bool success, bytes memory returndata) = uniswapUniversalRouter.call(
            abi.encodeWithSignature("execute(bytes,bytes[])", params.commands, params.inputs)
        );
        string memory errorMessage;

        if (success) {
            Asset[] memory assetsToBurn = new Asset[](1);
            assetsToBurn[0] = Asset({
                tokenAddress: params.syntheticTokenOut,
                tokenAmount: ISyntheticToken(params.syntheticTokenOut).balanceOf(address(this))
            });
            Asset[] memory assetsToSend;
            (assetsToSend, errorMessage) = _validateAndPrepareAssets(assetsToBurn, params.dstEid);
            if (bytes(errorMessage).length == 0) {
                _burnTokens(assetsToBurn, params.dstEid, address(this));
                bytes memory msgData = abi.encode(params.from, params.to, assetsToSend);
                payload = abi.encode(MessageType.Swap, msgData);
            }
        } else {
            errorMessage = returndata.length > 0 ? string(returndata) : "SWAP_FAILED";
        }
        if (bytes(errorMessage).length > 0) {
            revert(errorMessage);
        }

        return payload;
    }

    /**
     * @dev Processes the received message and mints synthetic tokens
     */
    function _processDepositMessage(bytes memory _payload, bytes32 _guid, uint32 _srcEid) internal {
        (address _from, address _to, Asset[] memory _assets) = abi.decode(
            _payload,
            (address, address, Asset[])
        );

        for (uint256 i = 0; i < _assets.length; i++) {
            Asset memory asset = _assets[i];
            address syntheticTokenAddress = _syntheticAddressByRemoteAddress[_srcEid][
                asset.tokenAddress
            ];
            require(syntheticTokenAddress != address(0), "Synthetic token not found");
            RemoteTokenInfo storage remoteToken = remoteTokens[syntheticTokenAddress][_srcEid];

            // Normalize amount
            uint256 normalizedAmount = _normalizeAmount(
                asset.tokenAmount,
                remoteToken.decimalsDelta
            );

            // Increase source network balance
            remoteToken.totalBalance += normalizedAmount;

            // Mint synthetic token
            ISyntheticToken(syntheticTokenAddress).mint(_to, normalizedAmount);

            // Update asset for event
            _assets[i].tokenAmount = normalizedAmount;
            _assets[i].tokenAddress = syntheticTokenAddress;
        }

        emit MessageReceived(_guid, _from, _to, _assets, _srcEid);
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
     * @notice Returns the index of a token by its address
     * @param _tokenAddress Token contract address
     * @return index Token index
     */
    function getSyntheticTokenIndex(address _tokenAddress) public view returns (uint256 index) {
        index = _tokenIndexByAddress[_tokenAddress];
        require(index > 0, "Token not found");
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
