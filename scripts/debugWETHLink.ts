import { ethers } from "hardhat";

async function main() {
  const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
  const SWETH_ADDRESS = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
  
  const ARBITRUM_EID = 30110;
  const WETH_ARBITRUM = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
  
  const provider = ethers.provider;
  
  console.log("=== Debugging WETH Link ===\n");

  // Try to call _syntheticAddressByRemoteAddress directly using storage slots
  // First, let's check what the Hub has for this mapping
  
  // The internal function is:
  // mapping(uint32 => mapping(address => address)) internal _syntheticAddressByRemoteAddress;
  
  // Let's try calling with ethers interface directly
  const hub = await ethers.getContractAt(
    [
      // Read internal mappings via direct calls isn't possible
      // Let's check peers configuration
      "function peers(uint32) view returns (bytes32)",
      "function syntheticTokens(uint256) view returns (address)",
      "function owner() view returns (address)"
    ],
    HUB_ADDRESS
  );

  // Get synthetic tokens
  console.log("=== Synthetic Tokens ===");
  for (let i = 0; i < 4; i++) {
    try {
      const token = await hub.syntheticTokens(i);
      console.log(`Token ${i}: ${token}`);
      
      // Check if this token has remote info for Arbitrum
      const tokenContract = await ethers.getContractAt(
        [
          "function name() view returns (string)",
          "function symbol() view returns (string)"
        ],
        token
      );
      
      try {
        const name = await tokenContract.name();
        const symbol = await tokenContract.symbol();
        console.log(`  Name: ${name}, Symbol: ${symbol}`);
      } catch (e) {
        console.log(`  Could not get token info`);
      }
    } catch (e: any) {
      console.log(`Token ${i}: Error - ${e.message?.slice(0, 50)}`);
    }
  }

  // Check the Arbitrum peer
  const arbPeer = await hub.peers(ARBITRUM_EID);
  console.log(`\nArbitrum peer: ${arbPeer}`);
  
  // The peer should be the Arbitrum Gateway address
  const expectedGateway = "0x187ddd9a94236ba6d22376ee2e3c4c834e92f34e";
  console.log(`Expected gateway: ${expectedGateway}`);
  
  if (arbPeer.toLowerCase().includes(expectedGateway.toLowerCase().slice(2))) {
    console.log("✅ Arbitrum Gateway is correctly set as peer");
  } else {
    console.log("❌ Peer mismatch!");
  }

  // Now let's try to read the remote token mapping using raw call
  // _remoteTokens is: mapping(address => mapping(uint32 => RemoteTokenInfo))
  // We need to find the slot
  
  console.log("\n=== Checking Hub Storage ===");
  
  // For debugging, let's call the Hub directly using its internal method if exposed
  // Otherwise we need to look at the Getters more carefully
  
  // Try the HubGetters with the correct ABI matching what's deployed
  const HUB_GETTERS = "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e";
  
  // Check what functions are actually available on the getters
  const gettersCode = await provider.getCode(HUB_GETTERS);
  console.log(`Getters code length: ${gettersCode.length}`);
  
  // Try calling getSyntheticTokenCount with raw call to see raw response
  const countSelector = ethers.utils.id("getSyntheticTokenCount()").slice(0, 10);
  const countResult = await provider.call({
    to: HUB_GETTERS,
    data: countSelector
  });
  console.log(`getSyntheticTokenCount raw result: ${countResult}`);
  const count = ethers.BigNumber.from(countResult);
  console.log(`Decoded count: ${count.toString()}`);

  // Try getSyntheticTokenInfo with proper encoding
  console.log("\n=== Trying getSyntheticTokenInfo ===");
  const infoSelector = ethers.utils.id("getSyntheticTokenInfo(uint256)").slice(0, 10);
  for (let i = 0; i < 4; i++) {
    const indexParam = ethers.utils.defaultAbiCoder.encode(["uint256"], [i]);
    const calldata = infoSelector + indexParam.slice(2);
    
    try {
      const result = await provider.call({
        to: HUB_GETTERS,
        data: calldata
      });
      console.log(`Token ${i} raw result: ${result.slice(0, 200)}...`);
      
      // Try to decode
      if (result && result !== "0x") {
        // The return is (address, string, uint8, bool)
        // But string encoding is complex, let's just extract the address
        const address = "0x" + result.slice(26, 66);
        console.log(`  Address: ${address}`);
      }
    } catch (e: any) {
      console.log(`Token ${i} error: ${e.message?.slice(0, 100)}`);
    }
  }

  // Check getRemoteTokenInfo
  console.log("\n=== Trying getRemoteTokenInfo for sWETH on Arbitrum ===");
  const remoteInfoSelector = ethers.utils.id("getRemoteTokenInfo(address,uint32)").slice(0, 10);
  const params = ethers.utils.defaultAbiCoder.encode(
    ["address", "uint32"],
    [SWETH_ADDRESS, ARBITRUM_EID]
  );
  const calldata = remoteInfoSelector + params.slice(2);
  
  try {
    const result = await provider.call({
      to: HUB_GETTERS,
      data: calldata
    });
    console.log(`Raw result: ${result}`);
    console.log(`Result length: ${result.length}`);
    
    // Try to decode as tuple
    // RemoteTokenInfo: (address remoteAddress, uint8 decimalsDelta, bool paused, uint256 totalBalance, address syntheticToken)
    if (result && result.length > 2) {
      // Each field is 32 bytes = 64 hex chars
      const remoteAddr = "0x" + result.slice(26, 66);
      const decimalsDelta = parseInt(result.slice(66, 130), 16);
      const paused = parseInt(result.slice(130, 194), 16) !== 0;
      const totalBalance = ethers.BigNumber.from("0x" + result.slice(194, 258));
      const syntheticToken = "0x" + result.slice(282, 322);
      
      console.log(`\nDecoded:`);
      console.log(`  Remote Address: ${remoteAddr}`);
      console.log(`  Decimals Delta: ${decimalsDelta}`);
      console.log(`  Paused: ${paused}`);
      console.log(`  Total Balance: ${ethers.utils.formatEther(totalBalance)} ETH`);
      console.log(`  Synthetic Token: ${syntheticToken}`);
      
      if (remoteAddr.toLowerCase() === WETH_ARBITRUM.toLowerCase()) {
        console.log(`\n✅ sWETH IS correctly linked to Arbitrum WETH!`);
      } else if (remoteAddr === "0x0000000000000000000000000000000000000000") {
        console.log(`\n❌ sWETH is NOT linked to any Arbitrum token!`);
      } else {
        console.log(`\n⚠️ sWETH is linked to different address: ${remoteAddr}`);
      }
    }
  } catch (e: any) {
    console.log(`Error: ${e.message?.slice(0, 200)}`);
  }

  // Also check the reverse mapping
  console.log("\n=== Checking reverse mapping (remoteAddress -> syntheticToken) ===");
  const reverseSelector = ethers.utils.id("getRemoteTokenByAddress(uint32,address)").slice(0, 10);
  const reverseParams = ethers.utils.defaultAbiCoder.encode(
    ["uint32", "address"],
    [ARBITRUM_EID, WETH_ARBITRUM]
  );
  const reverseCalldata = reverseSelector + reverseParams.slice(2);
  
  try {
    const result = await provider.call({
      to: HUB_GETTERS,
      data: reverseCalldata
    });
    console.log(`Raw result: ${result}`);
    
    if (result && result.length > 2) {
      const remoteAddr = "0x" + result.slice(26, 66);
      const syntheticToken = "0x" + result.slice(282, 322);
      
      console.log(`Decoded:`);
      console.log(`  Remote Address: ${remoteAddr}`);
      console.log(`  Synthetic Token: ${syntheticToken}`);
      
      if (syntheticToken.toLowerCase() === SWETH_ADDRESS.toLowerCase()) {
        console.log(`\n✅ WETH on Arbitrum IS mapped to sWETH!`);
      } else if (syntheticToken === "0x0000000000000000000000000000000000000000") {
        console.log(`\n❌ WETH on Arbitrum is NOT mapped to any synthetic token!`);
        console.log(`   This is the root cause of bridge failures!`);
      } else {
        console.log(`\n⚠️ WETH on Arbitrum is mapped to different synthetic: ${syntheticToken}`);
      }
    }
  } catch (e: any) {
    console.log(`Error: ${e.message?.slice(0, 200)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


