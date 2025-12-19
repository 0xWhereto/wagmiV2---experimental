import { ethers } from "hardhat";

async function main() {
  const gateway = await ethers.getContractAt(
    "GatewayVault", 
    "0xB712543E7fB87C411AAbB10c6823cf39bbEBB4Bb"
  );
  
  const WETH = "0x4200000000000000000000000000000000000006";
  const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  
  console.log("=== Base Gateway Status ===");
  console.log("Gateway address:", "0xB712543E7fB87C411AAbB10c6823cf39bbEBB4Bb");
  
  // Check token count
  const tokenCount = await gateway.getAvailableTokenLength();
  console.log("\nTotal linked tokens:", tokenCount.toString());
  
  // Get all linked tokens
  if (tokenCount > 0) {
    console.log("\n=== Linked Tokens ===");
    const allTokens = await gateway.getAllAvailableTokens();
    console.log("Raw token data:", allTokens);
    for (let i = 0; i < allTokens.length; i++) {
      const token = allTokens[i];
      console.log(`Token ${i}:`, token);
    }
  }
  
  // Check if WETH is linked
  console.log("\n=== Check WETH (0x4200...0006) ===");
  try {
    const wethInfo = await gateway.getAllAvailableTokenByAddress(WETH);
    console.log("WETH is linked:", {
      tokenAddress: wethInfo.tokenAddress,
      syntheticAddress: wethInfo.syntheticAddress,
      paused: wethInfo.paused,
      minBridgeAmt: wethInfo.minBridgeAmt.toString(),
    });
  } catch (e: any) {
    console.log("WETH NOT LINKED - Error:", e.message);
  }
  
  // Check if USDC is linked  
  console.log("\n=== Check USDC (0x8335...2913) ===");
  try {
    const usdcInfo = await gateway.getAllAvailableTokenByAddress(USDC);
    console.log("USDC is linked:", {
      tokenAddress: usdcInfo.tokenAddress,
      syntheticAddress: usdcInfo.syntheticAddress,
      paused: usdcInfo.paused,
      minBridgeAmt: usdcInfo.minBridgeAmt.toString(),
    });
  } catch (e: any) {
    console.log("USDC NOT LINKED - Error:", e.message);
  }
  
  // Check peer configuration
  console.log("\n=== Peer Configuration ===");
  const SONIC_EID = 30332;
  const peer = await gateway.peers(SONIC_EID);
  console.log("Peer for Sonic (EID 30332):", peer);
}

main().catch(console.error);

