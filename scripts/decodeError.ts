import { ethers } from "hardhat";

async function main() {
  const errors = [
    'InvalidLayers()', 
    'NoLiquidity()', 
    'NotOperator()', 
    'SlippageExceeded()',
    'StalePrice()',
    'PriceDeviationTooHigh()',
    'OldestObservationTooRecent()',
  ];
  
  console.log("Error selectors:");
  for (const e of errors) {
    const selector = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(e)).slice(0, 10);
    console.log(`  ${e} -> ${selector}`);
  }
  
  console.log("\nLooking for: 0x48c9c98e");
}

main().catch(console.error);

