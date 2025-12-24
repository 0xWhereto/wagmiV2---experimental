import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const ARB_EID = 30110;

// Check the address from slot 3
const SLOT3_ADDR = "0x3a27f366e09fe76a50dd50d415c770f6caf0f3e6";

async function main() {
  console.log("=== Check Hub Getters ===");
  
  // Check what's at the slot 3 address
  console.log("Checking address from slot 3:", SLOT3_ADDR);
  const code = await ethers.provider.getCode(SLOT3_ADDR);
  console.log("Has code:", code.length > 2);
  
  // Try to use the getters helper if deployed
  const gettersABI = [
    "function getSyntheticTokenByIndex(uint256 index) external view returns (address)",
    "function getSyntheticTokenCount() external view returns (uint256)",
    "function getRemoteTokenInfo(uint32 eid, address remoteToken) external view returns (address syntheticToken, int8 decimalsDelta, uint256 minBridgeAmt)"
  ];
  
  // Check if there's a getters contract we can find
  console.log("\nLooking for SyntheticTokenHubGetters...");
  
  // Use the Hub directly with more complete ABI
  const fullHubABI = [
    "function getSyntheticTokenByIndex(uint256 index) external view returns (tuple(string name, uint8 decimals, address tokenAddress))",
    "function getSyntheticTokensLength() external view returns (uint256)",
    "function getAllSyntheticTokens() external view returns (tuple(string name, uint8 decimals, address tokenAddress)[])",
    "function getRemoteTokensLength(uint32 eid) external view returns (uint256)",
    "function getAllRemoteTokens(uint32 eid) external view returns (tuple(address tokenAddress, address syntheticTokenAddress, int8 decimalsDelta, uint256 minBridgeAmt)[])"
  ];
  
  const hub = await ethers.getContractAt(fullHubABI, HUB_ADDRESS);
  
  try {
    const count = await hub.getSyntheticTokensLength();
    console.log("Synthetic tokens count:", count.toString());
    
    if (count.gt(0)) {
      const tokens = await hub.getAllSyntheticTokens();
      console.log("\nSynthetic tokens:");
      for (const t of tokens) {
        console.log(`  - ${t.name} (${t.decimals} decimals): ${t.tokenAddress}`);
      }
    }
  } catch (e: any) {
    console.log("getSyntheticTokensLength error:", e.reason || e.message?.slice(0, 80));
  }
  
  try {
    const remoteCount = await hub.getRemoteTokensLength(ARB_EID);
    console.log("\nRemote tokens from Arbitrum:", remoteCount.toString());
    
    if (remoteCount.gt(0)) {
      const remotes = await hub.getAllRemoteTokens(ARB_EID);
      console.log("Remote tokens:");
      for (const r of remotes) {
        console.log(`  - ${r.tokenAddress} -> ${r.syntheticTokenAddress}`);
      }
    }
  } catch (e: any) {
    console.log("getRemoteTokensLength error:", e.reason || e.message?.slice(0, 80));
  }
}

main().catch(console.error);
