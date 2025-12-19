import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const SBTC_ADDRESS = "0x1DeFDa524B2B5edB94299775B23d7E3dde1Fbb6C";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Checking if sBTC is Properly Registered ===\n");
  
  // Call the Hub's view function directly
  const hub = await ethers.getContractAt(
    [
      "function getSyntheticTokenByIndex(uint256 _index) view returns (address)",
      "function getSyntheticTokenCount() view returns (uint256)"
    ],
    HUB_ADDRESS,
    signer
  );

  // Try to get token count
  console.log("=== Synthetic Token Count ===");
  try {
    const count = await hub.getSyntheticTokenCount();
    console.log(`Count: ${count.toString()}`);
  } catch (e: any) {
    console.log(`getSyntheticTokenCount failed: ${e.reason || e.message?.slice(0, 80)}`);
  }

  // Try to get sBTC by index
  console.log("\n=== Getting Token by Index ===");
  for (let i = 0; i <= 10; i++) {
    try {
      const tokenAddr = await hub.getSyntheticTokenByIndex(i);
      console.log(`Index ${i}: ${tokenAddr}`);
      if (tokenAddr.toLowerCase() === SBTC_ADDRESS.toLowerCase()) {
        console.log(`   ^^^ This is sBTC!`);
      }
    } catch (e: any) {
      // Likely out of bounds
      break;
    }
  }

  // Try to check the sBTC itself
  console.log("\n=== sBTC Token Details ===");
  const sbtc = await ethers.getContractAt(
    [
      "function name() view returns (string)",
      "function symbol() view returns (string)",
      "function decimals() view returns (uint8)",
      "function owner() view returns (address)",
      "function tokenIndex() view returns (uint256)"
    ],
    SBTC_ADDRESS,
    signer
  );

  try {
    const name = await sbtc.name();
    const symbol = await sbtc.symbol();
    const decimals = await sbtc.decimals();
    const owner = await sbtc.owner();
    const tokenIndex = await sbtc.tokenIndex();
    
    console.log(`Name: ${name}`);
    console.log(`Symbol: ${symbol}`);
    console.log(`Decimals: ${decimals}`);
    console.log(`Owner: ${owner}`);
    console.log(`Token Index: ${tokenIndex.toString()}`);
    console.log(`Hub is owner: ${owner.toLowerCase() === HUB_ADDRESS.toLowerCase()}`);
  } catch (e: any) {
    console.log(`Error reading sBTC: ${e.reason || e.message?.slice(0, 80)}`);
  }

  // Let's also try the HubGetters contract
  console.log("\n=== Using HubGetters ===");
  const HUB_GETTERS = "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e";
  const hubGetters = await ethers.getContractAt(
    [
      "function getSyntheticTokenCount() view returns (uint256)"
    ],
    HUB_GETTERS,
    signer
  );

  try {
    const count = await hubGetters.getSyntheticTokenCount();
    console.log(`Getters count: ${count.toString()}`);
  } catch (e: any) {
    console.log(`Getters failed: ${e.reason || e.message?.slice(0, 80)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

