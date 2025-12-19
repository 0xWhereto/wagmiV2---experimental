// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title MockLzEndpoint
 * @notice A minimal mock LayerZero Endpoint for local development and testing
 * @dev This mock allows contracts to be deployed and basic calls to succeed,
 *      but does not actually perform cross-chain messaging.
 *      For production, use the real LayerZero Endpoint.
 */
contract MockLzEndpoint {
    // Simulated endpoint ID for local chain
    uint32 public constant LOCAL_EID = 420420;
    
    // Event for debugging
    event MockSend(
        uint32 indexed dstEid,
        bytes32 indexed receiver,
        bytes message,
        bytes options
    );
    
    event MockReceive(
        uint32 indexed srcEid,
        bytes32 indexed sender,
        bytes message
    );

    /**
     * @notice Get the endpoint ID of this mock endpoint
     */
    function eid() external pure returns (uint32) {
        return LOCAL_EID;
    }

    /**
     * @notice Mock quote function - returns a fixed fee for testing
     */
    function quote(
        uint32 /* _dstEid */,
        bytes calldata /* _message */,
        bytes calldata /* _options */,
        bool /* _payInLzToken */
    ) external pure returns (uint256 nativeFee, uint256 lzTokenFee) {
        // Return a small fee for testing purposes
        return (0.001 ether, 0);
    }

    /**
     * @notice Mock send function - emits event but doesn't actually send
     */
    function send(
        uint32 _dstEid,
        bytes32 _receiver,
        bytes calldata _message,
        bytes calldata _options,
        address /* _refundAddress */
    ) external payable returns (bytes32 guid, uint64 nonce) {
        emit MockSend(_dstEid, _receiver, _message, _options);
        
        // Return mock values
        guid = keccak256(abi.encodePacked(block.timestamp, msg.sender, _dstEid));
        nonce = uint64(block.number);
    }

    /**
     * @notice Set delegate (no-op for mock)
     */
    function setDelegate(address /* _delegate */) external {
        // No-op for mock
    }

    /**
     * @notice Check if a peer is set (always returns true for mock)
     */
    function isPeer(
        uint32 /* _eid */,
        bytes32 /* _peer */
    ) external pure returns (bool) {
        return true;
    }

    /**
     * @notice Mock function to simulate receiving a message (for testing)
     * @dev Call this to simulate an incoming cross-chain message
     *      Note: This is a simplified mock - real LZ has complex verification
     */
    function mockReceive(
        address _receiver,
        uint32 _srcEid,
        bytes32 _sender,
        bytes calldata _message
    ) external {
        emit MockReceive(_srcEid, _sender, _message);
        // In a real scenario, this would call lzReceive on the receiver
        // For local testing, messages are logged but not delivered
    }
}

