import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const SWETH = "0x895d970646bd58C697A2EF855754bd074Ef2018b";
const WETH_ARBITRUM = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const ARBITRUM_GATEWAY = "0x187ddd9a94236ba6d22376ee2e3c4c834e92f34e";
const ARBITRUM_EID = 30110;

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);
  
  const provider = ethers.provider;

  // Encode the correct call
  const iface = new ethers.utils.Interface([
    "function manualLinkRemoteToken(address _syntheticTokenAddress, uint32 _srcEid, address _remoteTokenAddress, address _gatewayVault, int8 _decimalsDelta, uint256 _minBridgeAmt) external"
  ]);
  
  // Parameters in CORRECT order
  const calldata = iface.encodeFunctionData("manualLinkRemoteToken", [
    SWETH,             // address _syntheticTokenAddress
    ARBITRUM_EID,      // uint32 _srcEid  
    WETH_ARBITRUM,     // address _remoteTokenAddress
    ARBITRUM_GATEWAY,  // address _gatewayVault
    0,                 // int8 _decimalsDelta
    1000               // uint256 _minBridgeAmt
  ]);
  
  console.log("\nCalldata:", calldata);
  console.log("\nDecoded params:");
  console.log("  syntheticTokenAddress:", SWETH);
  console.log("  srcEid:", ARBITRUM_EID);
  console.log("  remoteTokenAddress:", WETH_ARBITRUM);
  console.log("  gatewayVault:", ARBITRUM_GATEWAY);
  console.log("  decimalsDelta:", 0);
  console.log("  minBridgeAmt:", 1000);

  // Try eth_call first
  console.log("\n=== eth_call simulation ===");
  try {
    const result = await provider.call({
      to: HUB_ADDRESS,
      data: calldata,
      from: signer.address
    });
    console.log("✅ Call succeeded:", result);
  } catch (e: any) {
    console.log("❌ Call failed:", e.reason || e.message);
    
    // Get raw error data
    const rawResult = await provider.call({
      to: HUB_ADDRESS,
      data: calldata,
      from: signer.address
    }).catch((err) => err.data);
    
    console.log("Raw error data:", rawResult);
    
    // Try to decode
    if (typeof rawResult === 'string' && rawResult.startsWith("0x08c379a0")) {
      const reason = ethers.utils.defaultAbiCoder.decode(
        ["string"],
        "0x" + rawResult.slice(10)
      );
      console.log("Decoded reason:", reason[0]);
    }
  }

  // Let's check the internal state more carefully
  console.log("\n=== Checking Hub internal state ===");
  
  // Check _tokenIndexByAddress[SWETH]
  // This is private, but we can compute the storage slot
  // Or check via the Hub's syntheticTokens mapping
  
  // The Hub stores tokens in:
  // mapping(address => uint256) private _tokenIndexByAddress
  // SyntheticTokenInfo[] private _syntheticTokens
  
  // Let's get the index of sWETH in the syntheticTokens array
  // We can read the getSyntheticTokenCount and iterate
  
  const hubGetters = await ethers.getContractAt(
    [
      "function getSyntheticTokenCount() view returns (uint256)"
    ],
    "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e"
  );

  const count = await hubGetters.getSyntheticTokenCount();
  console.log(`Hub has ${count} synthetic tokens`);

  // Try different function selectors that might exist on Hub
  console.log("\n=== Checking Hub functions ===");
  
  // Check if there's a function to get token index
  const selectorToCheck = ethers.utils.id("_tokenIndexByAddress(address)").slice(0, 10);
  console.log(`_tokenIndexByAddress selector: ${selectorToCheck}`);
  
  // Actually, let's try to see what the actual bytecode function signatures are
  // by checking what the Hub supports
  
  // Let's try the _syntheticTokenCount storage variable
  // It's at slot position determined by the order of state variables
  
  // For now, let's just try to estimate the gas and see what happens
  console.log("\n=== Gas estimation ===");
  try {
    const gasEstimate = await provider.estimateGas({
      to: HUB_ADDRESS,
      data: calldata,
      from: signer.address
    });
    console.log("✅ Gas estimate:", gasEstimate.toString());
  } catch (e: any) {
    console.log("❌ Gas estimation failed:", e.reason || e.message?.slice(0, 200));
    
    // Let's parse the error more carefully
    if (e.error?.data) {
      console.log("Error data:", e.error.data);
    }
    if (e.transaction) {
      console.log("Transaction params:", {
        to: e.transaction.to,
        from: e.transaction.from,
        data: e.transaction.data?.slice(0, 50) + "..."
      });
    }
  }

  // Let's also check if there's an issue with the token index
  // by reading the _syntheticTokenCount directly from storage
  console.log("\n=== Reading storage ===");
  
  // The _syntheticTokenCount is likely at storage slot 5 or 6
  // Let's try to read it
  for (let slot = 0; slot < 10; slot++) {
    const value = await provider.getStorageAt(HUB_ADDRESS, slot);
    if (value !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      console.log(`Storage[${slot}]: ${value}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


