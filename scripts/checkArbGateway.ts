import { ethers } from "hardhat";

const ARBITRUM_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const WETH_ARBITRUM = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

async function main() {
  console.log("=== Checking Arbitrum Gateway Configuration ===\n");
  console.log("NOTE: This script runs on Sonic but we need to check Arbitrum.");
  console.log("The Gateway address is:", ARBITRUM_GATEWAY);
  console.log("WETH on Arbitrum is:", WETH_ARBITRUM);

  // We can't directly query Arbitrum from Sonic
  // But we can check what the Hub knows about the Gateway
  
  const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
  const ARBITRUM_EID = 30110;
  
  const provider = ethers.provider;
  
  // Check Hub's peer for Arbitrum
  const hub = await ethers.getContractAt(
    ["function peers(uint32) view returns (bytes32)"],
    HUB_ADDRESS
  );

  const arbPeer = await hub.peers(ARBITRUM_EID);
  console.log(`\nHub's peer for Arbitrum (EID ${ARBITRUM_EID}):`);
  console.log(`  ${arbPeer}`);
  
  const expectedGateway = ethers.utils.hexZeroPad(ARBITRUM_GATEWAY, 32);
  if (arbPeer.toLowerCase() === expectedGateway.toLowerCase()) {
    console.log("  ✅ Matches the configured gateway!");
  } else {
    console.log("  ❌ MISMATCH! Hub expects a different gateway!");
    console.log(`  Expected: ${expectedGateway}`);
  }

  console.log(`
=== To Debug on Arbitrum ===

You need to check the Arbitrum Gateway directly. Go to Arbiscan:
https://arbiscan.io/address/${ARBITRUM_GATEWAY}#readContract

Check these functions:
1. getTokenIndex("${WETH_ARBITRUM}") 
   - If this reverts with "Token not found", WETH is not linked
   
2. availableTokens(index) for each index 0, 1, 2...
   - Check if WETH appears in the list
   
3. getAllAvailableTokens()
   - See all linked tokens

Common causes of simulation failure:
1. WETH not linked to the Gateway → needs to call linkTokenToHub()
2. WETH is paused (onPause = true) → needs to call pauseToken(WETH, false)
3. Amount less than minBridgeAmt → check the minimum amount

=== Quick Check via Arbiscan ===

Go to: https://arbiscan.io/address/${ARBITRUM_GATEWAY}#readContract

Call: getTokenIndex
Input: ${WETH_ARBITRUM}

If it returns a number, WETH is linked.
If it reverts with "Token not found", WETH needs to be linked.
`);

  // Also check the remote token info on Hub side to compare
  console.log("=== Checking Hub's knowledge of WETH from Arbitrum ===");
  
  // Check _syntheticAddressByRemoteAddress
  const innerKey = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["uint32", "uint256"], [ARBITRUM_EID, 8])
  );
  const outerKey = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["address", "bytes32"], [WETH_ARBITRUM, innerKey])
  );
  const mappingValue = await provider.getStorageAt(HUB_ADDRESS, outerKey);
  const syntheticAddr = "0x" + mappingValue.slice(26, 66);
  
  console.log(`Hub maps WETH_ARBITRUM -> ${syntheticAddr}`);
  if (syntheticAddr !== "0x0000000000000000000000000000000000000000") {
    console.log("✅ Hub knows about WETH from Arbitrum");
  } else {
    console.log("❌ Hub does NOT know about WETH from Arbitrum!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


