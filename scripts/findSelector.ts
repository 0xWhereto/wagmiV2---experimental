import { ethers } from "hardhat";

// Get the Hub interface and find the function for 0x8ee9713b
async function main() {
  // Check various possible function signatures
  const possibleFunctions = [
    "withdrawTo(address,uint32,tuple(address,uint256)[],bytes)",
    "withdrawTo(uint32,address,tuple(address,uint256)[],bytes)",
    "withdraw(address,uint32,tuple(address,uint256)[],bytes)",
    "bridgeOut(address,uint32,tuple(address,uint256)[],bytes)",
  ];

  for (const func of possibleFunctions) {
    const selector = ethers.utils.id(func).slice(0, 10);
    console.log(`${func} -> ${selector}`);
  }

  console.log("\nLooking for: 0x8ee9713b");

  // The actual ABI from the Hub
  const hubAbi = [
    "function withdrawTo(address _recipient, uint32 _dstEid, tuple(address tokenAddress, uint256 tokenAmount)[] _assets, bytes _options) external payable",
  ];

  const iface = new ethers.utils.Interface(hubAbi);
  const actualSelector = iface.getSighash("withdrawTo");
  console.log(`withdrawTo(address,uint32,tuple[],bytes) -> ${actualSelector}`);

  // Let's also try with Asset[] explicitly
  const hubAbi2 = [
    "function withdrawTo(address,uint32,(address,uint256)[],bytes)",
  ];
  const iface2 = new ethers.utils.Interface(hubAbi2);
  const selector2 = iface2.getSighash("withdrawTo");
  console.log(`withdrawTo with tuple array -> ${selector2}`);
}

main().catch(console.error);
