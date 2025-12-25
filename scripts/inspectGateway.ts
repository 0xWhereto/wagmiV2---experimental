import { ethers } from "hardhat";

const ARBITRUM_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const WETH_ARBITRUM = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Inspecting Arbitrum Gateway ===\n");
  
  // Try to find the actual function signatures by reading transaction history
  // Let's decode the working transaction

  console.log("=== Decoding Working Transaction ===");
  console.log("TX: 0xbe2b65ec7fbfd450f21d28d80f19914df5bfbcde2844fb90fcc9612b0a3d03cf");
  
  const workingTx = await ethers.provider.getTransaction("0xbe2b65ec7fbfd450f21d28d80f19914df5bfbcde2844fb90fcc9612b0a3d03cf");
  console.log("\nWorking TX Data:");
  console.log(`To: ${workingTx?.to}`);
  console.log(`Value: ${workingTx?.value ? ethers.utils.formatEther(workingTx.value) : "0"} ETH`);
  console.log(`Data (first 10 bytes): ${workingTx?.data?.slice(0, 20)}`);
  console.log(`Data length: ${workingTx?.data?.length}`);
  
  // The function selector is the first 4 bytes (8 hex chars after 0x)
  const workingSelector = workingTx?.data?.slice(0, 10);
  console.log(`Function selector: ${workingSelector}`);
  
  console.log("\n=== Decoding Failing Transaction ===");
  console.log("TX: 0x03182fe1fcac5c73b9368b7ab5d1c00c8501b3783f813f8fca18082edd5cad4b");
  
  const failingTx = await ethers.provider.getTransaction("0x03182fe1fcac5c73b9368b7ab5d1c00c8501b3783f813f8fca18082edd5cad4b");
  console.log("\nFailing TX Data:");
  console.log(`To: ${failingTx?.to}`);
  console.log(`Value: ${failingTx?.value ? ethers.utils.formatEther(failingTx.value) : "0"} ETH`);
  console.log(`Data (first 10 bytes): ${failingTx?.data?.slice(0, 20)}`);
  console.log(`Data length: ${failingTx?.data?.length}`);
  
  const failingSelector = failingTx?.data?.slice(0, 10);
  console.log(`Function selector: ${failingSelector}`);

  console.log("\n=== Comparison ===");
  console.log(`Working selector: ${workingSelector}`);
  console.log(`Failing selector: ${failingSelector}`);
  console.log(`Selectors match: ${workingSelector === failingSelector}`);

  // Decode the full calldata if they're different
  if (workingTx?.data && failingTx?.data) {
    console.log("\n=== Full Calldata Comparison ===");
    console.log(`Working data length: ${workingTx.data.length} chars`);
    console.log(`Failing data length: ${failingTx.data.length} chars`);
    
    // Compare byte by byte for first 500 chars
    let firstDiff = -1;
    const minLen = Math.min(workingTx.data.length, failingTx.data.length);
    for (let i = 0; i < minLen; i++) {
      if (workingTx.data[i] !== failingTx.data[i]) {
        firstDiff = i;
        break;
      }
    }
    
    if (firstDiff > 0) {
      console.log(`First difference at position: ${firstDiff}`);
      console.log(`Working around diff: ...${workingTx.data.slice(firstDiff - 10, firstDiff + 20)}...`);
      console.log(`Failing around diff: ...${failingTx.data.slice(firstDiff - 10, firstDiff + 20)}...`);
    } else if (firstDiff === -1 && workingTx.data.length !== failingTx.data.length) {
      console.log("Data prefixes match but lengths differ");
    } else {
      console.log("Data is identical up to compared length");
    }
    
    // Show a bit more of each
    console.log("\n=== Working TX Data (first 200 chars) ===");
    console.log(workingTx.data.slice(0, 200));
    
    console.log("\n=== Failing TX Data (first 200 chars) ===");
    console.log(failingTx.data.slice(0, 200));
  }

  // Try to manually read token at index 0 using raw storage
  console.log("\n=== Reading availableTokens(0) directly ===");
  const gateway = await ethers.getContractAt(
    [
      "function availableTokens(uint256) view returns (tuple(address tokenAddress, address syntheticTokenAddress, int8 decimalsDelta, uint256 minBridgeAmt, bool onPause))"
    ],
    ARBITRUM_GATEWAY,
    signer
  );
  
  try {
    for (let i = 0; i < 5; i++) {
      const tokenInfo = await gateway.availableTokens(i);
      console.log(`\nToken ${i}:`);
      console.log(`  tokenAddress: ${tokenInfo.tokenAddress}`);
      console.log(`  syntheticTokenAddress: ${tokenInfo.syntheticTokenAddress}`);
      console.log(`  decimalsDelta: ${tokenInfo.decimalsDelta}`);
      console.log(`  minBridgeAmt: ${tokenInfo.minBridgeAmt.toString()}`);
      console.log(`  onPause: ${tokenInfo.onPause}`);
    }
  } catch (e: any) {
    console.log(`Error: ${e.reason || e.message?.slice(0, 100)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


