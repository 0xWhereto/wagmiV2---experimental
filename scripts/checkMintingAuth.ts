import { ethers } from "hardhat";

/**
 * Check if Hub can mint synthetic tokens
 */

const CONFIG = {
  hub: "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd",
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  sUSDT: "0x72dFC771E515423E5B0CD2acf703d0F7eb30bdEa",
  sUSDC: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B",
};

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║       CHECKING MINTING AUTHORIZATION                         ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  for (const [name, address] of Object.entries({sWETH: CONFIG.sWETH, sUSDT: CONFIG.sUSDT, sUSDC: CONFIG.sUSDC})) {
    console.log(`\n┌─────────────────────────────────────────────────────────────┐`);
    console.log(`│ ${name.padEnd(58)}│`);
    console.log(`└─────────────────────────────────────────────────────────────┘`);
    
    try {
      const token = await ethers.getContractAt("SyntheticToken", address);
      
      // Check if Hub has minter role
      const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"));
      const hubHasMinterRole = await token.hasRole(MINTER_ROLE, CONFIG.hub);
      console.log(`   Hub has MINTER_ROLE: ${hubHasMinterRole ? '✓ YES' : '✗ NO'}`);
      
      // Check owner/admin
      const DEFAULT_ADMIN_ROLE = ethers.constants.HashZero;
      const adminCount = await token.getRoleMemberCount(DEFAULT_ADMIN_ROLE);
      console.log(`   Admin count: ${adminCount}`);
      
      if (adminCount.toNumber() > 0) {
        const admin = await token.getRoleMember(DEFAULT_ADMIN_ROLE, 0);
        console.log(`   Admin: ${admin}`);
      }
      
      // Check total supply
      const totalSupply = await token.totalSupply();
      console.log(`   Total supply: ${ethers.utils.formatEther(totalSupply)}`);
      
      if (!hubHasMinterRole) {
        console.log(`\n   ⚠️ FIX NEEDED: Grant MINTER_ROLE to Hub!`);
      }
    } catch (e: any) {
      console.log(`   Error: ${e.message?.slice(0, 100)}`);
    }
  }

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                    FIX INSTRUCTIONS                          ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log(`
   If Hub doesn't have MINTER_ROLE on any token, you need to grant it:

   1. Call syntheticToken.grantRole(MINTER_ROLE, hubAddress)
   2. Or use the Hub owner to fix the configuration
   3. Then retry the failed LayerZero messages
  `);
}

main();


