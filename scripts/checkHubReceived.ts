import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

/**
 * Check if bridge messages were received on Sonic Hub
 */

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const SONIC_RPC = "https://rpc.soniclabs.com";

const HUB_ABI = [
  "function owner() view returns (address)",
  "function syntheticTokenCount() view returns (uint256)",
  "function syntheticTokens(uint256) view returns (address)",
  "function peers(uint32) view returns (bytes32)",
];

const SYNTHETIC_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
];

const EIDS = {
  arbitrum: 30110,
  base: 30184,
  ethereum: 30101,
};

// Known synthetic tokens on Sonic Hub
const KNOWN_SYNTHETICS = {
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  sUSDT: "0x72dFC771E515423E5B0CD2acf703d0F7eb30bdEa",
  sUSDC: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B",
};

async function main() {
  console.log("=".repeat(60));
  console.log("CHECK HUB STATUS ON SONIC");
  console.log("=".repeat(60));

  if (!process.env.PRIVATE_KEY) {
    console.log("❌ PRIVATE_KEY not found");
    return;
  }

  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
  console.log(`Wallet: ${wallet.address}\n`);

  const provider = new ethers.providers.JsonRpcProvider(SONIC_RPC);
  
  // Check Hub
  const hub = new ethers.Contract(HUB_ADDRESS, HUB_ABI, provider);

  console.log("--- Hub Contract ---");
  const owner = await hub.owner();
  console.log(`Owner: ${owner}`);
  console.log(`Is you: ${owner.toLowerCase() === wallet.address.toLowerCase() ? "✅ YES" : "❌ NO"}`);

  // Check known synthetic tokens
  console.log("\n--- Your Synthetic Token Balances ---");
  for (const [symbol, address] of Object.entries(KNOWN_SYNTHETICS)) {
    try {
      const token = new ethers.Contract(address, SYNTHETIC_ABI, provider);
      const decimals = await token.decimals();
      const totalSupply = await token.totalSupply();
      const myBalance = await token.balanceOf(wallet.address);

      console.log(`\n${symbol}:`);
      console.log(`  Address: ${address}`);
      console.log(`  Total Supply: ${ethers.utils.formatUnits(totalSupply, decimals)}`);
      console.log(`  Your Balance: ${ethers.utils.formatUnits(myBalance, decimals)}`);
      
      if (myBalance.gt(0)) {
        console.log(`  ✅ You have ${symbol}!`);
      }
    } catch (e: any) {
      console.log(`\n${symbol}: Error - ${e.message?.slice(0, 50)}`);
    }
  }

  // Check gateway peers
  console.log("\n--- Gateway Peers (Hub → Gateways) ---");
  for (const [chain, eid] of Object.entries(EIDS)) {
    const peer = await hub.peers(eid);
    const isSet = peer !== ethers.constants.HashZero;
    console.log(`${chain} (EID ${eid}): ${isSet ? "✅ SET" : "❌ NOT SET"}`);
    if (isSet) {
      console.log(`  Peer: ${peer}`);
    }
  }

  // Check Sonic native balance
  console.log("\n--- Sonic Native Balance ---");
  const sonicBalance = await provider.getBalance(wallet.address);
  console.log(`S balance: ${ethers.utils.formatEther(sonicBalance)} S`);

  // Status summary
  console.log("\n" + "=".repeat(60));
  console.log("BRIDGE STATUS");
  console.log("=".repeat(60));
  console.log("\nBridge transactions were sent from:");
  console.log("  ✅ Arbitrum: 0xd2bd8d921c8d268ed5a0e1166df38dfe364cc93367df3d7c92d9f260b4373a1b");
  console.log("  ✅ Base: 0x6549da9e5813347a11b356d5ee459ad26a8cc89fcd2decd6f1b40169c456a315");
  console.log("  ✅ Ethereum: 0xfad27eab26a04f54be5c11c698f79df6aae691e1703de955e573e98702f0e812");
  console.log("\nTrack LayerZero messages at: https://layerzeroscan.com/");
  console.log("\nTypically takes 1-10 minutes for cross-chain messages to arrive on Sonic.");
  console.log("Once delivered, you'll see sUSDC and sUSDT balances increase on Sonic.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
