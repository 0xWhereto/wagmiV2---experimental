import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const LZ_ENDPOINT = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
const ARBITRUM_GATEWAY = "0x187ddd9a94236ba6d22376ee2e3c4c834e92f34e";
const ARBITRUM_EID = 30110;
const FAILED_NONCE = 8;

async function main() {
  const [signer] = await ethers.getSigners();
  const provider = ethers.provider;
  
  console.log("=== Debugging Failed Message at Nonce 8 ===\n");
  console.log(`Signer: ${signer.address}`);
  
  const gatewayBytes32 = ethers.utils.hexZeroPad(ARBITRUM_GATEWAY, 32);

  // Get the payload hash
  const lzEndpoint = await ethers.getContractAt(
    [
      "function inboundPayloadHash(address _receiver, uint32 _srcEid, bytes32 _sender, uint64 _nonce) view returns (bytes32)",
      "function lzReceive(tuple(uint32 srcEid, bytes32 sender, uint64 nonce) origin, address receiver, bytes32 guid, bytes message, bytes extraData) external payable",
      "function retryPayload(address _receiver, uint32 _srcEid, bytes32 _sender, uint64 _nonce, bytes calldata _payload) external payable"
    ],
    LZ_ENDPOINT
  );

  const payloadHash = await lzEndpoint.inboundPayloadHash(HUB_ADDRESS, ARBITRUM_EID, gatewayBytes32, FAILED_NONCE);
  console.log(`Payload hash for nonce ${FAILED_NONCE}: ${payloadHash}`);

  if (payloadHash === ethers.constants.HashZero) {
    console.log("No failed message at this nonce.");
    return;
  }

  // The payload itself isn't stored on-chain, we need to get it from the original transaction
  // or from LayerZero's indexer
  
  console.log("\n=== Options to Retry ===");
  console.log(`
The message at nonce ${FAILED_NONCE} failed to execute.

To retry it, you have two options:

1. **Via LayerZero Scan UI**:
   - Go to https://layerzeroscan.com/
   - Search for your Arbitrum transaction hash
   - Click "Retry" if available
   - Make sure to increase the gas limit

2. **Via Manual Retry**:
   - You need the original message payload
   - Call endpoint.retryPayload() with more gas

To find the original message:
- Go to the Arbitrum transaction on Arbiscan
- Look at the "Input Data" tab
- The message payload is encoded in the deposit() call
`);

  // Let's try to simulate what would happen if we execute the message
  console.log("\n=== Simulating Hub _lzReceive ===");
  
  // We need to construct a mock Origin and call lzReceive to see what error we get
  // But this is complex without the actual payload
  
  // Let's check if there's a clear function on the Hub to retry
  console.log("Checking if Hub has clear/retry functions...");
  
  const hubCode = await provider.getCode(HUB_ADDRESS);
  
  // Check for common retry/clear function selectors
  const functions = [
    "clearPayload(uint32,bytes32,uint64)",
    "retryMessage(uint32,bytes32,uint64,bytes)",
    "lzReceive((uint32,bytes32,uint64),bytes32,bytes,address,bytes)"
  ];
  
  for (const func of functions) {
    const selector = ethers.utils.id(func).slice(0, 10);
    const found = hubCode.toLowerCase().includes(selector.slice(2).toLowerCase());
    console.log(`  ${func}: ${found ? "✅ Found" : "❌ Not found"}`);
  }

  // Let's check if we can call the Hub's lzReceive with a dummy message to see the error
  console.log("\n=== Testing Hub's Message Processing ===");
  
  // The Hub should have lzReceive from OApp
  const hub = await ethers.getContractAt(
    [
      "function lzReceive(tuple(uint32 srcEid, bytes32 sender, uint64 nonce) origin, bytes32 guid, bytes calldata message, address executor, bytes calldata extraData) external payable"
    ],
    HUB_ADDRESS
  );

  // Create a test message - this should fail with "LzEndpointNotCaller" or similar
  // But it will show us if the Hub's lzReceive is accessible
  const testOrigin = {
    srcEid: ARBITRUM_EID,
    sender: gatewayBytes32,
    nonce: 999 // Fake nonce
  };
  
  try {
    await hub.callStatic.lzReceive(
      testOrigin,
      ethers.constants.HashZero,
      "0x00",
      signer.address,
      "0x",
      { from: signer.address }
    );
  } catch (e: any) {
    console.log(`lzReceive test error: ${e.reason || e.message?.slice(0, 100)}`);
    // This should fail with "OnlyEndpoint" or similar, which is expected
  }

  console.log("\n=== Next Steps ===");
  console.log(`
1. Check LayerZero Scan for the exact error message
   URL: https://layerzeroscan.com/tx/[YOUR_ARBITRUM_TX_HASH]

2. If the error is "out of gas" or "execution reverted":
   - The UI's LZ options gas limit might still be too low
   - Current setting: 800,000 gas
   - Try increasing to 1,500,000 gas

3. To clear the stuck message and try again:
   - You may need to call the endpoint's clear function
   - Or wait for LayerZero's auto-retry mechanism
`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


