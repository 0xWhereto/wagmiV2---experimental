import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const SWETH = "0x895d970646bd58C697A2EF855754bd074Ef2018b";
const WETH_ARBITRUM = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const ARBITRUM_GATEWAY = "0x187ddd9a94236ba6d22376ee2e3c4c834e92f34e";
const ARBITRUM_EID = 30110;

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);
  
  const provider = ethers.provider;

  // First check that sWETH is registered in the Hub
  console.log("\n=== Checking if sWETH is registered ===");
  
  // The Hub has _tokenIndexByAddress mapping
  // We need to check if sWETH has an index > 0
  
  // Try to get the token index via a view function
  // The Hub should have internal mappings we can check via getter
  
  // First, let's check the syntheticTokens array
  console.log("\nChecking syntheticTokens array with the getters...");
  
  const hubGetters = await ethers.getContractAt(
    [
      "function getSyntheticTokenCount() view returns (uint256)",
      "function getSyntheticTokenInfo(uint256 index) view returns (address, string memory, uint8, bool)"
    ],
    "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e"
  );

  try {
    const count = await hubGetters.getSyntheticTokenCount();
    console.log(`Token count: ${count}`);
    
    // The count is 8, let's try different indices
    // The getters might use 1-based indexing
    for (let i = 1; i <= Number(count); i++) {
      try {
        const info = await hubGetters.getSyntheticTokenInfo(i);
        console.log(`  Token ${i}: ${info[1]} (${info[0]})`);
      } catch (e: any) {
        console.log(`  Token ${i}: ${e.reason || 'Error'}`);
      }
    }
  } catch (e: any) {
    console.log(`Error: ${e.message?.slice(0, 100)}`);
  }

  // Now let's try to simulate the manualLinkRemoteToken call
  console.log("\n=== Simulating manualLinkRemoteToken ===");
  
  const hub = await ethers.getContractAt(
    [
      "function manualLinkRemoteToken(address _syntheticTokenAddress, address _remoteTokenAddress, uint32 _srcEid, address _gatewayVault, int8 _decimalsDelta, uint256 _minBridgeAmt) external"
    ],
    HUB_ADDRESS,
    signer
  );

  // Try staticCall
  try {
    await hub.callStatic.manualLinkRemoteToken(
      SWETH,
      WETH_ARBITRUM,
      ARBITRUM_EID,
      ARBITRUM_GATEWAY,
      0,
      1000
    );
    console.log("✅ staticCall succeeded");
  } catch (e: any) {
    console.log(`❌ staticCall failed: ${e.reason || e.message}`);
    
    // Try to get more details
    if (e.data) {
      console.log(`Error data: ${e.data}`);
    }
    if (e.error?.reason) {
      console.log(`Error reason: ${e.error.reason}`);
    }
    if (e.errorArgs) {
      console.log(`Error args: ${JSON.stringify(e.errorArgs)}`);
    }
  }

  // Let's try a raw eth_call to get the exact revert data
  console.log("\n=== Raw eth_call ===");
  
  const iface = new ethers.utils.Interface([
    "function manualLinkRemoteToken(address _syntheticTokenAddress, address _remoteTokenAddress, uint32 _srcEid, address _gatewayVault, int8 _decimalsDelta, uint256 _minBridgeAmt) external"
  ]);
  
  const calldata = iface.encodeFunctionData("manualLinkRemoteToken", [
    SWETH,
    WETH_ARBITRUM,
    ARBITRUM_EID,
    ARBITRUM_GATEWAY,
    0,
    1000
  ]);
  
  try {
    const result = await provider.call({
      to: HUB_ADDRESS,
      data: calldata,
      from: signer.address
    });
    console.log(`Result: ${result}`);
  } catch (e: any) {
    console.log(`Call reverted: ${e.message}`);
    if (e.data) {
      console.log(`Revert data: ${e.data}`);
      // Try to decode the revert reason
      if (e.data.startsWith("0x08c379a0")) {
        // Standard Error(string) revert
        const reason = ethers.utils.defaultAbiCoder.decode(
          ["string"],
          "0x" + e.data.slice(10)
        );
        console.log(`Revert reason: "${reason[0]}"`);
      }
    }
  }

  // Check if the issue is with _tokenIndexByAddress
  console.log("\n=== Checking internal state ===");
  
  // The manualLinkRemoteToken function checks:
  // 1. require(_tokenIndexByAddress[_syntheticTokenAddress] > 0, "Synthetic token not found");
  // 2. require(_remoteTokenAddress != address(0), "Invalid remote token address");
  // 3. require(_syntheticAddressByRemoteAddress[_srcEid][_remoteTokenAddress] == address(0), "Already linked");
  
  // The first check is likely failing because _tokenIndexByAddress uses a different address
  // or the synthetic token was created but not properly indexed
  
  // Let's check if the sWETH token has the right owner
  const sweth = await ethers.getContractAt(
    [
      "function owner() view returns (address)",
      "function hub() view returns (address)"
    ],
    SWETH
  );
  
  try {
    const owner = await sweth.owner();
    console.log(`sWETH owner: ${owner}`);
    
    if (owner.toLowerCase() !== HUB_ADDRESS.toLowerCase()) {
      console.log(`⚠️ sWETH owner is NOT the Hub!`);
      console.log(`   This means sWETH might have been created differently.`);
    }
  } catch (e: any) {
    console.log(`Error getting sWETH owner: ${e.message?.slice(0, 100)}`);
  }

  try {
    const hub = await sweth.hub();
    console.log(`sWETH hub: ${hub}`);
  } catch (e: any) {
    console.log(`sWETH has no hub() function`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


