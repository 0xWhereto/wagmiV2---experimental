import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const HUB_ENDPOINT = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
const ARBITRUM_EID = 30110;
const SONIC_DVN = "0x282b3386571f7f794450d5789911a9804fa346b4";

async function main() {
  console.log("=== FIXING HUB RECEIVE CONFIG (CORRECT ENDPOINT) ===\n");
  
  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);
  
  const endpointAbi = [
    "function getSendLibrary(address sender, uint32 dstEid) view returns (address)",
    "function getReceiveLibrary(address receiver, uint32 srcEid) view returns (address lib, bool isDefault)",
    "function defaultReceiveLibrary(uint32 srcEid) view returns (address)",
    "function setConfig(address oapp, address lib, tuple(uint32 eid, uint32 configType, bytes config)[] params)",
  ];
  
  const endpoint = new ethers.Contract(HUB_ENDPOINT, endpointAbi, signer);
  
  // Get receive library for Arbitrum
  console.log("Getting receive library...");
  let receiveLib;
  try {
    const [lib, isDefault] = await endpoint.getReceiveLibrary(HUB, ARBITRUM_EID);
    receiveLib = lib;
    console.log(`Receive library: ${lib} (default: ${isDefault})`);
  } catch (e: any) {
    console.log("Error getting receive library:", e.message?.slice(0, 100));
    // Try default
    try {
      receiveLib = await endpoint.defaultReceiveLibrary(ARBITRUM_EID);
      console.log(`Default receive library: ${receiveLib}`);
    } catch (e2: any) {
      console.log("Error getting default:", e2.message?.slice(0, 100));
      return;
    }
  }
  
  // Set ULN config
  console.log("\nSetting receive ULN config...");
  const ulnConfig = ethers.utils.defaultAbiCoder.encode(
    ["tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)"],
    [{
      confirmations: 15,
      requiredDVNCount: 1,
      optionalDVNCount: 0,
      optionalDVNThreshold: 0,
      requiredDVNs: [SONIC_DVN],
      optionalDVNs: [],
    }]
  );
  
  try {
    const tx = await endpoint.setConfig(
      HUB,
      receiveLib,
      [{ eid: ARBITRUM_EID, configType: 2, config: ulnConfig }],
      { gasLimit: 500000 }
    );
    console.log(`TX: ${tx.hash}`);
    await tx.wait();
    console.log("✅ Hub receive config updated!");
  } catch (e: any) {
    console.log(`Error: ${e.reason || e.message?.slice(0, 200)}`);
  }
}

main().catch(console.error);
