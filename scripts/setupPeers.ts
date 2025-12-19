import hardhat, { ethers } from "hardhat";
import { EndpointId } from "@layerzerolabs/lz-definitions";

/**
 * Setup LayerZero Peers between Hub and Gateway contracts
 * Run this after deploying all contracts
 */

// ============ DEPLOYED ADDRESSES ============
const DEPLOYED_ADDRESSES = {
  // Hub Chain (Sonic)
  sonic: {
    syntheticTokenHub: "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd",
    balancer: "0x3a27f366e09fe76A50DD50D415c770f6caf0F3E6",
    syntheticTokenHubGetters: "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e",
  },
  // Side Chains
  arbitrum: {
    gatewayVault: "0xb867d9E9D374E8b1165bcDF6D3f66d1A9AAd2447",
  },
  base: {
    gatewayVault: "0xb867d9E9D374E8b1165bcDF6D3f66d1A9AAd2447",
  },
  ethereum: {
    gatewayVault: "0xc792AB26B1f1670B2f5081F8d74bD6a451aD6b44",
  },
};

// LayerZero EIDs
const EIDS = {
  sonic: EndpointId.SONIC_V2_MAINNET,     // 30146
  arbitrum: EndpointId.ARBITRUM_V2_MAINNET, // 30110
  base: EndpointId.BASE_V2_MAINNET,       // 30184
  ethereum: EndpointId.ETHEREUM_V2_MAINNET, // 30101
};
// =======================================================

function addressToBytes32(address: string): string {
  return ethers.utils.hexZeroPad(address, 32);
}

async function setupHubPeers() {
  const network = hardhat.network.name;
  if (network !== "sonic") {
    console.log("This function should be run on Sonic network");
    return;
  }

  const [deployer] = await ethers.getSigners();
  console.log(`Setting up Hub peers on ${network}`);
  console.log(`Deployer: ${deployer.address}`);

  const syntheticTokenHub = await ethers.getContractAt(
    "SyntheticTokenHub",
    DEPLOYED_ADDRESSES.sonic.syntheticTokenHub
  );

  // Set peers for each Gateway
  const gateways = [
    { name: "arbitrum", eid: EIDS.arbitrum, address: DEPLOYED_ADDRESSES.arbitrum.gatewayVault },
    { name: "base", eid: EIDS.base, address: DEPLOYED_ADDRESSES.base.gatewayVault },
    { name: "ethereum", eid: EIDS.ethereum, address: DEPLOYED_ADDRESSES.ethereum.gatewayVault },
  ];

  for (const gateway of gateways) {
    if (!gateway.address) {
      console.log(`Skipping ${gateway.name} - no address configured`);
      continue;
    }
    console.log(`Setting peer for ${gateway.name} (EID: ${gateway.eid})...`);
    const tx = await syntheticTokenHub.setPeer(gateway.eid, addressToBytes32(gateway.address));
    await tx.wait();
    console.log(`  ✓ Peer set for ${gateway.name}`);
  }

  console.log("\nHub peers setup complete!");
}

async function setupGatewayPeer() {
  const network = hardhat.network.name as keyof typeof DEPLOYED_ADDRESSES;
  if (network === "sonic") {
    console.log("This function should be run on a side chain network");
    return;
  }

  const [deployer] = await ethers.getSigners();
  console.log(`Setting up Gateway peer on ${network}`);
  console.log(`Deployer: ${deployer.address}`);

  const gatewayAddress = DEPLOYED_ADDRESSES[network]?.gatewayVault;
  if (!gatewayAddress) {
    console.log("No gateway address configured for this network");
    return;
  }

  const gatewayVault = await ethers.getContractAt("GatewayVault", gatewayAddress);

  // Set peer to Hub (Sonic)
  console.log(`Setting peer to Sonic Hub (EID: ${EIDS.sonic})...`);
  const tx = await gatewayVault.setPeer(
    EIDS.sonic,
    addressToBytes32(DEPLOYED_ADDRESSES.sonic.syntheticTokenHub)
  );
  await tx.wait();
  console.log(`  ✓ Peer set to Sonic Hub`);

  console.log("\nGateway peer setup complete!");
}

async function main() {
  const network = hardhat.network.name;

  if (network === "sonic") {
    await setupHubPeers();
  } else {
    await setupGatewayPeer();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

