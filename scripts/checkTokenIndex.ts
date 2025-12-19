import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const SWETH = "0x895d970646bd58C697A2EF855754bd074Ef2018b";
const WETH_ARBITRUM = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const ARBITRUM_EID = 30110;

async function main() {
  const provider = ethers.provider;
  
  console.log("=== Checking _tokenIndexByAddress for sWETH ===\n");
  
  // We found sWETH in _syntheticTokens at mappingSlot=4, index=5
  // Now we need to check _tokenIndexByAddress
  // Based on the contract source, the storage order is:
  // slot 0: OApp (endpoint, inherited)
  // slot 1: OAppCore (inherited)
  // slot 2: Ownable (owner)
  // ... various OApp slots
  // slot ~4: _syntheticTokens (mapping)
  // slot ~5: _remoteTokens (mapping)  
  // slot ~6: _syntheticTokenCount
  // slot ~7: _tokenIndexByAddress (mapping)
  
  // Let's try to find _tokenIndexByAddress
  // For each possible slot, check if mapping[sWETH] returns 5 (the expected index)
  
  console.log("Searching for _tokenIndexByAddress mapping slot...");
  
  for (let mappingSlot = 5; mappingSlot <= 15; mappingSlot++) {
    const key = ethers.utils.solidityKeccak256(
      ["address", "uint256"],
      [SWETH, mappingSlot]
    );
    const value = await provider.getStorageAt(HUB_ADDRESS, key);
    if (value !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      const index = ethers.BigNumber.from(value);
      console.log(`mappingSlot ${mappingSlot}: index = ${index.toString()}`);
      if (index.eq(5)) {
        console.log(`✅ Found _tokenIndexByAddress at slot ${mappingSlot}!`);
        console.log(`   _tokenIndexByAddress[sWETH] = 5`);
      }
    }
  }

  // Also check _syntheticAddressByRemoteAddress to make sure it's not already linked
  console.log("\n=== Checking _syntheticAddressByRemoteAddress ===");
  console.log("Looking for _syntheticAddressByRemoteAddress[ARBITRUM_EID][WETH_ARBITRUM]...");
  
  // This is a nested mapping: mapping(uint32 => mapping(address => address))
  // Storage: keccak256(address . keccak256(uint32 . slot))
  
  for (let mappingSlot = 6; mappingSlot <= 15; mappingSlot++) {
    // First level: mapping(uint32 => ...)
    const innerKey = ethers.utils.solidityKeccak256(
      ["uint32", "uint256"],
      [ARBITRUM_EID, mappingSlot]
    );
    
    // Second level: mapping(... => address)
    const finalKey = ethers.utils.solidityKeccak256(
      ["address", "bytes32"],
      [WETH_ARBITRUM, innerKey]
    );
    
    const value = await provider.getStorageAt(HUB_ADDRESS, finalKey);
    if (value !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      const addr = "0x" + value.slice(26, 66);
      console.log(`mappingSlot ${mappingSlot}: ${addr}`);
      if (addr.toLowerCase() === SWETH.toLowerCase()) {
        console.log("❌ Already linked! This is why manualLinkRemoteToken fails!");
      }
    }
  }

  // If nothing found, the check should pass
  console.log("\n=== Summary ===");
  console.log("If _tokenIndexByAddress[sWETH] = 5, the first require should pass.");
  console.log("If _syntheticAddressByRemoteAddress[ARBITRUM_EID][WETH_ARBITRUM] = 0, the third require should pass.");
  console.log("The second require (remoteTokenAddress != 0) should obviously pass.\n");

  // Let's also check if maybe the issue is with OApp/Ownable
  console.log("=== Checking ownership ===");
  const hub = await ethers.getContractAt(
    ["function owner() view returns (address)"],
    HUB_ADDRESS
  );
  const [signer] = await ethers.getSigners();
  const owner = await hub.owner();
  console.log(`Hub owner: ${owner}`);
  console.log(`Signer: ${signer.address}`);
  console.log(`Signer is owner: ${owner.toLowerCase() === signer.address.toLowerCase()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

