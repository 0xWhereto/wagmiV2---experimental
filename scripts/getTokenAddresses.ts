import { ethers } from "hardhat";

const GETTERS_ADDRESS = "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e";
const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  // Use storage slot reading approach since getters has issues
  // Storage slot 6 is _syntheticTokenCount, slot 4 is the mapping base
  
  // Try direct storage read via getStorageSlotData
  const hubAbi = [
    "function getStorageSlotData(uint256 slot) view returns (bytes32)",
  ];
  
  const hub = new ethers.Contract(HUB_ADDRESS, hubAbi, deployer);
  
  try {
    // Read _syntheticTokenCount at slot 6
    const countData = await hub.getStorageSlotData(6);
    const count = ethers.BigNumber.from(countData).toNumber();
    console.log(`Synthetic token count: ${count}`);
    
    // For each token, read from _syntheticTokens mapping at slot 4
    // Mapping slot: keccak256(abi.encode(key, slot))
    for (let i = 1; i <= Math.min(count, 15); i++) {
      // Calculate slot for _syntheticTokens[i]
      const slot = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["uint256", "uint256"], [i, 4])
      );
      
      // First field is tokenAddress
      const tokenData = await hub.getStorageSlotData(slot);
      const tokenAddress = "0x" + tokenData.slice(26); // Last 20 bytes
      
      // Second field is tokenSymbol (slot + 1) - stored as short string
      const slotPlus1 = ethers.BigNumber.from(slot).add(1);
      const symbolData = await hub.getStorageSlotData(slotPlus1);
      // Decode short string from bytes32
      let symbol = "";
      const bytes = ethers.utils.arrayify(symbolData);
      for (const b of bytes) {
        if (b === 0) break;
        symbol += String.fromCharCode(b);
      }
      
      console.log(`Token ${i}: ${ethers.utils.getAddress(tokenAddress)} (${symbol})`);
    }
  } catch (e: any) {
    console.log("Error:", e.reason || e.message);
  }
}

main().catch(console.error);
