import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const LZ_ENDPOINT = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
const ARBITRUM_GATEWAY = "0x187ddd9a94236ba6d22376ee2e3c4c834e92f34e";
const ARBITRUM_EID = 30110;

async function main() {
  const [signer] = await ethers.getSigners();
  const provider = ethers.provider;
  
  console.log("=== Checking and Clearing Stuck Messages ===\n");
  console.log(`Signer: ${signer.address}`);
  
  const gatewayBytes32 = ethers.utils.hexZeroPad(ARBITRUM_GATEWAY, 32);

  const lzEndpoint = await ethers.getContractAt(
    [
      "function inboundPayloadHash(address _receiver, uint32 _srcEid, bytes32 _sender, uint64 _nonce) view returns (bytes32)",
      "function inboundNonce(address _receiver, uint32 _srcEid, bytes32 _sender) view returns (uint64)",
      "function lazyInboundNonce(address _receiver, uint32 _srcEid, bytes32 _sender) view returns (uint64)",
      "function skip(address _oapp, uint32 _srcEid, bytes32 _sender, uint64 _nonce) external",
      "function nilify(address _oapp, uint32 _srcEid, bytes32 _sender, uint64 _nonce, bytes32 _payloadHash) external",
      "function clear(address _oapp, tuple(uint32 srcEid, bytes32 sender, uint64 nonce) _origin, bytes32 _guid, bytes calldata _message) external"
    ],
    LZ_ENDPOINT
  );

  // Check current state
  const inboundNonce = await lzEndpoint.inboundNonce(HUB_ADDRESS, ARBITRUM_EID, gatewayBytes32);
  const lazyNonce = await lzEndpoint.lazyInboundNonce(HUB_ADDRESS, ARBITRUM_EID, gatewayBytes32);
  
  console.log(`Inbound nonce: ${inboundNonce}`);
  console.log(`Lazy nonce: ${lazyNonce}`);

  // Check all nonces for stuck messages
  console.log("\n=== Checking for stuck messages ===");
  const stuckNonces = [];
  
  for (let nonce = 1; nonce <= Number(inboundNonce) + 5; nonce++) {
    const hash = await lzEndpoint.inboundPayloadHash(HUB_ADDRESS, ARBITRUM_EID, gatewayBytes32, nonce);
    if (hash !== ethers.constants.HashZero) {
      console.log(`Nonce ${nonce}: STUCK (hash: ${hash.slice(0, 20)}...)`);
      stuckNonces.push({ nonce, hash });
    }
  }

  if (stuckNonces.length === 0) {
    console.log("No stuck messages found!");
    return;
  }

  console.log(`\nFound ${stuckNonces.length} stuck message(s)`);

  // The Hub owner can call skip() to skip a stuck message
  // But we need to be careful - this means the funds are lost
  
  console.log("\n=== Options to Handle Stuck Messages ===");
  console.log(`
1. **Retry via LayerZero Scan** (RECOMMENDED)
   - Go to LayerZero Scan and find the failed transaction
   - Use the "Retry" button with higher gas
   - This will deliver the message and mint the tokens

2. **Skip the message** (WARNING: funds may be lost)
   - The OApp owner can call endpoint.skip()
   - This marks the message as processed without executing
   - USE ONLY IF THE MESSAGE CANNOT BE RETRIED

3. **Clear via OApp**
   - The OApp can call endpoint.clear() with the original message
   - This requires knowing the original message content
`);

  // Check if signer is the Hub owner
  const hub = await ethers.getContractAt(
    ["function owner() view returns (address)"],
    HUB_ADDRESS
  );
  const hubOwner = await hub.owner();
  
  console.log(`Hub owner: ${hubOwner}`);
  console.log(`Signer is owner: ${hubOwner.toLowerCase() === signer.address.toLowerCase()}`);

  if (hubOwner.toLowerCase() === signer.address.toLowerCase()) {
    console.log("\n⚠️ You CAN skip stuck messages, but this should be a last resort!");
    console.log("   Try the LayerZero Scan retry first.");
    
    // Don't actually skip here - just show how
    console.log(`
To skip a stuck message (CAREFUL - funds may be lost):
  
const tx = await lzEndpoint.skip(
  "${HUB_ADDRESS}",  // OApp
  ${ARBITRUM_EID},              // srcEid
  "${gatewayBytes32}", // sender
  ${stuckNonces[0].nonce}                 // nonce
);
`);
  }

  console.log("\n=== Recommended Action ===");
  console.log(`
1. Go to: https://layerzeroscan.com/
2. Search for your failed Arbitrum tx: 0x69837b09d89de33ecd13a7777d1fa73fd254f13b880eafcaa6a911b90717d345
3. Look for "Retry" or "Resubmit" option
4. Make sure to use higher gas (1.5M+)

If retry keeps failing, the issue might be:
- Something inside _lzReceive is reverting
- Need to debug the exact error from LayerZero Scan
`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


