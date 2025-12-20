import { ethers } from "hardhat";

const GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const ARB_EID = 30110;

async function main() {
  console.log("=== CHECKING WBTC STATUS ===\n");
  
  // Check Hub for WBTC link
  const hubProvider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");
  const hubAbi = [
    "function getRemoteTokenInfo(uint32, address) view returns (address syntheticTokenAddress, uint8 decimals, bool isLinked)",
  ];
  const hub = new ethers.Contract(HUB, hubAbi, hubProvider);
  
  console.log("Checking Hub for WBTC link from Arbitrum...");
  try {
    const info = await hub.getRemoteTokenInfo(ARB_EID, WBTC);
    console.log(`  Synthetic: ${info.syntheticTokenAddress}`);
    console.log(`  Decimals: ${info.decimals}`);
    console.log(`  Is Linked: ${info.isLinked}`);
    
    if (info.isLinked) {
      console.log("\n✅ WBTC is properly linked on Hub!");
    } else {
      console.log("\n❌ WBTC is NOT linked on Hub yet");
    }
  } catch (e: any) {
    console.log(`  Error: ${e.message?.slice(0, 100)}`);
  }
  
  // Now lower the min bridge amount
  console.log("\n=== LOWERING MINIMUM BRIDGE AMOUNT ===");
  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);
  
  const gatewayAbi = [
    "function setMinBridgeAmount(address _tokenAddress, uint256 _minBridgeAmt) external",
    "function availableTokens(uint256) view returns (bool onPause, address tokenAddress, address syntheticTokenAddress, int8 decimalsDelta, uint256 minBridgeAmt)",
    "function getTokenIndex(address) view returns (uint256)",
    "function owner() view returns (address)",
  ];
  
  const gateway = new ethers.Contract(GATEWAY, gatewayAbi, signer);
  
  const owner = await gateway.owner();
  console.log(`Gateway owner: ${owner}`);
  console.log(`Is signer owner: ${owner.toLowerCase() === signer.address.toLowerCase()}`);
  
  // Set min to 1000 sats (0.00001 WBTC ~ $1)
  const newMin = 1000; // 0.00001 WBTC
  console.log(`\nSetting min bridge amount to ${newMin} sats (0.00001 WBTC)...`);
  
  const tx = await gateway.setMinBridgeAmount(WBTC, newMin);
  console.log(`TX: ${tx.hash}`);
  await tx.wait();
  console.log("✅ Min bridge amount updated!");
  
  // Verify
  const index = await gateway.getTokenIndex(WBTC);
  const token = await gateway.availableTokens(index);
  console.log(`\nNew minBridgeAmt: ${token.minBridgeAmt} sats (${ethers.utils.formatUnits(token.minBridgeAmt, 8)} WBTC)`);
}

main().catch(console.error);
