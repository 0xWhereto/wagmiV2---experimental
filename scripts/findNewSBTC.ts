import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

// Known sBTC candidates that might be unlinked
const SBTC_CANDIDATES = [
  "0x2F0324268031E6413280F3B5ddBc4A97639A284a",
  "0x221Be78CCE1465946eA17e44aa08C4b756983b5F",
  "0x1DeFDa524B2B5edB94299775B23d7E3dde1Fbb6C",
  "0xcb84ade32Bb4E9053F9cA8D641bfD35Cb7Fe1f0c",
];

const ARBITRUM_EID = 30110;
const HUB_GETTERS = "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e";

async function main() {
  console.log("=== FINDING UNLINKED sBTC ===\n");
  
  const hubGetters = await ethers.getContractAt("SyntheticTokenHubGetters", HUB_GETTERS);
  
  for (const sbtc of SBTC_CANDIDATES) {
    console.log(`Checking ${sbtc}...`);
    
    try {
      // Check if it's a valid synthetic token
      const tokenIndex = await hubGetters.getTokenIndexByAddress(sbtc);
      console.log(`  Token index: ${tokenIndex}`);
      
      // Check if linked to Arbitrum
      const remoteInfo = await hubGetters.getRemoteTokenInfo(sbtc, ARBITRUM_EID);
      if (remoteInfo.remoteAddress === ethers.constants.AddressZero) {
        console.log(`  ✅ NOT linked to Arbitrum - USE THIS ONE!`);
        console.log(`\nsBTC to use: ${sbtc}`);
        return sbtc;
      } else {
        console.log(`  Already linked to: ${remoteInfo.remoteAddress}`);
      }
    } catch (e: any) {
      console.log(`  Error: ${e.reason || e.message?.slice(0, 50)}`);
    }
  }
  
  // Also check recent transactions for new sBTC creation
  console.log("\n\nChecking if tx 0xcdcb3c21... created a new sBTC...");
  const provider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");
  const receipt = await provider.getTransactionReceipt("0xcdcb3c2109312bb40a74eddc935d9e53c6a8cf9808d66f457a2b00364e95182b");
  
  if (receipt && receipt.logs) {
    console.log(`Found ${receipt.logs.length} logs`);
    for (const log of receipt.logs) {
      console.log(`  ${log.address}`);
    }
  }
}

main().catch(console.error);
