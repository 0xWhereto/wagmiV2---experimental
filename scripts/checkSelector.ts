import { ethers } from "hardhat";

async function main() {
  // Check what function 0x0e4c2f20 is
  const iface = new ethers.utils.Interface([
    "function deposit(address _token, uint256 _amount, bytes _options) external payable",
    "function deposit(address _token, uint256 _amount) external payable",
  ]);
  
  // Get selectors
  console.log("Checking selectors...");
  
  const funcs = [
    "deposit(address,uint256,bytes)",
    "deposit(address,uint256)",
  ];
  
  for (const f of funcs) {
    const sel = ethers.utils.id(f).slice(0, 10);
    console.log(`${f}: ${sel}`);
  }
  
  // The unknown selector
  console.log(`\nUnknown: 0x0e4c2f20`);
  
  // Try to decode the tx data
  const txData = "0x0e4c2f200000000000000000000000004151e05abe56192e2a6775612c2020509fd5063700000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab10000000000000000000000000000000000000000000000000000e35fa931a0000000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000001600030100110100000000000000000000000000061a8000000000000000000000";
  
  console.log("\nTrying to decode...");
  console.log(`Data length: ${txData.length}`);
  
  // This looks like: deposit(recipient, token, amount, options)
  // Let me check the GatewayVault ABI
}

main().catch(console.error);
