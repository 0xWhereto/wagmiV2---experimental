import hardhat, { ethers } from "hardhat";

/**
 * Check SyntheticTokenHub configuration on Sonic
 */

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const LZ_ENDPOINT = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B"; // Sonic LZ Endpoint

// Chain EIDs
const ARBITRUM_EID = 30110;
const BASE_EID = 30184;
const ETHEREUM_EID = 30101;

// Gateway addresses
const GATEWAYS = {
  arbitrum: "0xb867d9E9D374E8b1165bcDF6D3f66d1A9AAd2447",
  base: "0xb867d9E9D374E8b1165bcDF6D3f66d1A9AAd2447",
  ethereum: "0xc792AB26B1f1670B2f5081F8d74bD6a451aD6b44",
};

function addressToBytes32(addr: string): string {
  return ethers.utils.hexZeroPad(addr, 32).toLowerCase();
}

async function main() {
  const network = hardhat.network.name;
  if (network !== "sonic") {
    console.log("This script should be run on Sonic network");
    return;
  }

  const [deployer] = await ethers.getSigners();
  console.log(`\n========================================`);
  console.log(`Checking Hub on SONIC`);
  console.log(`========================================`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(await deployer.getBalance())} S`);

  const hub = await ethers.getContractAt("SyntheticTokenHub", HUB_ADDRESS);

  // Check owner
  console.log("\n--- Hub Info ---");
  const owner = await hub.owner();
  console.log(`Owner: ${owner}`);
  console.log(`Is deployer owner: ${owner.toLowerCase() === deployer.address.toLowerCase()}`);

  // Check peers for each chain
  console.log("\n--- Peers Configuration ---");
  
  const chains = [
    { name: "Arbitrum", eid: ARBITRUM_EID, gateway: GATEWAYS.arbitrum },
    { name: "Base", eid: BASE_EID, gateway: GATEWAYS.base },
    { name: "Ethereum", eid: ETHEREUM_EID, gateway: GATEWAYS.ethereum },
  ];

  for (const chain of chains) {
    try {
      const peer = await hub.peers(chain.eid);
      const expectedPeer = addressToBytes32(chain.gateway);
      const isCorrect = peer.toLowerCase() === expectedPeer.toLowerCase();
      
      console.log(`\n${chain.name} (EID: ${chain.eid}):`);
      console.log(`  Current peer: ${peer}`);
      console.log(`  Expected:     ${expectedPeer}`);
      console.log(`  Correct: ${isCorrect ? '✓' : '✗ MISMATCH!'}`);
      
      if (peer === ethers.constants.HashZero) {
        console.log(`  ⚠️ PEER NOT SET!`);
      }
    } catch (e: any) {
      console.log(`\n${chain.name}: Error - ${e.message?.slice(0, 100)}`);
    }
  }

  // Check LayerZero endpoint configuration
  console.log("\n--- LayerZero Endpoint Config ---");
  const endpoint = await ethers.getContractAt(
    [
      "function getSendLibrary(address,uint32) view returns (address)",
      "function getReceiveLibrary(address,uint32) view returns (address)",
      "function delegates(address) view returns (address)",
    ],
    LZ_ENDPOINT
  );

  try {
    const delegate = await endpoint.delegates(HUB_ADDRESS);
    console.log(`Delegate: ${delegate}`);
  } catch (e) {
    console.log("Could not get delegate");
  }

  for (const chain of chains) {
    try {
      const sendLib = await endpoint.getSendLibrary(HUB_ADDRESS, chain.eid);
      const receiveLib = await endpoint.getReceiveLibrary(HUB_ADDRESS, chain.eid);
      console.log(`\n${chain.name}:`);
      console.log(`  Send Library: ${sendLib}`);
      console.log(`  Receive Library: ${receiveLib}`);
    } catch (e: any) {
      console.log(`\n${chain.name}: Could not get libraries - ${e.message?.slice(0, 50)}`);
    }
  }

  // Check remote tokens (registered from gateways)
  console.log("\n--- Remote Tokens ---");
  try {
    // Check if any tokens are registered from Arbitrum
    const remoteTokens = await hub.getRemoteTokensFromEid(ARBITRUM_EID);
    console.log(`Tokens from Arbitrum: ${remoteTokens.length}`);
    for (const token of remoteTokens) {
      console.log(`  - ${token}`);
    }
  } catch (e: any) {
    console.log(`Error getting remote tokens: ${e.message?.slice(0, 100)}`);
  }

  // Check synthetic tokens
  console.log("\n--- Synthetic Tokens ---");
  try {
    const syntheticTokens = await hub.getAllSyntheticTokens();
    console.log(`Total synthetic tokens: ${syntheticTokens.length}`);
    for (const token of syntheticTokens) {
      console.log(`  - ${token}`);
    }
  } catch (e: any) {
    console.log(`Error getting synthetic tokens: ${e.message?.slice(0, 100)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
