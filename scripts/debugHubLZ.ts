import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const SONIC_LZ_ENDPOINT = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
const ARB_EID = 30110;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=== Debug Hub LZ Config ===");
  console.log("Deployer:", deployer.address);
  
  // Check Hub endpoint and delegate
  const hub = await ethers.getContractAt("SyntheticTokenHub", HUB_ADDRESS);
  
  try {
    const endpoint = await hub.endpoint();
    console.log("Hub endpoint:", endpoint);
  } catch (e) {
    console.log("Could not get endpoint");
  }
  
  // Check endpoint
  const endpointABI = [
    "function delegates(address oapp) external view returns (address)",
    "function getSendLibrary(address sender, uint32 eid) external view returns (address lib)",
    "function getReceiveLibrary(address receiver, uint32 eid) external view returns (address lib, bool isDefault)",
    "function defaultSendLibrary(uint32 eid) external view returns (address)",
    "function defaultReceiveLibrary(uint32 eid) external view returns (address)"
  ];
  const endpoint = await ethers.getContractAt(endpointABI, SONIC_LZ_ENDPOINT);
  
  console.log("\n--- Endpoint Info ---");
  
  try {
    const delegate = await endpoint.delegates(HUB_ADDRESS);
    console.log("Hub delegate:", delegate);
    console.log("Is deployer delegate:", delegate.toLowerCase() === deployer.address.toLowerCase());
  } catch (e: any) {
    console.log("Error getting delegate:", e.message?.slice(0, 50));
  }
  
  try {
    const sendLib = await endpoint.getSendLibrary(HUB_ADDRESS, ARB_EID);
    console.log("Hub SendLib for Arbitrum:", sendLib);
  } catch (e: any) {
    console.log("Error getting sendLib:", e.message?.slice(0, 50));
  }
  
  try {
    const [receiveLib, isDefault] = await endpoint.getReceiveLibrary(HUB_ADDRESS, ARB_EID);
    console.log("Hub ReceiveLib for Arbitrum:", receiveLib, "default:", isDefault);
  } catch (e: any) {
    console.log("Error getting receiveLib:", e.message?.slice(0, 50));
  }
  
  try {
    const defaultSend = await endpoint.defaultSendLibrary(ARB_EID);
    console.log("Default SendLib for Arbitrum:", defaultSend);
  } catch (e: any) {
    console.log("Error getting default sendLib:", e.message?.slice(0, 50));
  }
  
  try {
    const defaultReceive = await endpoint.defaultReceiveLibrary(ARB_EID);
    console.log("Default ReceiveLib for Arbitrum:", defaultReceive);
  } catch (e: any) {
    console.log("Error getting default receiveLib:", e.message?.slice(0, 50));
  }
}

main().catch(console.error);
