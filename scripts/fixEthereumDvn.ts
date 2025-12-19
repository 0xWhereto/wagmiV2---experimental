import { ethers, network } from "hardhat";

// For Ethereum gateway, we need to match the OLD gateway's DVN
// Let me first check what the OLD Ethereum gateway uses

const OLD_ETH_GATEWAY = "0xba36FC6568B953f691dd20754607590C59b7646a";
const NEW_ETH_GATEWAY = "0x5826e10B513C891910032F15292B2F1b3041C3Df";
const ENDPOINT = "0x1a44076050125825900e736c501f859c50fE728c";
const SONIC_EID = 30332;

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://ethereum-rpc.publicnode.com");
  
  const endpointAbi = [
    "function getSendLibrary(address, uint32) view returns (address)",
    "function getConfig(address, address, uint32, uint32) view returns (bytes)",
  ];
  
  const endpoint = new ethers.Contract(ENDPOINT, endpointAbi, provider);
  
  console.log("=== Checking Ethereum Gateways DVN ===\n");
  
  // OLD gateway
  const oldSendLib = await endpoint.getSendLibrary(OLD_ETH_GATEWAY, SONIC_EID);
  const oldDvnConfig = await endpoint.getConfig(OLD_ETH_GATEWAY, oldSendLib, SONIC_EID, 2);
  const oldDecoded = ethers.utils.defaultAbiCoder.decode(
    ["tuple(uint64, uint8, uint8, uint8, address[], address[])"],
    oldDvnConfig
  );
  console.log(`OLD Gateway DVN: ${oldDecoded[0][4].join(", ")}`);
  
  // NEW gateway
  const newSendLib = await endpoint.getSendLibrary(NEW_ETH_GATEWAY, SONIC_EID);
  const newDvnConfig = await endpoint.getConfig(NEW_ETH_GATEWAY, newSendLib, SONIC_EID, 2);
  const newDecoded = ethers.utils.defaultAbiCoder.decode(
    ["tuple(uint64, uint8, uint8, uint8, address[], address[])"],
    newDvnConfig
  );
  console.log(`NEW Gateway DVN: ${newDecoded[0][4].join(", ")}`);
  
  // They should match
  const oldDvns = oldDecoded[0][4].map((d: string) => d.toLowerCase()).sort();
  const newDvns = newDecoded[0][4].map((d: string) => d.toLowerCase()).sort();
  
  if (JSON.stringify(oldDvns) === JSON.stringify(newDvns)) {
    console.log("\n✅ DVNs match!");
  } else {
    console.log("\n⚠️ DVNs don't match - need to fix");
  }
}

main().catch(console.error);
