import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

async function main() {
  console.log("=== Find Synthetic Tokens ===");
  
  const hub = await ethers.getContractAt("SyntheticTokenHub", HUB_ADDRESS);
  
  // Check if there's a way to list synthetic tokens
  console.log("Hub address:", HUB_ADDRESS);
  
  // Try to get synthetic token count or list
  try {
    // Try various function names
    const count = await hub.syntheticTokenCount();
    console.log("Synthetic token count:", count.toString());
  } catch (e) {
    // Try another way
  }
  
  // Check known addresses from our memory
  const knownAddresses = [
    { name: "sUSDC v1", addr: "0xA1b52eBc6e37d057e4Df26b72Ed89B05d60e9bD4" },
    { name: "sWETH v1", addr: "0x50c42dEAcD8Fc9773493ED674b675bE577f2634b" },
    { name: "sWBTC v1", addr: "0xE04496b766aFbF58B968dae4C067CE6e9eC65ec5" },
  ];
  
  console.log("\nChecking known addresses...");
  for (const item of knownAddresses) {
    const code = await ethers.provider.getCode(item.addr);
    console.log(`${item.name} (${item.addr}): ${code.length > 2 ? "EXISTS (" + code.length + " bytes)" : "NOT DEPLOYED"}`);
  }
  
  // Look at recent events from Hub
  console.log("\nChecking Hub for CreateSyntheticToken events...");
  const filter = hub.filters.SyntheticTokenCreated ? hub.filters.SyntheticTokenCreated() : null;
  if (filter) {
    const events = await hub.queryFilter(filter, 0, "latest");
    console.log("Events found:", events.length);
    for (const evt of events) {
      console.log("  -", evt.args);
    }
  } else {
    console.log("No SyntheticTokenCreated filter available");
  }
  
  // Check if there's a remoteTokens mapping we can query
  console.log("\nLooking for registered gateway vaults...");
  try {
    // Check if old gateway is registered
    const BASE_EID = 30184;
    const ETH_EID = 30101;
    
    for (const [name, eid] of [["Arbitrum", 30110], ["Base", BASE_EID], ["Ethereum", ETH_EID]]) {
      try {
        const gateway = await hub._gatewayVaultByEid(eid);
        console.log(`${name} (EID ${eid}): ${gateway}`);
      } catch (e) {
        // Function may not exist or be internal
      }
    }
  } catch (e: any) {
    console.log("Error:", e.message?.slice(0, 50));
  }
}

main().catch(console.error);
