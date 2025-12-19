import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const SBTC_ADDRESS = "0x1DeFDa524B2B5edB94299775B23d7E3dde1Fbb6C";
const WBTC_ARBITRUM = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
const ARBITRUM_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const ARBITRUM_EID = 30110;

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Retrying WBTC Link ===\n");
  console.log(`Signer: ${signer.address}`);
  
  // First let's encode the call manually to see exactly what we're sending
  const iface = new ethers.utils.Interface([
    "function manualLinkRemoteToken(address _syntheticTokenAddress, uint32 _srcEid, address _remoteTokenAddress, address _gatewayVault, int8 _decimalsDelta, uint256 _minBridgeAmt) external"
  ]);

  const decimalsDelta = 0; // WBTC 8 decimals, sBTC 8 decimals
  const minBridgeAmt = ethers.utils.parseUnits("0.00001", 8); // 1000 satoshis

  const calldata = iface.encodeFunctionData("manualLinkRemoteToken", [
    SBTC_ADDRESS,
    ARBITRUM_EID,
    WBTC_ARBITRUM,
    ARBITRUM_GATEWAY,
    decimalsDelta,
    minBridgeAmt
  ]);

  console.log("\n=== Call Parameters ===");
  console.log(`sBTC: ${SBTC_ADDRESS}`);
  console.log(`srcEid: ${ARBITRUM_EID}`);
  console.log(`WBTC: ${WBTC_ARBITRUM}`);
  console.log(`Gateway: ${ARBITRUM_GATEWAY}`);
  console.log(`decimalsDelta: ${decimalsDelta}`);
  console.log(`minBridgeAmt: ${minBridgeAmt.toString()} (${ethers.utils.formatUnits(minBridgeAmt, 8)} BTC)`);
  console.log(`\nCalldata: ${calldata}`);
  console.log(`Calldata length: ${(calldata.length - 2) / 2} bytes`);

  // Try eth_call first
  console.log("\n=== Trying eth_call ===");
  try {
    const result = await ethers.provider.call({
      to: HUB_ADDRESS,
      from: signer.address,
      data: calldata,
      gasLimit: 2000000
    });
    console.log(`Result: ${result}`);
    console.log("✅ eth_call succeeded!");
  } catch (e: any) {
    console.log(`❌ eth_call failed`);
    console.log(`Reason: ${e.reason}`);
    console.log(`Message: ${e.message?.slice(0, 200)}`);
    
    // Try to decode the error data
    if (e.data) {
      console.log(`Error data: ${e.data}`);
    }
  }

  // Try sending actual transaction with high gas
  console.log("\n=== Sending Transaction ===");
  try {
    const tx = await signer.sendTransaction({
      to: HUB_ADDRESS,
      data: calldata,
      gasLimit: 2000000
    });
    console.log(`TX hash: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`Status: ${receipt.status === 1 ? "SUCCESS" : "FAILED"}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);
    
    if (receipt.status === 1) {
      console.log("\n✅ WBTC from Arbitrum successfully linked to sBTC!");
    }
  } catch (e: any) {
    console.log(`❌ Transaction failed`);
    console.log(`Reason: ${e.reason || e.message?.slice(0, 200)}`);
    
    // Check if tx was mined but failed
    if (e.receipt) {
      console.log(`TX was mined in block ${e.receipt.blockNumber} but reverted`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

