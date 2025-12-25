import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

// Check which sUSDC address is correct
async function main() {
  const [signer] = await ethers.getSigners();
  
  // Two possible sUSDC addresses
  const addr1 = "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B";
  const addr2 = "0x29219dd400f2Bf60E5a23d13Be72B486D4038894";
  
  const ERC20_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
  ];
  
  console.log("Checking sUSDC addresses...\n");
  
  for (const addr of [addr1, addr2]) {
    try {
      const token = new ethers.Contract(addr, ERC20_ABI, signer);
      const name = await token.name();
      const symbol = await token.symbol();
      const decimals = await token.decimals();
      const balance = await token.balanceOf(signer.address);
      
      console.log(`Address: ${addr}`);
      console.log(`  Name: ${name}`);
      console.log(`  Symbol: ${symbol}`);
      console.log(`  Decimals: ${decimals}`);
      console.log(`  Your balance: ${ethers.utils.formatUnits(balance, decimals)}`);
      console.log();
    } catch (e: any) {
      console.log(`Address: ${addr}`);
      console.log(`  ERROR: ${e.message}`);
      console.log();
    }
  }
}

main().catch(console.error);


