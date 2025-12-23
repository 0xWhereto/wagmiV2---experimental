import { ethers } from "hardhat";

const LEVERAGE_AMM = "0x8CA24d00ffcF60e9ba7F67F9d41ccA28E22dF508";

async function main() {
  const provider = ethers.provider;
  
  console.log("=== Checking v3LPVault getter ===\n");

  // Try different function names
  const tests = [
    "v3Vault()",
    "v3LPVault()",
    "lpVault()",
    "vault()"
  ];

  for (const fn of tests) {
    const selector = ethers.utils.id(fn).slice(0, 10);
    try {
      const result = await provider.call({
        to: LEVERAGE_AMM,
        data: selector
      });
      console.log(`✅ ${fn}: ${result}`);
    } catch (e: any) {
      console.log(`❌ ${fn}: REVERTS`);
    }
  }

  // Get the actual contract ABI from the artifacts
  console.log("\n--- Checking actual selector for v3LPVault ---");
  console.log("v3LPVault() selector:", ethers.utils.id("v3LPVault()").slice(0, 10));
}

main().catch(console.error);
