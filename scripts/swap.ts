import hardhat, { ethers } from "hardhat";
import { Contract } from "ethers";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import { waitForAllMessagesReceived, waitForMessageReceived } from "@layerzerolabs/scan-client";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = hardhat.network.name;
  console.log(`[${network}] sender address: ${deployer.address}`);

  // Network-specific constants
  const EID_SONIC = 30332;
  const EID_BASE = 30184;
  const EID_ARBITRUM = 30110;
  const gasLimit = 700000;
  const chains: { [key: number]: string } = {
    [EID_SONIC]: "Sonic",
    [EID_BASE]: "Base",
    [EID_ARBITRUM]: "Arbitrum",
  };

  // Contract addresses
  const receiverContractAddress = "0x1bbcE9Fc68E47Cd3E4B6bC3BE64E271bcDb3edf1"; // TestCrossChainSwapReceiver в Sonic

  // Synthetic token addresses (from Sonic)
  const tokenAs = "0x1227D8C5Bc62fDdE7FB3c539688E316FA4b665AC";
  const tokenBs = "0x0c347E8172c52125c8b37876c721b2f545dEFF38";

  let senderContractAddress = "";
  let currentEid = 0;
  let destinationEid = 0;

  // Check which network we're on and set appropriate values
  if (network === "base") {
    senderContractAddress = "0x5AafA963D0D448ba3bE2c5940F1778505AcA9512";
    currentEid = EID_BASE;
    destinationEid = EID_ARBITRUM;
    console.log("Executing swap (Base->Sonic->Arbitrum)");
  } else if (network === "arbitrum") {
    senderContractAddress = "0x0b3095Cd06d649b66f38a7a17f02e8Ba000b7baF";
    currentEid = EID_ARBITRUM;
    destinationEid = EID_BASE;
    console.log("Executing swap (Arbitrum->Sonic->Base)");
  } else {
    console.error("This script should be run on network Base or Arbitrum");
    process.exit(1);
  }

  // Get sender contract
  const senderContract = await ethers.getContractAt("TestCrossChainSwapSender", senderContractAddress);

  // Token amount for exchange
  const amountIn = ethers.utils.parseEther("1.0"); // 1 token

  // Get local token from sender contract
  const tokenA = await senderContract.tokenA();
  const mockTokenA = await ethers.getContractAt("MockERC20", tokenA);

  // Check balance before swap
  const balanceBefore = await mockTokenA.balanceOf(deployer.address);
  console.log(`Token balance before swap: ${ethers.utils.formatEther(balanceBefore)}`);

  // If balance is insufficient, mint tokens
  if (balanceBefore.lt(amountIn)) {
    console.log("Insufficient tokens, minting...");
    await senderContract.mint1000(deployer.address);
    await sleep(5000);
    const newBalance = await mockTokenA.balanceOf(deployer.address);
    console.log(`New token balance: ${ethers.utils.formatEther(newBalance)}`);
  }

  // Create options for LayerZero
  const encodedOptions = Options.newOptions().addExecutorLzReceiveOption(gasLimit, 0).toHex();

  // Get fee estimate from receiver contract in Sonic
  console.log("Getting fee estimate from receiver contract in Sonic...");

  // Create provider for Sonic chain
  const sonicProvider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");

  // Get receiver contract on Sonic
  const receiverContract = new ethers.Contract(
    receiverContractAddress,
    [
      "function quote(address _recipient, address _tokenIn, address _tokenOut, uint32 _srcEid, uint32 _dstEid, bytes memory _options) external view returns (uint256)",
    ],
    sonicProvider
  );

  const quoteReceiver = await receiverContract.quote(
    deployer.address,
    tokenAs,
    tokenBs,
    currentEid, // Current chain EID (Base or Arbitrum)
    destinationEid, // Destination chain EID
    encodedOptions
  );

  console.log(`Receiver fee estimate: ${ethers.utils.formatEther(quoteReceiver)} Sonic`);

  // Setup swap parameters
  const swapParams = {
    recipient: deployer.address,
    dstEid: destinationEid,
    gasLimit: gasLimit,
    value: quoteReceiver,
    tokenIn: tokenAs,
    tokenOut: tokenBs,
    amountIn: amountIn,
  };

  // Approve token spending
  console.log("Approving token spending...");
  const tx = await mockTokenA.approve(senderContractAddress, amountIn);
  await tx.wait();
  await sleep(5000);

  // Add more gas to options like in the test
  const finalEncodedOptions = Options.newOptions()
    .addExecutorLzReceiveOption(gasLimit, (BigInt(quoteReceiver) * 110n) / 100n)
    .toHex();

  // Get fee estimate for sending
  console.log("Getting fee estimate for sending...");
  const quote = await senderContract.quote(swapParams, finalEncodedOptions);
  console.log(`Fee estimate: ${ethers.utils.formatEther(quote)} ETH`);

  // Start timing the swap operation
  const startTime = Date.now();

  // Send swap request
  console.log(`Sending swap request ${network}->Sonic->${network === "base" ? "Arbitrum" : "Base"}...`);
  const tx1 = await senderContract.send(swapParams, finalEncodedOptions, {
    value: quote.mul(110).div(100), // Add 10% buffer for fee
    gasLimit: 1000000,
  });

  await tx1.wait();

  // Wait for cross-chain operation to complete
  console.log("Waiting for cross-chain operation to complete (this may take some time)...:");
  const messages = await waitForMessageReceived(currentEid, tx1.hash);
  console.log(
    `status ${network}->${chains[messages.dstChainId as keyof typeof chains]}`,
    messages.status,
    "    https://layerzeroscan.com/tx/" + tx1.hash
  );
  const messages2 = await waitForMessageReceived(EID_SONIC, messages.dstTxHash);
  console.log(
    `status ${network}->${chains[messages2.dstChainId as keyof typeof chains]}`,
    messages2.status,
    "  https://layerzeroscan.com/tx/" + messages2.dstTxHash
  );

  // Calculate elapsed time
  const endTime = Date.now();
  const elapsedSeconds = (endTime - startTime) / 1000;

  console.log(`done in ${elapsedSeconds.toFixed(2)} seconds`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
