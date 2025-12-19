import { ethers } from "hardhat";

async function main() {
  const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
  const SWETH_ADDRESS = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
  
  const ARBITRUM_EID = 30110;
  const WETH_ARBITRUM = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
  const ARBITRUM_GATEWAY = "0x187ddd9a94236ba6d22376ee2e3c4c834e92f34e";
  
  const provider = ethers.provider;
  
  console.log("=== Debugging manualLinkRemoteToken Revert ===\n");

  // Check _tokenIndexByAddress[sWETH]
  // This is a private mapping so we need to check via storage or different method
  
  // First, let's check if sWETH is in the syntheticTokens array
  const hub = await ethers.getContractAt(
    [
      "function owner() view returns (address)",
      // The Hub should have this function
      "function syntheticTokens(uint256) view returns (address)"
    ],
    HUB_ADDRESS
  );

  console.log("Checking syntheticTokens array...");
  let foundSWETH = false;
  for (let i = 0; i < 10; i++) {
    try {
      const token = await hub.syntheticTokens(i);
      console.log(`  syntheticTokens[${i}]: ${token}`);
      if (token.toLowerCase() === SWETH_ADDRESS.toLowerCase()) {
        foundSWETH = true;
        console.log(`  ✅ Found sWETH at index ${i}`);
      }
    } catch (e) {
      console.log(`  syntheticTokens[${i}]: (array ended)`);
      break;
    }
  }
  
  if (!foundSWETH) {
    console.log("\n❌ sWETH is NOT in the syntheticTokens array!");
    console.log("   This means sWETH was never registered with the Hub.");
    console.log("   We need to create and register sWETH on the Hub first.");
    return;
  }

  // Try to call manualLinkRemoteToken with staticCall to get revert reason
  console.log("\n=== Testing manualLinkRemoteToken with staticCall ===");
  
  const hubWithSigner = await ethers.getContractAt(
    [
      "function manualLinkRemoteToken(address _syntheticTokenAddress, address _remoteTokenAddress, uint32 _srcEid, address _gatewayVault, int8 _decimalsDelta, uint256 _minBridgeAmt) external"
    ],
    HUB_ADDRESS
  );

  try {
    await hubWithSigner.callStatic.manualLinkRemoteToken(
      SWETH_ADDRESS,
      WETH_ARBITRUM,
      ARBITRUM_EID,
      ARBITRUM_GATEWAY,
      0,
      ethers.utils.parseUnits("0.000001", 18)
    );
    console.log("✅ staticCall succeeded - the transaction should work");
  } catch (e: any) {
    console.log(`\n❌ staticCall failed with reason: ${e.reason || e.message}`);
    
    // Try to decode the error
    if (e.error?.data) {
      console.log(`Error data: ${e.error.data}`);
    }
  }

  // Check if _syntheticAddressByRemoteAddress is already set
  console.log("\n=== Checking if link already exists ===");
  
  // We'll read using the getters
  const HUB_GETTERS = "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e";
  
  // getRemoteTokenByAddress(uint32, address) returns the mapping
  const selector = ethers.utils.id("getRemoteTokenByAddress(uint32,address)").slice(0, 10);
  const params = ethers.utils.defaultAbiCoder.encode(
    ["uint32", "address"],
    [ARBITRUM_EID, WETH_ARBITRUM]
  );
  
  try {
    const result = await provider.call({
      to: HUB_GETTERS,
      data: selector + params.slice(2)
    });
    console.log(`getRemoteTokenByAddress result: ${result}`);
    
    if (result && result !== "0x" && result.length > 2) {
      // Extract the syntheticToken field (5th 32-byte slot)
      if (result.length >= 322) {
        const syntheticToken = "0x" + result.slice(282, 322);
        console.log(`Synthetic token in mapping: ${syntheticToken}`);
        
        if (syntheticToken !== "0x0000000000000000000000000000000000000000") {
          console.log("\n⚠️ The reverse mapping ALREADY EXISTS!");
          console.log("   This is why manualLinkRemoteToken fails with 'Already linked'");
        }
      }
    }
  } catch (e: any) {
    console.log(`getRemoteTokenByAddress reverted: ${e.message?.slice(0, 100)}`);
  }

  // Alternative: directly check _syntheticAddressByRemoteAddress storage slot
  console.log("\n=== Checking storage directly ===");
  
  // The mapping _syntheticAddressByRemoteAddress is at slot 7 (counting from 0)
  // But we need to compute the storage key properly
  // mapping(uint32 => mapping(address => address)) 
  // slot = keccak256(abi.encode(address, keccak256(abi.encode(uint32, slot))))
  
  // This is complex, let's try a different approach
  // Let's check if sWETH has the Hub as its owner or if it has minting rights
  
  const sWETH = await ethers.getContractAt(
    [
      "function owner() view returns (address)",
      "function name() view returns (string)",
      "function symbol() view returns (string)",
      "function hub() view returns (address)"
    ],
    SWETH_ADDRESS
  );

  try {
    const name = await sWETH.name();
    const symbol = await sWETH.symbol();
    console.log(`sWETH name: ${name}, symbol: ${symbol}`);
    
    const owner = await sWETH.owner();
    console.log(`sWETH owner: ${owner}`);
    
    try {
      const hub = await sWETH.hub();
      console.log(`sWETH hub: ${hub}`);
      
      if (hub.toLowerCase() !== HUB_ADDRESS.toLowerCase()) {
        console.log(`\n⚠️ sWETH's hub is different from the main Hub!`);
        console.log(`   Expected: ${HUB_ADDRESS}`);
        console.log(`   Actual: ${hub}`);
      }
    } catch (e) {
      console.log(`sWETH does not have hub() function`);
    }
  } catch (e: any) {
    console.log(`Error checking sWETH: ${e.message?.slice(0, 100)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

