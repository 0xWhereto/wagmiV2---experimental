import hardhat, { ethers } from "hardhat";
import { IERC20 } from "../typechain-types";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = hardhat.network.name;

  const endpointV2Deployment = await hardhat.deployments.get("EndpointV2");
  const ead = hardhat.network.config.eid;

  console.log(`[${network}] deployer address: ${deployer.address}`);
  console.log(`EndpointV2: ${endpointV2Deployment.address}`);
  if (network === "sonic") {
    const uniswapFactory = "0x56CFC796bC88C9c7e1b38C2b0aF9B7120B079aef";
    const uniswapPositionManager = "0x77DcC9b09C6Ae94CDC726540735682A38e18d690";
    const TestSwapReceiverFactory = await ethers.getContractFactory("TestCrossChainSwapReceiver");
    const testSwapReceiver = await TestSwapReceiverFactory.deploy(
      uniswapFactory,
      uniswapPositionManager,
      endpointV2Deployment.address
    );
    await testSwapReceiver.deployed();
    await sleep(20000);
    console.log(`TestSwapReceiver deployed at: ${testSwapReceiver.address} on EAD: ${ead}`);
    const tokenA = await testSwapReceiver.tokenA();
    const tokenB = await testSwapReceiver.tokenB();
    console.log(`Token A deployed at: ${tokenA}`);
    console.log(`Token B deployed at: ${tokenB}`);
  } else {
    const tokenAsynthetic = "0x1227D8C5Bc62fDdE7FB3c539688E316FA4b665AC"; // TODO: change to the correct token addresses
    const tokenBsynthetic = "0x0c347E8172c52125c8b37876c721b2f545dEFF38"; // TODO: change to the correct token addresses
    const EidSynthetic = 30332; // TODO: change to the correct EID
    const testSwapSenderFactory = await ethers.getContractFactory("TestCrossChainSwapSender");
    const testSwapSender = await testSwapSenderFactory.deploy(
      endpointV2Deployment.address,
      EidSynthetic,
      tokenAsynthetic,
      tokenBsynthetic
    );
    await testSwapSender.deployed();
    await sleep(20000);
    console.log(`TestSwapSender deployed at: ${testSwapSender.address} on EAD: ${ead}`);
    const tokenA = await testSwapSender.tokenA();
    const tokenB = await testSwapSender.tokenB();
    console.log(`Token A deployed at: ${tokenA}`);
    console.log(`Token B deployed at: ${tokenB}`);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

// [sonic] deployer address: 0x972405d0009DdD8906a36109B069E4D7d02E5801
// EndpointV2 deployed at: 0x6F475642a6e85809B1c36Fa62763669b1b48DD5B
// TestSwapReceiver deployed at: 0x1bbcE9Fc68E47Cd3E4B6bC3BE64E271bcDb3edf1 on EAD: 30332
// Token A deployed at: 0x1227D8C5Bc62fDdE7FB3c539688E316FA4b665AC
// Token B deployed at: 0x0c347E8172c52125c8b37876c721b2f545dEFF38

// [base] deployer address: 0x972405d0009DdD8906a36109B069E4D7d02E5801
// EndpointV2: 0x1a44076050125825900e736c501f859c50fE728c
// TestSwapSender deployed at: 0x5AafA963D0D448ba3bE2c5940F1778505AcA9512 on EAD: 30184
// Token A deployed at: 0xa2C0a17Af854031C82d5649cf211D66c5dC3C95a
// Token B deployed at: 0x4596750bb7fDd5e46A65F2913A1b8B15E4BD2aB8

// [arbitrum] deployer address: 0x972405d0009DdD8906a36109B069E4D7d02E5801
// EndpointV2: 0x1a44076050125825900e736c501f859c50fE728c
// TestSwapSender deployed at: 0x0b3095Cd06d649b66f38a7a17f02e8Ba000b7baF on EAD: 30110
// Token A deployed at: 0xb8B6513f59fd537f372B4fccF0590aEA3B38b429
// Token B deployed at: 0x569eC1dd4f669696977265c2DB0e4468A6084064
