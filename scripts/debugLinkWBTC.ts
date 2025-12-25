import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const SBTC_ADDRESS = "0x1DeFDa524B2B5edB94299775B23d7E3dde1Fbb6C";

// WBTC addresses
const WBTC_ARBITRUM = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
const WBTC_ETHEREUM = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";

// Gateway addresses
const ARBITRUM_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const ETHEREUM_GATEWAY = "0xba36FC6568B953f691dd20754607590C59b7646a";

// EIDs
const ARBITRUM_EID = 30110;
const ETHEREUM_EID = 30101;

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Debugging WBTC Link Failure ===\n");
  
  const hub = await ethers.getContractAt(
    [
      "function manualLinkRemoteToken(address _syntheticTokenAddress, uint32 _srcEid, address _remoteTokenAddress, address _gatewayVault, int8 _decimalsDelta, uint256 _minBridgeAmt) external"
    ],
    HUB_ADDRESS,
    signer
  );

  // Check if sBTC has a token index
  const hubGetters = new ethers.Contract(
    HUB_ADDRESS,
    [
      "function _tokenIndexByAddress(address) view returns (uint256)"
    ],
    signer
  );

  // Try to read _syntheticAddressByRemoteAddress mapping to see if already linked
  console.log("=== Checking current Hub state ===");
  
  // Try static call to see exact error
  console.log("\n=== Testing manualLinkRemoteToken with static call ===");
  
  const decimalsDelta = 0;
  const minBridgeAmt = ethers.utils.parseUnits("0.00001", 8);

  try {
    await hub.callStatic.manualLinkRemoteToken(
      SBTC_ADDRESS,
      ARBITRUM_EID,
      WBTC_ARBITRUM,
      ARBITRUM_GATEWAY,
      decimalsDelta,
      minBridgeAmt,
      { gasLimit: 500000 }
    );
    console.log("✅ Static call succeeded - should work!");
  } catch (e: any) {
    console.log(`❌ Static call failed: ${e.reason || e.message}`);
    
    // Try to decode the error
    if (e.error?.data) {
      console.log(`Error data: ${e.error.data}`);
    }
    if (e.errorArgs) {
      console.log(`Error args: ${JSON.stringify(e.errorArgs)}`);
    }
  }

  // Check if WBTC from Arbitrum is already linked to something
  console.log("\n=== Checking if WBTC already linked ===");
  
  const iface = new ethers.utils.Interface([
    "function _syntheticAddressByRemoteAddress(uint32, address) view returns (address)",
    "function _tokenIndexByAddress(address) view returns (uint256)"
  ]);

  // These are private mappings, so we can't read them directly
  // Let's try calling from storage
  console.log("Attempting to read storage directly...");
  
  // Check sBTC token
  const sbtc = await ethers.getContractAt(
    [
      "function owner() view returns (address)",
      "function name() view returns (string)",
      "function symbol() view returns (string)"
    ],
    SBTC_ADDRESS,
    signer
  );

  try {
    const name = await sbtc.name();
    const symbol = await sbtc.symbol();
    const owner = await sbtc.owner();
    console.log(`\nsBTC Token:`);
    console.log(`  Name: ${name}`);
    console.log(`  Symbol: ${symbol}`);
    console.log(`  Owner: ${owner}`);
    console.log(`  Hub is owner: ${owner.toLowerCase() === HUB_ADDRESS.toLowerCase()}`);
  } catch (e: any) {
    console.log(`Error reading sBTC: ${e.message?.slice(0, 80)}`);
  }

  // Try with explicit gas estimation
  console.log("\n=== Gas Estimation ===");
  try {
    const gasEstimate = await hub.estimateGas.manualLinkRemoteToken(
      SBTC_ADDRESS,
      ARBITRUM_EID,
      WBTC_ARBITRUM,
      ARBITRUM_GATEWAY,
      decimalsDelta,
      minBridgeAmt
    );
    console.log(`Estimated gas: ${gasEstimate.toString()}`);
  } catch (e: any) {
    console.log(`Gas estimation failed: ${e.reason || e.message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


