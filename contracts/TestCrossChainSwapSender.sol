// SPDX-License-Identifier: MIT

pragma solidity 0.8.23;

import { TransferHelper } from "./libraries/TransferHelper.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { OApp, MessagingFee, Origin } from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import { MessagingReceipt } from "@layerzerolabs/oapp-evm/contracts/oapp/OAppSender.sol";
import { OAppOptionsType3 } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OAppOptionsType3.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";

// import { console } from "hardhat/console.sol";

contract TestCrossChainSwapSender is OApp, OAppOptionsType3 {
    using TransferHelper for address;

    struct SwapParams {
        address recipient;
        uint32 dstEid;
        uint128 gasLimit;
        uint256 value;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
    }

    MockERC20 public tokenA;
    MockERC20 public tokenB;

    mapping(address => address) public supportedTokens;
    uint32 public immutable DST_EID;

    constructor(
        address _endpoint,
        uint32 _dstEid,
        address _tokenAs,
        address _tokenBs
    ) OApp(_endpoint, msg.sender) Ownable(msg.sender) {
        DST_EID = _dstEid;
        bytes32 salt = keccak256(abi.encode(msg.sender));
        tokenA = new MockERC20{ salt: salt }("Token A", "A", 18);
        tokenB = new MockERC20{ salt: salt }("Token B", "B", 18);
        tokenA.mint(address(this), 10000_000_000 * 1e18);
        tokenB.mint(address(this), 10000_000_000 * 1e18);
        supportedTokens[_tokenAs] = address(tokenA);
        supportedTokens[_tokenBs] = address(tokenB);
    }

    event MessageReceived(
        bytes32 guidSrc,
        bytes32 guidDst,
        address recepient,
        address tokenOut,
        uint256 amountOut,
        string errorMessage
    );

    function mint1000(address _recipient) external {
        tokenA.mint(_recipient, 1000 * 1e18);
        tokenB.mint(_recipient, 1000 * 1e18);
    }

    function send(
        SwapParams memory _swapParams,
        bytes calldata _options
    ) external payable returns (MessagingReceipt memory receipt) {
        address tokenIn = supportedTokens[_swapParams.tokenIn];
        tokenIn.safeTransferFrom(msg.sender, address(this), _swapParams.amountIn);
        bytes memory payload = abi.encode(_swapParams);

        receipt = _lzSend(
            DST_EID,
            payload,
            _options,
            MessagingFee(msg.value, 0),
            payable(msg.sender)
        );
    }

    function quote(
        SwapParams memory _swapParams,
        bytes calldata _options
    ) public view returns (uint256 nativeFee) {
        bytes memory payload = abi.encode(_swapParams);
        nativeFee = (_quote(DST_EID, payload, _options, false)).nativeFee;
    }

    function _lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata payload,
        address /*_executor*/,
        bytes calldata /*_extraData*/
    ) internal override {
        require(_origin.srcEid == DST_EID, "!DST_EID");
        (
            address _recepient,
            address _targetToken,
            uint256 _amountOut,
            bytes32 _guidSrc,
            string memory _errorMessage
        ) = abi.decode(payload, (address, address, uint256, bytes32, string));
        address tokenOut = supportedTokens[_targetToken];
        if (_amountOut > 0) {
            tokenOut.safeTransfer(_recepient, _amountOut);
        }
        emit MessageReceived(_guidSrc, _guid, _recepient, tokenOut, _amountOut, _errorMessage);
    }
}
