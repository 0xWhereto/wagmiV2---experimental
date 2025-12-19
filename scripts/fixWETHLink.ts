import { ethers } from "hardhat";

async function main() {
  const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
  const SWETH_ADDRESS = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
  
  const ARBITRUM_EID = 30110;
  const ETHEREUM_EID = 30101;
  
  const WETH_ARBITRUM = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
  const WETH_ETHEREUM = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  
  // Gateway addresses
  const ARBITRUM_GATEWAY = "0x187ddd9a94236ba6d22376ee2e3c4c834e92f34e";
  const ETHEREUM_GATEWAY = "0xba36fc6568b953f691dd20754607590c59b7646a";
  
  const [signer] = await ethers.getSigners();
  console.log(`Using signer: ${signer.address}`);
  
  const hub = await ethers.getContractAt(
    [
      "function owner() view returns (address)",
      "function manualLinkRemoteToken(address _syntheticTokenAddress, address _remoteTokenAddress, uint32 _srcEid, address _gatewayVault, int8 _decimalsDelta, uint256 _minBridgeAmt) external"
    ],
    HUB_ADDRESS,
    signer
  );

  // Verify owner
  const owner = await hub.owner();
  console.log(`Hub owner: ${owner}`);
  console.log(`Signer is owner: ${owner.toLowerCase() === signer.address.toLowerCase()}`);
  
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.log("\n❌ ERROR: You are not the Hub owner. Cannot fix the link.");
    return;
  }

  console.log("\n=== Fixing WETH Link on Arbitrum ===");
  
  try {
    // Parameters for manualLinkRemoteToken
    // function manualLinkRemoteToken(
    //   address _syntheticTokenAddress,   -> sWETH
    //   address _remoteTokenAddress,       -> WETH on Arbitrum
    //   uint32 _srcEid,                    -> Arbitrum EID (30110)
    //   address _gatewayVault,             -> Arbitrum Gateway
    //   int8 _decimalsDelta,               -> 0 (both 18 decimals)
    //   uint256 _minBridgeAmt              -> minimal amount
    // )
    
    console.log("Calling manualLinkRemoteToken...");
    console.log(`  Synthetic Token: ${SWETH_ADDRESS}`);
    console.log(`  Remote Token: ${WETH_ARBITRUM}`);
    console.log(`  Source EID: ${ARBITRUM_EID}`);
    console.log(`  Gateway: ${ARBITRUM_GATEWAY}`);
    console.log(`  Decimals Delta: 0`);
    console.log(`  Min Bridge Amount: 1000000000000 (0.000001 ETH)`);
    
    const tx = await hub.manualLinkRemoteToken(
      SWETH_ADDRESS,
      WETH_ARBITRUM,
      ARBITRUM_EID,
      ARBITRUM_GATEWAY,
      0, // decimalsDelta - both 18 decimals
      ethers.utils.parseUnits("0.000001", 18), // minBridgeAmt - very small
      {
        gasLimit: 500000
      }
    );
    
    console.log(`\nTransaction sent: ${tx.hash}`);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
    
  } catch (e: any) {
    console.log(`\n❌ Error: ${e.message}`);
    
    // Check if it's "Already linked" error
    if (e.message.includes("Already linked")) {
      console.log("\nThe reverse mapping already exists. The issue might be elsewhere.");
    } else if (e.message.includes("Synthetic token not found")) {
      console.log("\nsWETH is not registered as a synthetic token on the Hub!");
    } else {
      console.log("\nFull error:", e);
    }
  }

  // Also try fixing Ethereum WETH
  console.log("\n=== Fixing WETH Link on Ethereum ===");
  
  try {
    console.log("Calling manualLinkRemoteToken for Ethereum...");
    console.log(`  Synthetic Token: ${SWETH_ADDRESS}`);
    console.log(`  Remote Token: ${WETH_ETHEREUM}`);
    console.log(`  Source EID: ${ETHEREUM_EID}`);
    console.log(`  Gateway: ${ETHEREUM_GATEWAY}`);
    
    const tx = await hub.manualLinkRemoteToken(
      SWETH_ADDRESS,
      WETH_ETHEREUM,
      ETHEREUM_EID,
      ETHEREUM_GATEWAY,
      0,
      ethers.utils.parseUnits("0.000001", 18),
      {
        gasLimit: 500000
      }
    );
    
    console.log(`\nTransaction sent: ${tx.hash}`);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
    
  } catch (e: any) {
    console.log(`\n❌ Error: ${e.message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

