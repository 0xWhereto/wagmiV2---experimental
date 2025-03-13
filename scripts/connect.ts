import hardhat, { ethers } from "hardhat";
import { IERC20 } from "../typechain-types";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = hardhat.network.name;

  const EID_SONIC = 30332;
  const EID_BASE = 30184;
  const EID_ARBITRUM = 30110;

  console.log(`[${network}] deployer address: ${deployer.address}`);

  if (network === "sonic") {
    const receiverContract = await ethers.getContractAt(
      "TestCrossChainSwapReceiver",
      "0x1bbcE9Fc68E47Cd3E4B6bC3BE64E271bcDb3edf1"
    );
    const senderContractBaseAddressBytes32 = ethers.utils.zeroPad("0x5AafA963D0D448ba3bE2c5940F1778505AcA9512", 32);
    const senderContractArbitrumAddressBytes32 = ethers.utils.zeroPad("0x0b3095Cd06d649b66f38a7a17f02e8Ba000b7baF", 32);
    const tx = await receiverContract.setPeer(EID_BASE, senderContractBaseAddressBytes32);
    await tx.wait();
    console.log(`Set peer for BASE: ${tx.hash}`);
    sleep(10000);
    const tx2 = await receiverContract.setPeer(EID_ARBITRUM, senderContractArbitrumAddressBytes32);
    await tx2.wait();
    console.log(`Set peer for ARBITRUM: ${tx2.hash}`);
  } else {
    let senderAddress = "";
    if (network === "base") {
      senderAddress = "0x5AafA963D0D448ba3bE2c5940F1778505AcA9512";
    } else if (network === "arbitrum") {
      senderAddress = "0x0b3095Cd06d649b66f38a7a17f02e8Ba000b7baF";
    }
    const receiverContractAddressBytes32 = ethers.utils.zeroPad("0x1bbcE9Fc68E47Cd3E4B6bC3BE64E271bcDb3edf1", 32);
    const senderContract = await ethers.getContractAt("TestCrossChainSwapSender", senderAddress);
    const tx = await senderContract.setPeer(EID_SONIC, receiverContractAddressBytes32);
    await tx.wait();
    console.log(`Set peer for SONIC: ${tx.hash}`);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

// [sonic] deployer address: 0x972405d0009DdD8906a36109B069E4D7d02E5801
// Set peer for BASE: 0x2ac0d00c6fd0a0564069e8aa291d165c18bd5b73789d5170452f5559015e505c
// Set peer for ARBITRUM: 0x299ad4bab1378af4813f227a8c846d9469b2a031ffbfcbdff07df7048d136923

// [base] deployer address: 0x972405d0009DdD8906a36109B069E4D7d02E5801
// Set peer for SONIC: 0xe10e0f12d39d79708eb683352319bc6cdf372a2a343668968237b2151543cb61

// [arbitrum] deployer address: 0x972405d0009DdD8906a36109B069E4D7d02E5801
// Set peer for SONIC: 0x1ee4f599707e3fa29e1a89461cc3768d83efa2b398583ff00810c18c5a15f267
