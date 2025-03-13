// SPDX-License-Identifier: SAL-1.0
pragma solidity 0.8.23;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { TransferHelper } from "./libraries/TransferHelper.sol";
import { IMinimalUniswapV3Pool } from "./interfaces/IMinimalUniswapV3Pool.sol";
import { SafeCast } from "./vendor0.8/uniswap/SafeCast.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import { SyntheticToken } from "./SyntheticToken.sol";
import { ISyntheticToken } from "./interfaces/ISyntheticToken.sol";
import { IMinimalUniswapV3Factory } from "./interfaces/IMinimalUniswapV3Factory.sol";
import { IMinimalNonfungiblePositionManager } from "./interfaces/IMinimalNonfungiblePositionManager.sol";
import { OApp, MessagingFee, Origin } from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import { OAppOptionsType3 } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OAppOptionsType3.sol";
import { OptionsBuilder } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";

//import { console } from "hardhat/console.sol";
//import { MessagingReceipt } from "@layerzerolabs/oapp-evm/contracts/oapp/OAppSender.sol";

contract TestCrossChainSwapReceiver is OApp, OAppOptionsType3 {
    using SafeCast for uint256;
    using TransferHelper for address;
    using OptionsBuilder for bytes;

    struct SwapParams {
        address recipient;
        uint32 dstEid;
        uint128 gasLimit;
        uint256 value;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
    }

    uint160 internal constant MIN_SQRT_RATIO = 4295128739;
    uint160 internal constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

    bool public simulateError = false;

    address public immutable poolAddress;
    ISyntheticToken public immutable tokenA;
    ISyntheticToken public immutable tokenB;

    constructor(
        address _factory,
        address _positionManager,
        address _endpoint
    ) OApp(_endpoint, msg.sender) Ownable(msg.sender) {
        bytes32 salt = keccak256(abi.encode(msg.sender));
        tokenA = new SyntheticToken{ salt: salt }("Token A", "sA", 18);
        tokenB = new SyntheticToken{ salt: salt }("Token B", "sB", 18);
        poolAddress = IMinimalUniswapV3Factory(_factory).createPool(
            address(tokenA),
            address(tokenB),
            500
        );
        IMinimalNonfungiblePositionManager positionManager = IMinimalNonfungiblePositionManager(
            _positionManager
        );
        IMinimalUniswapV3Pool(poolAddress).initialize(1461446703485210103287273052);
        address token0 = address(tokenA) < address(tokenB) ? address(tokenA) : address(tokenB);
        address token1 = address(tokenA) < address(tokenB) ? address(tokenB) : address(tokenA);
        _maxApproveIfNecessary(token0, address(positionManager));
        _maxApproveIfNecessary(token1, address(positionManager));
        uint256 amount0 = 100000_000_000 * 1e18;
        uint256 amount1 = 100000_000_000 * 1e18;
        tokenA.mint(address(this), amount0);
        tokenB.mint(address(this), amount1);

        positionManager.mint(
            IMinimalNonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: 500,
                tickLower: -887250, //full range for 500
                tickUpper: 887250,
                amount0Desired: amount0,
                amount1Desired: amount1,
                amount0Min: 0,
                amount1Min: 0,
                recipient: address(this),
                deadline: block.timestamp
            })
        );
        uint256 remaining0 = tokenA.balanceOf(address(this));
        uint256 remaining1 = tokenB.balanceOf(address(this));
        tokenA.burn(address(this), remaining0);
        tokenB.burn(address(this), remaining1);
    }

    modifier onlyV3Pool() {
        require(msg.sender == poolAddress, "INVALID_CALLER");
        _;
    }

    function setSimulateError(bool _simulateError) external onlyOwner {
        simulateError = _simulateError;
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
        SwapParams memory params = abi.decode(_payload, (SwapParams));

        require(msg.value >= params.value, "OmniCounter: insufficient value");

        string memory errorMessage = "";

        if (params.tokenIn == address(tokenA)) {
            tokenA.mint(address(this), params.amountIn);
        } else if (params.tokenIn == address(tokenB)) {
            tokenB.mint(address(this), params.amountIn);
        } else {
            errorMessage = "INVALID_TOKEN_IN";
        }
        uint256 amountOut;
        uint32 targetEid = params.dstEid;
        address targetToken = params.tokenOut;

        (amountOut, errorMessage) = _v3SwapExactInput(
            params.tokenIn,
            params.tokenOut,
            params.amountIn
        );

        if (bytes(errorMessage).length > 0) {
            targetEid = _origin.srcEid;
            targetToken = params.tokenIn;
            amountOut = params.amountIn;
        }

        ISyntheticToken(targetToken).burn(address(this), amountOut);

        bytes memory payload = abi.encode(
            params.recipient,
            targetToken,
            amountOut,
            _guid,
            errorMessage
        );

        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(
            params.gasLimit,
            0
        );

        _lzSend(targetEid, payload, options, MessagingFee(msg.value, 0), payable(params.recipient));
    }

    function quote(
        address recipient,
        address tokenIn,
        address tokenOut,
        uint32 srcEid,
        uint32 dstEid,
        bytes calldata options
    ) public view returns (uint256) {
        bytes32 _guid = bytes32(uint256(uint160(recipient)));
        bytes memory payload = abi.encode(
            recipient,
            tokenOut,
            1,
            _guid,
            "THIS_IS_FAKE_ERROR_MESSAGE"
        );
        bytes memory payload2 = abi.encode(
            recipient,
            tokenIn,
            1,
            _guid,
            "THIS_IS_FAKE_ERROR_MESSAGE"
        );

        MessagingFee memory fee = _quote(dstEid, payload, options, false);
        MessagingFee memory fee2 = _quote(srcEid, payload2, options, false);
        return fee.nativeFee > fee2.nativeFee ? fee.nativeFee : fee2.nativeFee;
    }

    function _v3SwapExactInput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal returns (uint256 amountOut, string memory errorMessage) {
        bool zeroForTokenIn = tokenIn < tokenOut;
        if (simulateError) {
            errorMessage = string(abi.encodePacked("V3", "THIS_IS_FAKE_ERROR"));
            return (0, errorMessage);
        }

        try
            IMinimalUniswapV3Pool(poolAddress).swap(
                address(this), //recipient
                zeroForTokenIn,
                amountIn.toInt256(),
                zeroForTokenIn ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1,
                abi.encode(tokenIn)
            )
        returns (int256 amount0Delta, int256 amount1Delta) {
            amountOut = uint256(-(zeroForTokenIn ? amount1Delta : amount0Delta));
        } catch (bytes memory err) {
            errorMessage = string(abi.encodePacked("V3", string(err)));
        }
        return (amountOut, errorMessage);
    }

    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external onlyV3Pool {
        address tokenIn = abi.decode(data, (address));
        uint256 amountToPay = amount0Delta > 0 ? uint256(amount0Delta) : uint256(amount1Delta);
        tokenIn.safeTransfer(msg.sender, amountToPay);
    }

    function _tryApprove(address token, address spender, uint256 amount) private returns (bool) {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.approve.selector, spender, amount)
        );
        return success && (data.length == 0 || abi.decode(data, (bool)));
    }

    function _maxApproveIfNecessary(address token, address spender) internal {
        if (IERC20(token).allowance(address(this), spender) < type(uint128).max) {
            if (!_tryApprove(token, spender, type(uint256).max)) {
                if (!_tryApprove(token, spender, type(uint256).max - 1)) {
                    require(_tryApprove(token, spender, 0));
                    if (!_tryApprove(token, spender, type(uint256).max)) {
                        if (!_tryApprove(token, spender, type(uint256).max - 1)) {
                            revert("ERC20_APPROVE_DID_NOT_SUCCEED");
                        }
                    }
                }
            }
        }
    }
}
