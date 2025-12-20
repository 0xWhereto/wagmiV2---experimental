import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const SONIC_ENDPOINT = "0xe1844c5D63a9543023008D332Bd3d2e6f1FE1043";
const ARBITRUM_EID = 30110;
const RECEIVE_LIB = "0xbe0d3526fc797583dada3f30bc390013062a048b"; // Sonic ULN302

async function main() {
  console.log("=== INVESTIGATING HUB DVN CONFIG ===\n");
  
  const endpointAbi = [
    "function getConfig(address oapp, address lib, uint32 eid, uint32 configType) view returns (bytes)",
  ];
  
  const endpoint = new ethers.Contract(SONIC_ENDPOINT, endpointAbi, ethers.provider);
  
  // ULN config is configType 2
  console.log("Checking Hub receive ULN config for Arbitrum...");
  try {
    const config = await endpoint.getConfig(HUB, RECEIVE_LIB, ARBITRUM_EID, 2);
    console.log("Raw config:", config);
    
    // Decode
    const decoded = ethers.utils.defaultAbiCoder.decode(
      ["tuple(uint64,uint8,uint8,uint8,address[],address[])"],
      config
    );
    console.log("Decoded:");
    console.log("  Confirmations:", decoded[0][0].toString());
    console.log("  Required DVN count:", decoded[0][1]);
    console.log("  Optional DVN count:", decoded[0][2]);
    console.log("  Required DVNs:", decoded[0][4]);
  } catch (e: any) {
    console.log("Error:", e.message?.slice(0, 150));
  }
  
  // What DVN should be:
  console.log("\n--- Expected Configuration ---");
  console.log("Hub receive DVN should be LZ Labs on Sonic: 0x282b3386571f7f794450d5789911a9804fa346b4");
  console.log("This corresponds to LZ Labs on Arbitrum: 0x2f55C492897526677C5B68fb199ea31E2c126416");
}

main().catch(console.error);
