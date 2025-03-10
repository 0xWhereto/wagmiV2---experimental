import hardhat, { ethers } from "hardhat";
import { IERC20 } from "../typechain-types";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = hardhat.network.name;

  const endpointV2Deployment = await hardhat.deployments.get("EndpointV2");

  console.log(`[${network}] deployer address: ${deployer.address}`);
  console.log(`EndpointV2 deployed at: ${endpointV2Deployment.address}`);

  // This is an external deployment pulled in from @layerzerolabs/lz-evm-sdk-v2
  //
  // @layerzerolabs/toolbox-hardhat takes care of plugging in the external deployments
  // from @layerzerolabs packages based on the configuration in your hardhat config
  //
  // For this to work correctly, your network config must define an eid property
  // set to `EndpointId` as defined in @layerzerolabs/lz-definitions
  //
  // For example:
  //
  // networks: {
  //   fuji: {
  //     ...
  //     eid: EndpointId.AVALANCHE_V2_TESTNET
  //   }
  // }

  // const { address } = await deploy(contractName, {
  //     from: deployer,
  //     args: [
  //         endpointV2Deployment.address, // LayerZero's EndpointV2 address
  //         deployer, // owner
  //     ],
  //     log: true,
  //     skipIfAlreadyDeployed: false,
  // })

  // console.log(`Deployed contract: ${contractName}, network: ${hre.network.name}, address: ${address}`)

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
