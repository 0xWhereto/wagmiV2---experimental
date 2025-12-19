import { ethers } from "hardhat";

async function main() {
  console.log("Checking WBTC -> Synthetic mappings...\n");
  
  const hubGetters = await ethers.getContractAt(
    "SyntheticTokenHubGetters",
    "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e"
  );

  // Check Ethereum WBTC
  console.log("Ethereum WBTC (EID 30101):");
  try {
    const syntheticAddr = await hubGetters.getSyntheticAddressByRemoteAddress(
      30101,
      "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"
    );
    console.log(`  Mapped to: ${syntheticAddr}`);
    if (syntheticAddr === ethers.constants.AddressZero) {
      console.log("  ✓ Not mapped - can be linked");
    } else {
      console.log("  ⚠️ Already mapped to a synthetic token!");
    }
  } catch (e: any) {
    console.log(`  Error: ${e.reason || e.message?.slice(0, 100)}`);
  }

  // Check Arbitrum WBTC
  console.log("\nArbitrum WBTC (EID 30110):");
  try {
    const syntheticAddr = await hubGetters.getSyntheticAddressByRemoteAddress(
      30110,
      "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f"
    );
    console.log(`  Mapped to: ${syntheticAddr}`);
    if (syntheticAddr === ethers.constants.AddressZero) {
      console.log("  ✓ Not mapped - can be linked");
    } else {
      console.log("  ⚠️ Already mapped to a synthetic token!");
    }
  } catch (e: any) {
    console.log(`  Error: ${e.reason || e.message?.slice(0, 100)}`);
  }
}

main();

