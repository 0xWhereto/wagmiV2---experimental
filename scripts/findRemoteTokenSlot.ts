import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const OLD_SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const WETH_ARBITRUM = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const ARBITRUM_EID = 30110;

async function main() {
  const provider = ethers.provider;
  
  console.log("=== Finding _remoteTokens Storage Slot ===\n");
  
  // _remoteTokens is: mapping(address => mapping(uint32 => RemoteTokenInfo))
  // Storage key: keccak256(abi.encode(uint32, keccak256(abi.encode(address, slot))))
  
  // The struct RemoteTokenInfo has:
  // address remoteAddress
  // int8 decimalsDelta
  // bool paused
  // uint256 totalBalance
  // uint256 minBridgeAmt
  
  console.log("Searching for _remoteTokens mapping...");
  
  for (let slot = 3; slot <= 15; slot++) {
    // First level: mapping(address => ...)
    const innerKey = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [OLD_SWETH, slot])
    );
    
    // Second level: mapping(... => mapping(uint32 => RemoteTokenInfo))
    const outerKey = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(["uint32", "bytes32"], [ARBITRUM_EID, innerKey])
    );
    
    // The struct starts at outerKey
    const slot0 = await provider.getStorageAt(HUB_ADDRESS, outerKey);
    
    if (slot0 !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      console.log(`\nFound at slot ${slot}:`);
      console.log(`  Base key: ${outerKey}`);
      console.log(`  Slot 0 (remoteAddress): ${slot0}`);
      
      // Check if this is WETH_ARBITRUM
      const addr = "0x" + slot0.slice(26, 66);
      if (addr.toLowerCase() === WETH_ARBITRUM.toLowerCase()) {
        console.log("  ✅ This is WETH_ARBITRUM!");
      }
      
      // Read more slots
      for (let i = 1; i <= 4; i++) {
        const nextKey = ethers.BigNumber.from(outerKey).add(i);
        const nextSlot = await provider.getStorageAt(HUB_ADDRESS, nextKey.toHexString());
        console.log(`  Slot ${i}: ${nextSlot}`);
      }
    }
  }

  // Let me also try the Hub Getters directly
  console.log("\n=== Using Hub Getters ===");
  
  const HUB_GETTERS = "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e";
  
  // Try getRemoteTokenInfo(address, uint32)
  const selector = ethers.utils.id("getRemoteTokenInfo(address,uint32)").slice(0, 10);
  const params = ethers.utils.defaultAbiCoder.encode(
    ["address", "uint32"],
    [OLD_SWETH, ARBITRUM_EID]
  );
  
  try {
    const result = await provider.call({
      to: HUB_GETTERS,
      data: selector + params.slice(2)
    });
    
    console.log(`Result length: ${result.length} chars`);
    console.log(`Raw result: ${result}`);
    
    if (result && result.length > 66) {
      // Try to decode - the struct might have different field order
      // Let's decode each 32-byte chunk
      const chunks = [];
      for (let i = 2; i < result.length; i += 64) {
        chunks.push(result.slice(i, i + 64));
      }
      
      console.log("\nDecoded chunks:");
      for (let i = 0; i < chunks.length; i++) {
        console.log(`  Chunk ${i}: 0x${chunks[i]}`);
        
        // Try to interpret
        if (i === 0) {
          const addr = "0x" + chunks[i].slice(24);
          console.log(`    As address: ${addr}`);
        }
        if (i === 1 || i === 2) {
          const num = ethers.BigNumber.from("0x" + chunks[i]);
          console.log(`    As number: ${num.toString()}`);
        }
      }
    }
  } catch (e: any) {
    console.log(`Error: ${e.message?.slice(0, 200)}`);
  }

  // Let's also check if there's a pause state
  console.log("\n=== Checking if token is paused via direct storage ===");
  
  // We know _syntheticAddressByRemoteAddress is at slot 8
  // So _remoteTokens might be at slot 5 or nearby
  
  // Actually, let me check slot by slot for any non-zero values related to sWETH
  for (let slot = 4; slot <= 6; slot++) {
    const key1 = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [OLD_SWETH, slot])
    );
    const key2 = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(["uint32", "bytes32"], [ARBITRUM_EID, key1])
    );
    
    const val = await provider.getStorageAt(HUB_ADDRESS, key2);
    if (val !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      console.log(`Slot ${slot}, sWETH->Arbitrum: ${val}`);
      
      // Also check next few slots in the struct
      for (let j = 1; j <= 3; j++) {
        const nextKey = ethers.BigNumber.from(key2).add(j);
        const nextVal = await provider.getStorageAt(HUB_ADDRESS, nextKey.toHexString());
        if (nextVal !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
          console.log(`  +${j}: ${nextVal}`);
        }
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


