import { ethers } from "hardhat";

const NEW_GATEWAY = "0x2d603F7B0d06Bd5f6232Afe1991aF3D103d68071";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=== Link Tokens to New Gateway ===");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH");
  
  // Addresses with proper checksums
  const sUSDC = ethers.utils.getAddress("0xa1b52ebc6e37d057e4df26b72ed89b05d60e9bd4");
  const sWETH = ethers.utils.getAddress("0x50c42deacd8fc9773493ed674b675be577f2634b");
  const sWBTC = ethers.utils.getAddress("0xe04496b766afbf58b968dae4c067ce6e9ec65ec5");
  const USDC = ethers.utils.getAddress("0xaf88d065e77c8cc2239327c5edb3a432268e5831");
  const WETH = ethers.utils.getAddress("0x82af49447d8a07e3bd95bd0d56f35241523fbab1");
  const WBTC = ethers.utils.getAddress("0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f");
  
  const gateway = await ethers.getContractAt("GatewayVault", NEW_GATEWAY);
  
  // Token configs with explicit string values for amounts
  const tokenConfigs = [
    {
      onPause: false,
      tokenAddress: USDC,
      syntheticTokenDecimals: 6,
      syntheticTokenAddress: sUSDC,
      minBridgeAmt: "1000000" // 1 USDC (6 decimals)
    },
    {
      onPause: false,
      tokenAddress: WETH,
      syntheticTokenDecimals: 18,
      syntheticTokenAddress: sWETH,
      minBridgeAmt: "100000000000000" // 0.0001 WETH (18 decimals)
    },
    {
      onPause: false,
      tokenAddress: WBTC,
      syntheticTokenDecimals: 8,
      syntheticTokenAddress: sWBTC,
      minBridgeAmt: "10000" // 0.0001 WBTC (8 decimals)
    }
  ];
  
  // LZ options
  const options = ethers.utils.solidityPack(
    ['uint16', 'uint8', 'uint16', 'uint8', 'uint128'],
    [3, 1, 17, 1, 500000]
  );
  
  console.log("\nGetting quote...");
  try {
    const quote = await gateway.quoteLinkTokenToHub(tokenConfigs, options);
    console.log("Quote nativeFee:", ethers.utils.formatEther(quote), "ETH");
    
    console.log("\nLinking tokens...");
    const tx = await gateway.linkTokenToHub(tokenConfigs, options, { value: quote });
    console.log("TX:", tx.hash);
    await tx.wait();
    console.log("✓ Tokens linked!");
    
    // Verify
    const tokens = await gateway.getAllAvailableTokens();
    console.log("\nLinked tokens:", tokens.length);
    for (const t of tokens) {
      console.log("-", t.tokenAddress);
    }
  } catch (e: any) {
    console.error("Error:", e.reason || e.message);
    if (e.data) console.error("Data:", e.data);
  }
}

main().catch(console.error);
