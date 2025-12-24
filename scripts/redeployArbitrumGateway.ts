import { ethers } from "hardhat";

// Arbitrum Config
const ARB_LZ_ENDPOINT = "0x1a44076050125825900e736c501f859c50fE728c";
const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const SONIC_EID = 30332;

// Tokens to link
const TOKENS_TO_LINK = [
  { name: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
  { name: "WETH", address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", decimals: 18 },
  { name: "WBTC", address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", decimals: 8 },
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=== Redeploy Arbitrum Gateway ===");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH\n");
  
  // Deploy new GatewayVault with 3 constructor args: endpoint, delegate, dstEid
  console.log("1. Deploying GatewayVault...");
  const GatewayVault = await ethers.getContractFactory("GatewayVault");
  const gateway = await GatewayVault.deploy(
    ARB_LZ_ENDPOINT,  // LayerZero endpoint
    deployer.address, // delegate/owner
    SONIC_EID         // destination EID (Sonic hub)
  );
  await gateway.deployed();
  console.log("   ✓ GatewayVault:", gateway.address);
  
  // Set Hub as peer
  console.log("\n2. Setting Hub as peer...");
  const hubBytes32 = ethers.utils.hexZeroPad(HUB_ADDRESS, 32);
  await (await gateway.setPeer(SONIC_EID, hubBytes32)).wait();
  console.log("   ✓ Hub peer set for Sonic EID", SONIC_EID);
  
  // Link tokens
  console.log("\n3. Linking tokens...");
  for (const token of TOKENS_TO_LINK) {
    try {
      await (await gateway.linkToken(
        token.address,
        0, // tokenType: STANDARD
        token.decimals
      )).wait();
      console.log(`   ✓ Linked ${token.name}: ${token.address}`);
    } catch (e: any) {
      console.log(`   ✗ Failed ${token.name}:`, e.reason || e.message?.slice(0, 80));
    }
  }
  
  console.log("\n" + "=".repeat(50));
  console.log("NEW ARBITRUM GATEWAY:", gateway.address);
  console.log("=".repeat(50));
  
  console.log("\n⚠️  IMPORTANT: Update Hub on Sonic to recognize this new gateway!");
  console.log(`   Hub peer bytes32: ${ethers.utils.hexZeroPad(gateway.address, 32)}`);
  console.log(`   Run on Sonic: hub.setPeer(30110, "<bytes32 above>")`);
}

main().catch(console.error);
