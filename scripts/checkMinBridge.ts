import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const OLD_SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const ARBITRUM_EID = 30110;

async function main() {
  const provider = ethers.provider;
  
  console.log("=== Checking Bridge Configuration ===\n");

  // Use the Hub Getters to get complete info
  const HUB_GETTERS = "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e";
  
  const hubGetters = await ethers.getContractAt(
    [
      "function getRemoteTokenInfo(address syntheticToken, uint32 chainId) view returns (tuple(address remoteAddress, int8 decimalsDelta, bool paused, uint256 totalBalance, uint256 minBridgeAmt))",
      "function getSyntheticTokenCount() view returns (uint256)"
    ],
    HUB_GETTERS
  );

  // Get remote token info for sWETH on Arbitrum
  try {
    const info = await hubGetters.getRemoteTokenInfo(OLD_SWETH, ARBITRUM_EID);
    console.log("RemoteTokenInfo for sWETH -> Arbitrum:");
    console.log(`  Remote Address: ${info.remoteAddress}`);
    console.log(`  Decimals Delta: ${info.decimalsDelta}`);
    console.log(`  Paused: ${info.paused}`);
    console.log(`  Total Balance: ${ethers.utils.formatEther(info.totalBalance)} ETH`);
    console.log(`  Min Bridge Amount: ${ethers.utils.formatEther(info.minBridgeAmt)} ETH`);
    
    if (info.paused) {
      console.log("\n⚠️ TOKEN IS PAUSED! This is why bridges fail!");
    }
    
    if (info.minBridgeAmt.gt(0)) {
      console.log(`\n⚠️ Minimum bridge amount is ${ethers.utils.formatEther(info.minBridgeAmt)} ETH`);
      console.log("   Make sure you're bridging at least this amount!");
    }
  } catch (e: any) {
    console.log(`Error: ${e.message?.slice(0, 200)}`);
    
    // Try raw call
    console.log("\nTrying raw call...");
    const selector = ethers.utils.id("getRemoteTokenInfo(address,uint32)").slice(0, 10);
    const params = ethers.utils.defaultAbiCoder.encode(
      ["address", "uint32"],
      [OLD_SWETH, ARBITRUM_EID]
    );
    
    const result = await provider.call({
      to: HUB_GETTERS,
      data: selector + params.slice(2)
    });
    
    console.log(`Raw result: ${result}`);
    
    // Parse manually
    // The struct has 5 fields
    if (result.length >= 322) {
      const remoteAddr = "0x" + result.slice(26, 66);
      // Chunk 1 contains decimalsDelta (int8) - need to handle signed
      const chunk1 = ethers.BigNumber.from("0x" + result.slice(66, 130));
      const decimalsDelta = chunk1.isNegative() ? chunk1.toNumber() : chunk1.toNumber();
      // Chunk 2 could be paused (bool packed) or totalBalance
      const chunk2 = ethers.BigNumber.from("0x" + result.slice(130, 194));
      const chunk3 = ethers.BigNumber.from("0x" + result.slice(194, 258));
      
      console.log("\nParsed:");
      console.log(`  Remote Address: ${remoteAddr}`);
      console.log(`  Chunk1 (decimalsDelta?): ${chunk1.toString()}`);
      console.log(`  Chunk2: ${ethers.utils.formatEther(chunk2)} ETH`);
      console.log(`  Chunk3: ${ethers.utils.formatEther(chunk3)} ETH`);
    }
  }

  // Check what working transactions looked like
  console.log("\n=== Checking sWETH Mint Events ===");
  
  const sweth = await ethers.getContractAt(
    [
      "function totalSupply() view returns (uint256)",
      "event Transfer(address indexed from, address indexed to, uint256 value)"
    ],
    OLD_SWETH
  );

  const totalSupply = await sweth.totalSupply();
  console.log(`Current sWETH total supply: ${ethers.utils.formatEther(totalSupply)} ETH`);

  // Get mint events (Transfer from 0x0)
  const filter = sweth.filters.Transfer(ethers.constants.AddressZero, null, null);
  const latestBlock = await provider.getBlockNumber();
  
  try {
    const logs = await sweth.queryFilter(filter, latestBlock - 10000, latestBlock);
    console.log(`\nRecent mint events: ${logs.length}`);
    
    for (const log of logs.slice(-5)) {
      console.log(`  Block ${log.blockNumber}: ${ethers.utils.formatEther(log.args?.value || 0)} ETH to ${log.args?.to}`);
    }
  } catch (e: any) {
    console.log(`Error getting logs: ${e.message?.slice(0, 100)}`);
  }

  // Let's check if the Hub is receiving LZ messages
  console.log("\n=== Checking LZ Message Status ===");
  
  const LZ_ENDPOINT = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
  const ARBITRUM_GATEWAY = "0x187ddd9a94236ba6d22376ee2e3c4c834e92f34e";
  const gatewayBytes32 = ethers.utils.hexZeroPad(ARBITRUM_GATEWAY, 32);

  const lzEndpoint = await ethers.getContractAt(
    [
      "function inboundNonce(address _receiver, uint32 _srcEid, bytes32 _sender) view returns (uint64)",
      "function lazyInboundNonce(address _receiver, uint32 _srcEid, bytes32 _sender) view returns (uint64)"
    ],
    LZ_ENDPOINT
  );

  const inboundNonce = await lzEndpoint.inboundNonce(HUB_ADDRESS, ARBITRUM_EID, gatewayBytes32);
  const lazyNonce = await lzEndpoint.lazyInboundNonce(HUB_ADDRESS, ARBITRUM_EID, gatewayBytes32);
  
  console.log(`Inbound nonce: ${inboundNonce}`);
  console.log(`Lazy inbound nonce: ${lazyNonce}`);
  
  if (Number(inboundNonce) > Number(lazyNonce)) {
    console.log("\n⚠️ inboundNonce > lazyNonce suggests messages are being executed successfully");
    console.log("   The LZ message might be failing AFTER Hub receives it");
  }

  console.log("\n=== Potential Issues ===");
  console.log("1. Check LayerZero Scan for the exact error");
  console.log("2. The message might be failing inside _processDepositMessage");
  console.log("3. Try with a higher gas limit (1M+)");
  console.log("4. Check if the browser has cached old UI code (clear cache or hard refresh)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

