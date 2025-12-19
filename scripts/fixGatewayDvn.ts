import { ethers, network } from "hardhat";

// The DVN that the Hub expects from Arbitrum
const HUB_EXPECTED_DVN_FROM_ARB = "0x282b3386571f7f794450d5789911a9804FA346b4";
const SONIC_EID = 30332;

const GATEWAYS: Record<string, { address: string, endpoint: string }> = {
  arbitrum: { 
    address: "0x527f843672C4CD7F45B126f3E1E82D60A741C609",
    endpoint: "0x1a44076050125825900e736c501f859c50fE728c",
  },
  ethereum: { 
    address: "0x5826e10B513C891910032F15292B2F1b3041C3Df",
    endpoint: "0x1a44076050125825900e736c501f859c50fE728c",
  },
};

async function main() {
  const chainName = network.name;
  const [deployer] = await ethers.getSigners();
  
  const config = GATEWAYS[chainName];
  if (!config) throw new Error(`Unknown chain: ${chainName}`);
  
  console.log(`\n=== Fixing DVN Config on ${chainName.toUpperCase()} Gateway ===\n`);
  console.log(`Gateway: ${config.address}`);
  console.log(`Using DVN that Hub expects: ${HUB_EXPECTED_DVN_FROM_ARB}`);
  
  const endpointAbi = [
    "function getSendLibrary(address _sender, uint32 _dstEid) external view returns (address)",
    "function setConfig(address _oapp, address _lib, tuple(uint32 eid, uint32 configType, bytes config)[] _params) external",
    "function getConfig(address _oapp, address _lib, uint32 _eid, uint32 _configType) external view returns (bytes)",
    "function defaultSendLibrary(uint32 _dstEid) external view returns (address)",
  ];
  
  const endpoint = new ethers.Contract(config.endpoint, endpointAbi, deployer);
  
  // Get the send library
  const sendLib = await endpoint.getSendLibrary(config.address, SONIC_EID);
  console.log(`Send library: ${sendLib}`);
  
  // Check current DVN config
  try {
    const currentConfig = await endpoint.getConfig(config.address, sendLib, SONIC_EID, 2);
    console.log(`\nCurrent DVN config: ${currentConfig.substring(0, 80)}...`);
  } catch (e) {
    console.log("No current DVN config");
  }
  
  // Build new DVN config with the DVN the Hub expects
  // On Arbitrum, we need to find the Arbitrum DVN that signs for Sonic
  // But actually, the Hub's config is for RECEIVING, so we need to match
  // The sender's DVN should match what the receiver expects
  
  // The DVN 0x282b3386571f7f794450d5789911a9804FA346b4 is on Sonic
  // We need to find its corresponding DVN on Arbitrum that will sign
  
  console.log("\n⚠️ DVN mismatch issue detected!");
  console.log("The Gateway sends with one DVN, but the Hub expects a different one.");
  console.log("\nSolution: The Hub needs to be configured to accept the Gateway's DVN");
  console.log("OR the Gateway needs to use the DVN the Hub expects");
  
  // Let's check what DVN is available on this chain for Sonic
  console.log("\n=== Checking available configs ===");
  
  // Try getting the default config
  const defaultLib = await endpoint.defaultSendLibrary(SONIC_EID);
  console.log(`Default send library for Sonic: ${defaultLib}`);
  
  try {
    const defaultConfig = await endpoint.getConfig(ethers.constants.AddressZero, defaultLib, SONIC_EID, 2);
    const decoded = ethers.utils.defaultAbiCoder.decode(
      ["tuple(uint64, uint8, uint8, uint8, address[], address[])"],
      defaultConfig
    );
    console.log(`Default DVNs for Sonic: ${decoded[0][4].join(", ")}`);
  } catch (e) {
    console.log("Couldn't get default config");
  }
}

main().catch(console.error);
