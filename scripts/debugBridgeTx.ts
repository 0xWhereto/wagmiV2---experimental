import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const OLD_SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const LZ_ENDPOINT = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B"; // Sonic LZ Endpoint

const ARBITRUM_EID = 30110;

async function main() {
  const provider = ethers.provider;
  
  console.log("=== Debugging Bridge Transaction ===\n");
  
  // Check sWETH total supply (to see if any recent mints succeeded)
  const sweth = await ethers.getContractAt(
    [
      "function totalSupply() view returns (uint256)",
      "function balanceOf(address) view returns (uint256)"
    ],
    OLD_SWETH
  );
  
  const totalSupply = await sweth.totalSupply();
  console.log(`sWETH total supply: ${ethers.utils.formatEther(totalSupply)} ETH`);
  
  // Check recent blocks for any events from the Hub
  console.log("\n=== Checking Recent Hub Activity ===");
  const latestBlock = await provider.getBlockNumber();
  console.log(`Latest block: ${latestBlock}`);
  
  // Get recent logs from Hub
  const hubLogs = await provider.getLogs({
    address: HUB_ADDRESS,
    fromBlock: latestBlock - 1000,
    toBlock: latestBlock
  });
  console.log(`Hub logs in last 1000 blocks: ${hubLogs.length}`);
  
  for (const log of hubLogs.slice(-5)) {
    console.log(`  Block ${log.blockNumber}: ${log.topics[0]?.slice(0, 20)}...`);
  }

  // Check LZ Endpoint for any failed messages
  console.log("\n=== Checking LayerZero Endpoint ===");
  
  const lzEndpoint = await ethers.getContractAt(
    [
      "function inboundNonce(address _receiver, uint32 _srcEid, bytes32 _sender) view returns (uint64)"
    ],
    LZ_ENDPOINT
  );

  // Get the Arbitrum Gateway as bytes32
  const ARBITRUM_GATEWAY = "0x187ddd9a94236ba6d22376ee2e3c4c834e92f34e";
  const gatewayBytes32 = ethers.utils.hexZeroPad(ARBITRUM_GATEWAY, 32);
  
  try {
    const nonce = await lzEndpoint.inboundNonce(HUB_ADDRESS, ARBITRUM_EID, gatewayBytes32);
    console.log(`Inbound nonce from Arbitrum Gateway to Hub: ${nonce}`);
  } catch (e: any) {
    console.log(`Could not get inbound nonce: ${e.message?.slice(0, 100)}`);
  }

  // Check Hub peers
  console.log("\n=== Checking Hub Peers ===");
  const hub = await ethers.getContractAt(
    [
      "function peers(uint32) view returns (bytes32)",
      "function owner() view returns (address)"
    ],
    HUB_ADDRESS
  );

  const arbPeer = await hub.peers(ARBITRUM_EID);
  console.log(`Arbitrum peer (EID ${ARBITRUM_EID}): ${arbPeer}`);
  console.log(`Expected gateway: ${gatewayBytes32}`);
  
  if (arbPeer.toLowerCase() === gatewayBytes32.toLowerCase()) {
    console.log("✅ Peer matches!");
  } else {
    console.log("❌ Peer MISMATCH!");
  }

  // Check if there's a failed message that can be retried
  console.log("\n=== Checking for Failed Messages ===");
  
  // The LZ Endpoint V2 stores failed messages that can be retried
  // Let's check if there are any
  const endpointV2 = await ethers.getContractAt(
    [
      "function lazyInboundNonce(address _receiver, uint32 _srcEid, bytes32 _sender) view returns (uint64)",
      "function inboundNonce(address _receiver, uint32 _srcEid, bytes32 _sender) view returns (uint64)"
    ],
    LZ_ENDPOINT
  );

  try {
    const lazyNonce = await endpointV2.lazyInboundNonce(HUB_ADDRESS, ARBITRUM_EID, gatewayBytes32);
    const inboundNonce = await endpointV2.inboundNonce(HUB_ADDRESS, ARBITRUM_EID, gatewayBytes32);
    console.log(`Lazy inbound nonce: ${lazyNonce}`);
    console.log(`Inbound nonce: ${inboundNonce}`);
    
    if (lazyNonce > inboundNonce) {
      console.log(`⚠️ There are ${lazyNonce - inboundNonce} pending/failed messages!`);
    }
  } catch (e: any) {
    console.log(`Error checking nonces: ${e.message?.slice(0, 100)}`);
  }

  // Let's also check if the Hub is receiving messages correctly
  // by looking at the _lzReceive function
  console.log("\n=== Hub _lzReceive Check ===");
  
  // Check if the Hub has the correct endpoint set
  const hubEndpoint = await ethers.getContractAt(
    [
      "function endpoint() view returns (address)"
    ],
    HUB_ADDRESS
  );
  
  try {
    const endpoint = await hubEndpoint.endpoint();
    console.log(`Hub endpoint: ${endpoint}`);
    console.log(`Expected: ${LZ_ENDPOINT}`);
    
    if (endpoint.toLowerCase() === LZ_ENDPOINT.toLowerCase()) {
      console.log("✅ Endpoint matches!");
    } else {
      console.log("❌ Endpoint MISMATCH!");
    }
  } catch (e: any) {
    console.log(`Error getting endpoint: ${e.message?.slice(0, 100)}`);
  }

  // Check the remote token info to make sure it's not paused
  console.log("\n=== Checking Token Pause Status ===");
  
  const WETH_ARBITRUM = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
  
  // Read from storage slot 5 (_remoteTokens mapping)
  // mapping(address => mapping(uint32 => RemoteTokenInfo))
  // RemoteTokenInfo: address remoteAddress, int8 decimalsDelta, bool paused, uint256 totalBalance, uint256 minBridgeAmt
  
  const innerKey = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["uint32", "uint256"], [ARBITRUM_EID, 5])
  );
  const outerKey = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["address", "bytes32"], [OLD_SWETH, innerKey])
  );
  
  // The struct starts at this key
  // slot+0: remoteAddress (address)
  // slot+1: decimalsDelta (int8) - packed
  // slot+2: paused (bool) - might be packed with decimalsDelta
  
  const slot0 = await provider.getStorageAt(HUB_ADDRESS, outerKey);
  console.log(`RemoteTokenInfo slot 0 (remoteAddress): ${slot0}`);
  
  const slot1Key = ethers.BigNumber.from(outerKey).add(1);
  const slot1 = await provider.getStorageAt(HUB_ADDRESS, slot1Key.toHexString());
  console.log(`RemoteTokenInfo slot 1 (decimalsDelta, paused packed): ${slot1}`);
  
  // Parse slot1 - it's packed: int8 decimalsDelta, bool paused
  // In solidity, bool is 1 byte, int8 is 1 byte
  // They might be packed in the first 2 bytes
  const slot1Num = ethers.BigNumber.from(slot1);
  const pausedByte = slot1Num.shr(8).and(0xFF).toNumber(); // Second byte
  console.log(`Paused byte: ${pausedByte} (${pausedByte !== 0 ? 'PAUSED' : 'not paused'})`);

  console.log("\n=== Summary ===");
  console.log("If the transaction fails on LayerZero Scan with 'Executor Error',");
  console.log("it means the Hub's _lzReceive is reverting.");
  console.log("\nPossible causes:");
  console.log("1. Token is paused (check above)");
  console.log("2. Gas limit too low (we set 800k, might need more)");
  console.log("3. Some require failing in _processDepositMessage");
  console.log("\nCheck LayerZero Scan: https://layerzeroscan.com/");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


