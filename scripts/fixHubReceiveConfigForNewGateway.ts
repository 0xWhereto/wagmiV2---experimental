import { ethers } from "hardhat";

/**
 * Configure Hub's receive ULN to accept messages from the new WBTC Gateway.
 * The Gateway sends using LZ Labs DVN on Arbitrum (0x2f55...416).
 * The Hub should expect verification from LZ Labs DVN on Sonic (0x282b...b4).
 */

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const SONIC_ENDPOINT = "0xe1844c5D63a9543023008D332Bd3d2e6f1FE1043";
const ARBITRUM_EID = 30110;
const SONIC_DVN = "0x282b3386571f7f794450d5789911a9804fa346b4"; // LZ Labs on Sonic

async function main() {
  console.log("=== FIXING HUB RECEIVE CONFIG ===\n");
  
  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);
  
  // Get receive library
  const endpointAbi = [
    "function delegates(address) view returns (address)",
    "function setConfig(address oapp, address lib, tuple(uint32 eid, uint32 configType, bytes config)[] params)",
    "function defaultReceiveLibrary(uint32 srcEid) view returns (address)",
  ];
  
  const endpoint = new ethers.Contract(SONIC_ENDPOINT, endpointAbi, signer);
  
  // Get default receive library
  let receiveLib;
  try {
    receiveLib = await endpoint.defaultReceiveLibrary(ARBITRUM_EID);
    console.log(`Default receive library: ${receiveLib}`);
  } catch (e: any) {
    // Fallback to known address
    receiveLib = "0xbe0d3526fc797583dada3f30bc390013062a048b";
    console.log(`Using hardcoded receive library: ${receiveLib}`);
  }
  
  // Configure ULN with LZ Labs DVN
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
  
  const tx = await endpoint.setConfig(
    HUB,
    receiveLib,
    [{ eid: ARBITRUM_EID, configType: 2, config: ulnConfig }]
  );
  console.log(`TX: ${tx.hash}`);
  await tx.wait();
  console.log("✅ Hub receive config updated!");
}

main().catch(console.error);
