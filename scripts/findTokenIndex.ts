import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const SWETH = "0x895d970646bd58C697A2EF855754bd074Ef2018b";

async function main() {
  const provider = ethers.provider;
  
  console.log("=== Searching ALL possible storage slots for _tokenIndexByAddress ===\n");
  console.log(`Hub: ${HUB_ADDRESS}`);
  console.log(`sWETH: ${SWETH}`);
  
  // Try all possible slots from 0 to 50
  for (let mappingSlot = 0; mappingSlot <= 50; mappingSlot++) {
    // For mapping(address => uint256), the key is keccak256(abi.encode(address, slot))
    const key = ethers.utils.solidityKeccak256(
      ["bytes32", "uint256"],
      [ethers.utils.hexZeroPad(SWETH, 32), mappingSlot]
    );
    const value = await provider.getStorageAt(HUB_ADDRESS, key);
    if (value !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      const index = ethers.BigNumber.from(value);
      console.log(`Found at slot ${mappingSlot}: value = ${index.toString()} (raw: ${value})`);
    }
    
    // Also try the other encoding style
    const key2 = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [SWETH, mappingSlot])
    );
    const value2 = await provider.getStorageAt(HUB_ADDRESS, key2);
    if (value2 !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      const index = ethers.BigNumber.from(value2);
      console.log(`Found at slot ${mappingSlot} (style2): value = ${index.toString()}`);
    }
  }

  // Now let's directly check what's at the storage for index values 5, 6, 7, 8
  // if sWETH was created at index 5, 6, 7, or 8
  console.log("\n=== Checking direct storage slots ===");
  for (let slot = 0; slot < 20; slot++) {
    const value = await provider.getStorageAt(HUB_ADDRESS, slot);
    if (value !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      console.log(`Storage[${slot}]: ${value}`);
      
      // Try to decode as address
      const possibleAddr = "0x" + value.slice(26, 66);
      if (possibleAddr.toLowerCase() === SWETH.toLowerCase()) {
        console.log(`  ^ This is sWETH address!`);
      }
      
      // Try to decode as number
      const num = ethers.BigNumber.from(value);
      if (num.gt(0) && num.lt(100)) {
        console.log(`  ^ As number: ${num.toString()}`);
      }
    }
  }

  // Also check _syntheticTokenCount location
  console.log("\n=== Looking for _syntheticTokenCount ===");
  // Storage[6] showed 0x...08 which is 8, the token count
  const count = await provider.getStorageAt(HUB_ADDRESS, 6);
  console.log(`Storage[6] (likely _syntheticTokenCount): ${ethers.BigNumber.from(count).toString()}`);

  // Let me also trace through the createSyntheticToken to see if _tokenIndexByAddress was set
  // By reading transaction logs or event data
  console.log("\n=== Checking creation transaction ===");
  const creationTxHash = "0x7f346e4b6a1d72ccd56ebf3f776bebca8197dd1c5585dfeeb7ee479e63c90c29";
  const receipt = await provider.getTransactionReceipt(creationTxHash);
  console.log(`Creation TX status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
  console.log(`Gas used: ${receipt.gasUsed.toString()}`);
  console.log(`Logs count: ${receipt.logs.length}`);
  
  for (const log of receipt.logs) {
    console.log(`\nLog from ${log.address}:`);
    console.log(`  topics[0]: ${log.topics[0]?.slice(0, 40)}...`);
    if (log.data && log.data !== "0x") {
      console.log(`  data: ${log.data.slice(0, 100)}...`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


