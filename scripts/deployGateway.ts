import hardhat, { ethers } from "hardhat";
import { EndpointId } from "@layerzerolabs/lz-definitions";

/**
 * Deploy GatewayVault on Side Chains (Arbitrum, Base, Ethereum)
 */

// LayerZero V2 Endpoint (standard address for Arbitrum, Base, Ethereum)
const LZ_ENDPOINT_V2 = "0x1a44076050125825900e736c501f859c50fE728c";

// Sonic Hub EID
const SONIC_HUB_EID = EndpointId.SONIC_V2_MAINNET; // 30146

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = hardhat.network.name;

  // Get native token symbol based on network
  const nativeSymbol = network === "ethereum" ? "ETH" : network === "arbitrum" ? "ETH" : network === "base" ? "ETH" : "native";

  console.log(`\n========================================`);
  console.log(`Deploying GatewayVault to ${network}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(await deployer.getBalance())} ${nativeSymbol}`);
  console.log(`Hub Chain EID (Sonic): ${SONIC_HUB_EID}`);
  console.log(`LayerZero Endpoint: ${LZ_ENDPOINT_V2}`);
  console.log(`========================================\n`);

  // Deploy GatewayVault
  console.log("Deploying GatewayVault...");
  const GatewayVault = await ethers.getContractFactory("GatewayVault");
  const gatewayVault = await GatewayVault.deploy(
    LZ_ENDPOINT_V2,
    deployer.address,
    SONIC_HUB_EID,
    { gasLimit: 3000000 }
  );
  await gatewayVault.deployed();
  console.log(`GatewayVault deployed to: ${gatewayVault.address}`);

  // Summary
  console.log(`\n========================================`);
  console.log(`GATEWAY DEPLOYMENT COMPLETE`);
  console.log(`========================================`);
  console.log(`Network: ${network}`);
  console.log(`GatewayVault: ${gatewayVault.address}`);
  console.log(`Destination Hub EID: ${SONIC_HUB_EID}`);
  console.log(`========================================\n`);

  return {
    network,
    gatewayVault: gatewayVault.address,
  };
}

main()
  .then((addresses) => {
    console.log("Deployment addresses:", JSON.stringify(addresses, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

