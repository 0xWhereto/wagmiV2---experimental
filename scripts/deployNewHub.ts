import hardhat, { ethers } from "hardhat";
import { EndpointId } from "@layerzerolabs/lz-definitions";

/**
 * Deploy a new SyntheticTokenHub with the manual link function
 */

const LZ_ENDPOINT = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B"; // Sonic
const BALANCER_ADDRESS = "0x3a27f366e09fe76A50DD50D415c770f6caf0F3E6";
const UNISWAP_PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const UNISWAP_ROUTER = "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD"; // Universal Router on Sonic (check this)

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

  // Check if the contract fits
  console.log("\nDeploying SyntheticTokenHub...");
  console.log("Note: Contract is large, this may take a moment...");

  try {
    const SyntheticTokenHub = await ethers.getContractFactory("SyntheticTokenHub");
    const hub = await SyntheticTokenHub.deploy(
      LZ_ENDPOINT,
      deployer.address, // delegate
      UNISWAP_PERMIT2,
      UNISWAP_ROUTER
    );

    await hub.deployed();
    console.log(`\n✓ Hub deployed at: ${hub.address}`);

    // Set balancer
    console.log("\nSetting Balancer...");
    const balancerTx = await hub.setBalancer(BALANCER_ADDRESS);
    await balancerTx.wait();
    console.log(`✓ Balancer set to: ${BALANCER_ADDRESS}`);

    console.log("\n========================================");
    console.log("NEW HUB ADDRESS:", hub.address);
    console.log("========================================");
    console.log("\nNEXT STEPS:");
    console.log("1. Update CHAIN_CONFIG in frontend with new Hub address");
    console.log("2. Run setupPeers.ts on Sonic to set peers for new Hub");
    console.log("3. Run setupPeers.ts on Arbitrum/Base/Ethereum to point to new Hub");
    console.log("4. Create synthetic tokens on new Hub");
    console.log("5. Manually link remote tokens using new manualLinkRemoteToken function");

  } catch (e: any) {
    console.log(`\nDeployment failed: ${e.message}`);
    if (e.message.includes("contract code couldn't be stored")) {
      console.log("\nContract too large for deployment!");
      console.log("Options:");
      console.log("1. Enable optimizer with lower runs");
      console.log("2. Split the contract");
      console.log("3. Remove unused functions");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

