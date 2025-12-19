import { ethers } from "hardhat";

// OLD gateway addresses (from the config)
const OLD_GATEWAYS = {
  arbitrum: "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e",
  base: "0xB712543E7fB87C411AAbB10c6823cf39bbEBB4Bb",
  ethereum: "0xba36FC6568B953f691dd20754607590C59b7646a",
};

async function main() {
  console.log("Checking old gateway contracts...\n");

  // Check each old gateway
  for (const [chain, address] of Object.entries(OLD_GATEWAYS)) {
    const provider = new ethers.providers.JsonRpcProvider(
      chain === "arbitrum" ? "https://arb1.arbitrum.io/rpc" :
      chain === "ethereum" ? "https://ethereum-rpc.publicnode.com" :
      "https://mainnet.base.org"
    );
    
    console.log(`${chain.toUpperCase()}: ${address}`);
    
    try {
      const code = await provider.getCode(address);
      if (code.length > 2) {
        console.log(`  ✅ Contract exists`);
        
        // Try to read the owner
        const gw = new ethers.Contract(address, [
          "function owner() view returns (address)",
          "function isPaused() view returns (bool)",
        ], provider);
        
        try {
          const owner = await gw.owner();
          console.log(`  Owner: ${owner}`);
        } catch {
          console.log(`  Owner: could not read`);
        }
        
        try {
          const paused = await gw.isPaused();
          console.log(`  Paused: ${paused}`);
        } catch {
          console.log(`  Paused: could not read`);
        }
      } else {
        console.log(`  ❌ No contract at address`);
      }
    } catch (e: any) {
      console.log(`  Error: ${e.message?.substring(0, 50)}`);
    }
    console.log();
  }
}

main().catch(console.error);
