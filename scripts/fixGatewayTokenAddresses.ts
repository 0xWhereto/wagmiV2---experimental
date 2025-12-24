import { ethers } from "hardhat";

const NEW_GATEWAY = "0x2d603F7B0d06Bd5f6232Afe1991aF3D103d68071";

// Correct synthetic token addresses from Hub
const CORRECT_SYNTHETIC = {
  sUSDC: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B",
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  sWBTC: "0x2F0324268031E6413280F3B5ddBc4A97639A284a"
};

// Original tokens on Arbitrum
const ORIGINAL = {
  USDC: ethers.utils.getAddress("0xaf88d065e77c8cc2239327c5edb3a432268e5831"),
  WETH: ethers.utils.getAddress("0x82af49447d8a07e3bd95bd0d56f35241523fbab1"),
  WBTC: ethers.utils.getAddress("0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f")
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=== Fix Gateway Token Addresses ===");
  console.log("Owner:", deployer.address);
  
  const gateway = await ethers.getContractAt("GatewayVault", NEW_GATEWAY);
  
  const updates = [
    { name: "USDC", original: ORIGINAL.USDC, synth: CORRECT_SYNTHETIC.sUSDC, decimals: 6 },
    { name: "WETH", original: ORIGINAL.WETH, synth: CORRECT_SYNTHETIC.sWETH, decimals: 18 },
    { name: "WBTC", original: ORIGINAL.WBTC, synth: CORRECT_SYNTHETIC.sWBTC, decimals: 8 },
  ];
  
  for (const update of updates) {
    console.log(`\nUpdating ${update.name}...`);
    console.log(`  Original: ${update.original}`);
    console.log(`  New synthetic: ${update.synth}`);
    
    try {
      const tx = await gateway.updateSyntheticTokenAddress(
        update.original,
        update.synth,
        update.decimals
      );
      console.log("  TX:", tx.hash);
      await tx.wait();
      console.log(`  ✓ Updated!`);
    } catch (e: any) {
      console.log(`  ✗ Error:`, e.reason || e.message?.slice(0, 80));
    }
  }
  
  console.log("\n✓ All tokens updated!");
}

main().catch(console.error);
