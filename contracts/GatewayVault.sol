// SPDX-License-Identifier: MIT

pragma solidity 0.8.23;

import { TransferHelper } from "./libraries/TransferHelper.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { OApp, MessagingFee, Origin } from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import { MessagingReceipt } from "@layerzerolabs/oapp-evm/contracts/oapp/OAppSender.sol";
import { OAppOptionsType3 } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OAppOptionsType3.sol";

contract GatewayVault is OApp, OAppOptionsType3 {
    using TransferHelper for address;

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

    struct Asset {
        address tokenAddress;
        uint256 tokenAmount;
    }

    struct TokenSetupConfig {
        bool onPause;
        address tokenAddress; // token address on the source chain
        uint8 syntheticTokenDecimals; // decimals of the token on the destination chain
        address syntheticTokenAddress; // address of the synthetic token on the destination chain
    }

    struct AssetEntry {
        uint256 tokenIndex;
        uint256 tokenAmount;
    }

    struct TokenDetail {
        bool onPause;
        int8 decimalsDelta;
        address syntheticTokenAddress;
        address tokenAddress;
        uint8 tokenDecimals;
        string tokenSymbol;
        uint256 tokenBalance;
    }

    struct AvailableToken {
        bool onPause;
        address tokenAddress;
        address syntheticTokenAddress;
        int8 decimalsDelta;
    }

    uint32 public immutable DST_EID;
    AvailableToken[] public availableTokens;

    constructor(
        address _endpoint,
        address _delegate,
        uint32 _dstEid
    ) OApp(_endpoint, _delegate) Ownable(_delegate) {
        DST_EID = _dstEid;
    }

    event TokenPaused(uint256 index, bool onPause);
    event MessageSent(
        MessageType messageType,
        bytes32 guid,
        address from,
        address to,
        Asset[] assets
    );
    event MessageReceived(
        MessageType messageType,
        uint32 srcEid,
        bytes32 guid,
        address from,
        address to,
        Asset[] assets
    );
    event ReceivedRevert(MessageType messageType, bytes32 guid, address from, string reason);
    event AddNewTokens(bytes32 guid, AvailableToken[] newTokens);

    function getAvailableTokenLength() public view returns (uint256) {
        return availableTokens.length;
    }

    function getAllAvailableTokens() public view returns (TokenDetail[] memory) {
        TokenDetail[] memory availableTokenDetails = new TokenDetail[](availableTokens.length);
        for (uint256 i = 0; i < availableTokens.length; i++) {
            address tokenAddress = availableTokens[i].tokenAddress;
            availableTokenDetails[i] = TokenDetail({
                onPause: availableTokens[i].onPause,
                decimalsDelta: availableTokens[i].decimalsDelta,
                syntheticTokenAddress: availableTokens[i].syntheticTokenAddress,
                tokenAddress: tokenAddress,
                tokenDecimals: IERC20Metadata(tokenAddress).decimals(),
                tokenSymbol: IERC20Metadata(tokenAddress).symbol(),
                tokenBalance: IERC20(tokenAddress).balanceOf(address(this))
            });
        }
        return availableTokenDetails;
    }

    function pauseToken(uint256 _index, bool _onPause) external onlyOwner {
        availableTokens[_index].onPause = _onPause;
        emit TokenPaused(_index, _onPause);
    }

    function addAvailableTokens(
        TokenSetupConfig[] calldata _tokensConfig,
        bytes calldata _options
    ) external payable onlyOwner {
        AvailableToken[] memory newTokens = _setupConfigToAvailableToken(_tokensConfig);
        for (uint256 i = 0; i < newTokens.length; i++) {
            availableTokens.push(newTokens[i]);
        }
        bytes memory msgData = abi.encode(newTokens);
        bytes memory payload = abi.encode(MessageType.LinkToken, msgData);
        MessagingReceipt memory receipt = _lzSend(
            DST_EID,
            payload,
            _options,
            MessagingFee(msg.value, 0),
            payable(msg.sender)
        );
        emit AddNewTokens(receipt.guid, newTokens);
    }

    function deposit(
        address _recepient,
        AssetEntry[] calldata _assets,
        bytes calldata _options
    ) external payable returns (MessagingReceipt memory) {
        Asset[] memory assets = _checkAndTransform(_assets);
        bytes memory msgData = abi.encode(msg.sender, _recepient, assets);
        bytes memory payload = abi.encode(MessageType.Deposit, msgData);
        return _sendCrossChainMessage(payload, _options, _recepient, assets);
    }

    function swap(
        SwapParams memory _swapParams,
        bytes calldata _options,
        AssetEntry[] calldata _assets
    ) external payable returns (MessagingReceipt memory) {
        Asset[] memory assets = _checkAndTransform(_assets);
        _swapParams.from = msg.sender;
        _swapParams.assets = assets;
        bytes memory msgData = abi.encode(_swapParams);
        bytes memory payload = abi.encode(MessageType.Swap, msgData);
        return _sendCrossChainMessage(payload, _options, _swapParams.to, assets);
    }

    function quote(
        TokenSetupConfig[] calldata _tokensConfigs,
        bytes calldata _options
    ) public view returns (uint256 nativeFee) {
        AvailableToken[] memory newTokens = _setupConfigToAvailableToken(_tokensConfigs);
        bytes memory msgData = abi.encode(newTokens);
        bytes memory payload = abi.encode(MessageType.LinkToken, msgData);
        nativeFee = (_quote(DST_EID, payload, _options, false)).nativeFee;
    }

    function quote(
        address _recepient,
        AssetEntry[] calldata _assets,
        bytes calldata _options
    ) public view returns (uint256 nativeFee) {
        Asset[] memory assets = _checkAndTransform(_assets);
        bytes memory msgData = abi.encode(_recepient, _recepient, assets);
        bytes memory payload = abi.encode(MessageType.Deposit, msgData);
        nativeFee = (_quote(DST_EID, payload, _options, false)).nativeFee;
    }

    function quote(
        SwapParams memory _swapParams,
        bytes calldata _options,
        AssetEntry[] calldata _assets
    ) public view returns (uint256 nativeFee) {
        _swapParams.assets = _checkAndTransform(_assets);
        bytes memory msgData = abi.encode(_swapParams);
        bytes memory payload = abi.encode(MessageType.Swap, msgData);
        nativeFee = (_quote(DST_EID, payload, _options, false)).nativeFee;
    }

    function _setupConfigToAvailableToken(
        TokenSetupConfig[] calldata _tokensConfig
    ) internal view returns (AvailableToken[] memory _availableTokens) {
        _availableTokens = new AvailableToken[](_tokensConfig.length);

        for (uint256 i = 0; i < _tokensConfig.length; i++) {
            uint8 tokenDecimals = IERC20Metadata(_tokensConfig[i].tokenAddress).decimals();
            AvailableToken memory _availableToken = AvailableToken({
                onPause: _tokensConfig[i].onPause,
                tokenAddress: _tokensConfig[i].tokenAddress,
                syntheticTokenAddress: _tokensConfig[i].syntheticTokenAddress,
                decimalsDelta: int8(_tokensConfig[i].syntheticTokenDecimals - tokenDecimals)
            });
            _availableTokens[i] = _availableToken;
        }
    }

    function _sendCrossChainMessage(
        bytes memory _payload,
        bytes memory _options,
        address _recepient,
        Asset[] memory _assets
    ) internal returns (MessagingReceipt memory receipt) {
        _transferBatch(_assets);
        receipt = _lzSend(
            DST_EID,
            _payload,
            _options,
            MessagingFee(msg.value, 0),
            payable(msg.sender)
        );
        emit MessageSent(MessageType.Swap, receipt.guid, msg.sender, _recepient, _assets);
    }

    /**
     * @dev Internal function override to handle incoming messages from another chain.
     * @dev _origin A struct containing information about the message sender.
     * @dev _guid A unique global packet identifier for the message.
     * @param _payload The encoded message payload being received.
     *
     * @dev The following params are unused in the current implementation of the OApp.
     * @dev _executor The address of the Executor responsible for processing the message.
     * @dev _extraData Arbitrary data appended by the Executor to the message.
     *
     * Decodes the received payload and processes it as per the business logic defined in the function.
     */
    function _lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata _payload,
        address /*_executor*/,
        bytes calldata /*_extraData*/
    ) internal override {
        require(_origin.srcEid == DST_EID, "!DST_EID"); //paranoia
        (MessageType messageType, bytes memory payload) = abi.decode(
            _payload,
            (MessageType, bytes)
        );
        if (messageType == MessageType.Withdraw || messageType == MessageType.Swap) {
            _processMessage(messageType, payload, _guid, _origin.srcEid);
        } else if (messageType == MessageType.RevertSwap) {
            _processMessageRevertSwap(messageType, payload);
        }
    }

    function _processMessageRevertSwap(MessageType messageType, bytes memory _payload) internal {
        (
            address _from,
            address _to,
            Asset[] memory _assets,
            bytes32 _guid,
            string memory _reason
        ) = abi.decode(_payload, (address, address, Asset[], bytes32, string));
        for (uint256 i = 0; i < _assets.length; i++) {
            Asset memory _asset = _assets[i];
            _asset.tokenAddress.safeTransfer(_to, _asset.tokenAmount);
        }
        emit ReceivedRevert(messageType, _guid, _from, _reason);
    }

    function _processMessage(
        MessageType messageType,
        bytes memory _payload,
        bytes32 _guid,
        uint32 _srcEid
    ) internal {
        (address _from, address _to, Asset[] memory _assets) = abi.decode(
            _payload,
            (address, address, Asset[])
        );
        for (uint256 i = 0; i < _assets.length; i++) {
            Asset memory _asset = _assets[i];
            _asset.tokenAddress.safeTransfer(_to, _asset.tokenAmount);
        }
        emit MessageReceived(messageType, _srcEid, _guid, _from, _to, _assets);
    }

    function _transferBatch(Asset[] memory _assets) internal {
        for (uint256 i = 0; i < _assets.length; i++) {
            Asset memory _asset = _assets[i];
            _asset.tokenAddress.safeTransferFrom(msg.sender, address(this), _asset.tokenAmount);
        }
    }

    function _removeDust(uint256 _amount, int8 _decimalsDelta) internal pure returns (uint256) {
        if (_decimalsDelta < 0) {
            uint8 absDecimalsDelta = uint8(-_decimalsDelta);
            return (_amount / 10 ** absDecimalsDelta) * 10 ** absDecimalsDelta;
        }
        return _amount;
    }

    function _checkAndTransform(
        AssetEntry[] calldata _assets
    ) internal view returns (Asset[] memory assets) {
        assets = new Asset[](_assets.length);

        for (uint256 i = 0; i < _assets.length; i++) {
            AssetEntry calldata _assetEntry = _assets[i];
            require(_assetEntry.tokenIndex < availableTokens.length, "Token index out of bounds");
            AvailableToken memory _availableToken = availableTokens[_assetEntry.tokenIndex];
            require(!_availableToken.onPause, "Token is paused");
            uint256 _amount = _removeDust(_assetEntry.tokenAmount, _availableToken.decimalsDelta);
            require(_amount > 0, "Amount is too small");
            assets[i] = Asset({ tokenAddress: _availableToken.tokenAddress, tokenAmount: _amount });
        }
    }
}
