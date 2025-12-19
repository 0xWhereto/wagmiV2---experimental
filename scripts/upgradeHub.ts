import hardhat, { ethers } from "hardhat";

/**
 * Deploy new SyntheticTokenHub with manualLinkRemoteToken function
 * 
 * Steps:
 * 1. Deploy new Hub contract
 * 2. Transfer synthetic tokens ownership to new Hub
 * 3. Set up peers on new Hub
 * 4. Update Gateway peers to point to new Hub
 * 5. Manually link remote tokens
 */

const OLD_HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const OLD_BALANCER_ADDRESS = "0x3a27f366e09fe76A50DD50D415c770f6caf0F3E6";
const LZ_ENDPOINT = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B"; // Sonic LZ Endpoint
const UNISWAP_PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3"; // Permit2 on Sonic
const UNISWAP_ROUTER = "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD"; // Universal Router on Sonic

// Chain EIDs for peers
const CHAIN_EIDS = {
  arbitrum: 30110,
  base: 30184,
  ethereum: 30101,
};

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
  console.log(`Deploying New SyntheticTokenHub on SONIC`);
  console.log(`========================================`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(await deployer.getBalance())} S`);

  // 1. Deploy new Hub
  console.log("\n--- Step 1: Deploying new Hub ---");
  const SyntheticTokenHub = await ethers.getContractFactory("SyntheticTokenHub");
  // Constructor: (_endpoint, _owner, _uniswapUniversalRouter, _uniswapPermitV2, _balancer)
  const newHub = await SyntheticTokenHub.deploy(
    LZ_ENDPOINT,
    deployer.address, // owner
    UNISWAP_ROUTER,
    UNISWAP_PERMIT2,
    OLD_BALANCER_ADDRESS, // reuse existing balancer
    {}
  );
  await newHub.deployed();
  console.log(`New Hub deployed at: ${newHub.address}`);

  // 2. Set up peers on new Hub
  console.log("\n--- Step 2: Setting up peers on new Hub ---");
  for (const [chainName, eid] of Object.entries(CHAIN_EIDS)) {
    const gatewayAddress = GATEWAYS[chainName as keyof typeof GATEWAYS];
    console.log(`Setting peer for ${chainName} (EID: ${eid})...`);
    const tx = await newHub.setPeer(eid, addressToBytes32(gatewayAddress));
    await tx.wait();
    console.log(`  ✓ Peer set`);
  }

  // 3. Deploy new Getters
  console.log("\n--- Step 3: Deploying new Getters ---");
  const HubGetters = await ethers.getContractFactory("SyntheticTokenHubGetters");
  const newGetters = await HubGetters.deploy(newHub.address);
  await newGetters.deployed();
  console.log(`New Getters deployed at: ${newGetters.address}`);

  console.log("\n========================================");
  console.log("DEPLOYMENT COMPLETE!");
  console.log("========================================");
  console.log(`\nNew Hub: ${newHub.address}`);
  console.log(`New Getters: ${newGetters.address}`);
  console.log(`\nNEXT STEPS:`);
  console.log(`1. Create synthetic tokens on new Hub`);
  console.log(`2. Update Gateway peers to point to new Hub`);
  console.log(`3. Manually link remote tokens on new Hub`);
  console.log(`4. Wire LayerZero OApp configuration for new Hub`);
  console.log(`\nUpdate these addresses in:`);
  console.log(`- frontend/lib/contracts/config.ts`);
  console.log(`- layerzero.oapp.config.ts`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

