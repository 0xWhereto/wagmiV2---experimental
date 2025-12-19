import { ethers } from "hardhat";

async function main() {
  // Get all function selectors from GatewayVault
  const Gateway = await ethers.getContractFactory("GatewayVault");
  const iface = Gateway.interface;
  
  console.log("=== GatewayVault Functions ===\n");
  
  for (const key of Object.keys(iface.functions)) {
    const func = iface.functions[key];
    const selector = iface.getSighash(func);
    console.log(`${selector}: ${key}`);
  }
  
  // Check for our unknown selector
  console.log(`\nLooking for 0x0e4c2f20...`);
  
  try {
    const fragment = iface.getFunction("0x0e4c2f20");
    console.log(`Found: ${fragment.name}`);
  } catch (e) {
    console.log("Not found in ABI");
  }
}

main().catch(console.error);
