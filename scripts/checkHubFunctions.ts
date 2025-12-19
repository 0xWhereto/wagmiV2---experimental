import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

async function main() {
  const [deployer] = await ethers.getSigners();
  const code = await deployer.provider!.getCode(HUB_ADDRESS);
  
  // Function selectors to check
  const funcs = [
    "function setPeer(uint32,bytes32)",
    "function setGatewayVault(uint32,address)",
    "function linkRemoteToken(address,uint32,address,address,int8,uint256)",
    "function manualLinkRemoteToken(address,uint32,address,address,int8,uint256)",
    "function registerGateway(uint32,address)",
    "function updateGateway(uint32,address)",
    "function setDelegate(address)",
    "function bridgeTokens(address,uint256,uint32,bytes)",
    "function createSyntheticToken(string,uint8)",
    "function setBalancer(address)",
    "function adminRescueFromGateway(uint32,address[],bytes)",
    "function pause()",
    "function unpause()",
  ];

  console.log("Checking which functions exist in deployed Hub:\n");

  for (const sig of funcs) {
    const iface = new ethers.utils.Interface([sig]);
    const selector = iface.getSighash(sig.split(" ")[1].split("(")[0]);
    const exists = code.toLowerCase().includes(selector.substring(2).toLowerCase());
    console.log(`${exists ? "✅" : "❌"} ${sig.split(" ")[1].split("(")[0]}: ${selector} - ${exists ? "EXISTS" : "NOT FOUND"}`);
  }
}

main().catch(console.error);
