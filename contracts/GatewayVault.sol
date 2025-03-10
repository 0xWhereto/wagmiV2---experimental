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

    struct Asset {
        address tokenAddress;
        uint256 tokenAmount;
    }

    struct TokenSetupConfig {
        address tokenAddress; // token address on the source chain
        uint8 expectedDecimals; // decimals of the token on the destination chain
    }

    struct AssetEntry {
        uint256 tokenIndex;
        uint256 tokenAmount;
    }

    struct TokenDetail {
        bool onPause;
        int8 decimalsDelta;
        address tokenAddress;
        uint8 tokenDecimals;
        string tokenSymbol;
        uint256 tokenBalance;
    }

    struct AvailableToken {
        bool onPause;
        address tokenAddress;
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
    event TokenEdited(uint256 index, AvailableToken availableToken);
    event MessageSent(bytes32 guid, address recepient, Asset[] assets);
    event MessageReceived(bytes32 guid, address recepient, Asset[] assets);

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

    function addAvailableTokens(TokenSetupConfig[] memory _tokenConfigs) external onlyOwner {
        for (uint256 i = 0; i < _tokenConfigs.length; i++) {
            uint8 tokenDecimals = IERC20Metadata(_tokenConfigs[i].tokenAddress).decimals();
            availableTokens.push(
                AvailableToken({
                    onPause: false,
                    tokenAddress: _tokenConfigs[i].tokenAddress,
                    decimalsDelta: int8(_tokenConfigs[i].expectedDecimals - tokenDecimals)
                })
            );
        }
    }

    function editAvailableToken(
        uint256 _index,
        AvailableToken memory _availableToken
    ) external onlyOwner {
        availableTokens[_index] = _availableToken;
        emit TokenEdited(_index, _availableToken);
    }

    /**
     * @notice Sends a message from the source chain to a destination chain.
     * @param _recepient The address to receive the assets.
     * @param _assets The assets to be sent.
     * @param _options Additional options for message execution.
     * @dev Encodes the message as bytes and sends it using the `_lzSend` internal function.
     * @return receipt A `MessagingReceipt` struct containing details of the message sent.
     */
    function send(
        address _recepient,
        AssetEntry[] calldata _assets,
        bytes calldata _options
    ) external payable returns (MessagingReceipt memory receipt) {
        Asset[] memory assets = _checkAndTransform(_assets);
        bytes memory payload = abi.encode(_recepient, assets);
        _transferBatch(assets);
        receipt = _lzSend(
            DST_EID,
            payload,
            _options,
            MessagingFee(msg.value, 0),
            payable(msg.sender)
        );
        emit MessageSent(receipt.guid, _recepient, assets);
    }

    /**
     * @notice Quotes the gas needed to pay for the full omnichain transaction in native gas or ZRO token.
     * @param _recepient The address to receive the assets.
     * @param _assets The assets to be sent.
     * @param _options Messa ge execution options (e.g., for sending gas to destination).
     * @return nativeFee The fee in the native token.
     */
    function quote(
        address _recepient,
        AssetEntry[] memory _assets,
        bytes calldata _options
    ) public view returns (uint256 nativeFee) {
        Asset[] memory assets = _checkAndTransform(_assets);
        bytes memory payload = abi.encode(_recepient, assets);
        nativeFee = (_quote(DST_EID, payload, _options, false)).nativeFee;
    }

    /**
     * @dev Internal function override to handle incoming messages from another chain.
     * @dev _origin A struct containing information about the message sender.
     * @dev _guid A unique global packet identifier for the message.
     * @param payload The encoded message payload being received.
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
        bytes calldata payload,
        address /*_executor*/,
        bytes calldata /*_extraData*/
    ) internal override {
        // require(msg.sender == address(endpoint), "!endpoint");
        //require(_origin.sender==, "!sender");
        require(_origin.srcEid == DST_EID, "!DST_EID");
        _processMessage(payload, _guid);
    }

    function _processMessage(bytes memory _payload, bytes32 _guid) internal {
        (address _recepient, Asset[] memory _assets) = abi.decode(_payload, (address, Asset[]));
        for (uint256 i = 0; i < _assets.length; i++) {
            Asset memory _asset = _assets[i];
            _asset.tokenAddress.safeTransfer(_recepient, _asset.tokenAmount);
        }
        emit MessageReceived(_guid, _recepient, _assets);
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
        AssetEntry[] memory _assets
    ) internal view returns (Asset[] memory assets) {
        assets = new Asset[](_assets.length);

        for (uint256 i = 0; i < _assets.length; i++) {
            AssetEntry memory _assetEntry = _assets[i];
            require(_assetEntry.tokenIndex < availableTokens.length, "Token index out of bounds");
            AvailableToken memory _availableToken = availableTokens[_assetEntry.tokenIndex];
            require(!_availableToken.onPause, "Token is paused");

            uint256 _amount = _removeDust(_assetEntry.tokenAmount, _availableToken.decimalsDelta);
            Asset memory _asset = Asset({
                tokenAddress: _availableToken.tokenAddress,
                tokenAmount: _amount
            });
            assets[i] = _asset;
        }
    }
}
