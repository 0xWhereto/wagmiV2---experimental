import { ethers } from "hardhat";

// New Arbitrum Gateway
const NEW_GATEWAY = "0x2d603F7B0d06Bd5f6232Afe1991aF3D103d68071";

// Sonic Config
const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const ARB_EID = 30110;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=== Setup New Arbitrum Gateway ===");
  console.log("Deployer:", deployer.address);
  console.log("Gateway:", NEW_GATEWAY);
  console.log();

  const network = await ethers.provider.getNetwork();
  console.log("Current network:", network.name, "chainId:", network.chainId);
  
  // Existing synthetic tokens on Sonic Hub - use getAddress for proper checksum
  const sUSDC = ethers.utils.getAddress("0xa1b52ebc6e37d057e4df26b72ed89b05d60e9bd4");
  const sWETH = ethers.utils.getAddress("0x50c42deacd8fc9773493ed674b675be577f2634b");
  const sWBTC = ethers.utils.getAddress("0xe04496b766afbf58b968dae4c067ce6e9ec65ec5");
  
  // Original tokens on Arbitrum - use getAddress for proper checksum
  const USDC = ethers.utils.getAddress("0xaf88d065e77c8cc2239327c5edb3a432268e5831");
  const WETH = ethers.utils.getAddress("0x82af49447d8a07e3bd95bd0d56f35241523fbab1");
  const WBTC = ethers.utils.getAddress("0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f");
  
  if (network.chainId === 42161) {
    // On Arbitrum - link tokens
    console.log("\n=== Linking tokens on Arbitrum ===");
    console.log("USDC:", USDC, "-> sUSDC:", sUSDC);
    console.log("WETH:", WETH, "-> sWETH:", sWETH);
    console.log("WBTC:", WBTC, "-> sWBTC:", sWBTC);
    
    const gateway = await ethers.getContractAt("GatewayVault", NEW_GATEWAY);
    
    // Prepare token configs
    const tokenConfigs = [
      {
        onPause: false,
        tokenAddress: USDC,
        syntheticTokenDecimals: 6,
        syntheticTokenAddress: sUSDC,
        minBridgeAmt: ethers.utils.parseUnits("1", 6) // 1 USDC
      },
      {
        onPause: false,
        tokenAddress: WETH,
        syntheticTokenDecimals: 18,
        syntheticTokenAddress: sWETH,
        minBridgeAmt: ethers.utils.parseUnits("0.0001", 18) // 0.0001 WETH
      },
      {
        onPause: false,
        tokenAddress: WBTC,
        syntheticTokenDecimals: 8,
        syntheticTokenAddress: sWBTC,
        minBridgeAmt: ethers.utils.parseUnits("0.0001", 8) // 0.0001 WBTC
      }
    ];
    
    // Get LZ quote first
    console.log("\nGetting LZ quote for linkTokenToHub...");
    const options = ethers.utils.solidityPack(
      ['uint16', 'uint8', 'uint16', 'uint8', 'uint128'],
      [3, 1, 17, 1, 500000] // executor lz options with 500k gas
    );
    
    try {
      const quote = await gateway.quoteLinkTokenToHub(tokenConfigs, options);
      console.log("Quote nativeFee:", ethers.utils.formatEther(quote.nativeFee), "ETH");
      
      // Link tokens
      console.log("\nLinking tokens...");
      const tx = await gateway.linkTokenToHub(tokenConfigs, options, {
        value: quote.nativeFee
      });
      console.log("TX:", tx.hash);
      await tx.wait();
      console.log("✓ Tokens linked on gateway!");
    } catch (e: any) {
      console.error("Error:", e.reason || e.message);
    }
    
  } else if (network.chainId === 146) {
    // On Sonic - update hub peer
    console.log("\n=== Updating Hub peer on Sonic ===");
    
    const hub = await ethers.getContractAt("SyntheticTokenHub", HUB_ADDRESS);
    const gatewayBytes32 = ethers.utils.hexZeroPad(NEW_GATEWAY, 32);
    
    console.log("Setting peer for Arbitrum EID", ARB_EID);
    console.log("Gateway bytes32:", gatewayBytes32);
    
    const tx = await hub.setPeer(ARB_EID, gatewayBytes32);
    console.log("TX:", tx.hash);
    await tx.wait();
    console.log("✓ Hub peer updated!");
    
    // Verify
    const peer = await hub.peers(ARB_EID);
    console.log("Verified peer:", peer);
  } else {
    console.log("Unknown network. Run on arbitrum or sonic.");
  }
}

main().catch(console.error);
