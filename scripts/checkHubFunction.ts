import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

async function main() {
  console.log("=== CHECK HUB FUNCTIONS ===\n");
  
  const provider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");
  const code = await provider.getCode(HUB);
  
  // Check if manualLinkRemoteToken exists
  const sig = "function manualLinkRemoteToken(address,uint32,address,address,int8,uint256)";
  const iface = new ethers.utils.Interface([sig]);
  const selector = iface.getSighash("manualLinkRemoteToken");
  
  console.log(`manualLinkRemoteToken selector: ${selector}`);
  console.log(`In bytecode: ${code.toLowerCase().includes(selector.substring(2).toLowerCase())}`);
  
  // Check function signature
  const funcHash = ethers.utils.id("manualLinkRemoteToken(address,uint32,address,address,int8,uint256)").slice(0, 10);
  console.log(`Function hash: ${funcHash}`);
  console.log(`In code: ${code.toLowerCase().includes(funcHash.slice(2).toLowerCase())}`);
  
  // Let's also check the old function that might exist
  const oldSig = "function linkRemoteToken(address,uint32,address,address,int8,uint256)";
  try {
    const oldIface = new ethers.utils.Interface([oldSig]);
    const oldSelector = oldIface.getSighash("linkRemoteToken");
    console.log(`\nlinkRemoteToken selector: ${oldSelector}`);
    console.log(`In bytecode: ${code.toLowerCase().includes(oldSelector.substring(2).toLowerCase())}`);
  } catch (e) {}
}

main().catch(console.error);
