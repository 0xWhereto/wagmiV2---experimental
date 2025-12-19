import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

const SYNTHETIC_ADDRESSES = {
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  sUSDT: "0x72dFC771E515423E5B0CD2acf703d0F7eb30bdEa",
  sUSDC: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B",
  sBTC: "0x2F0324268031E6413280F3B5ddBc4A97639A284a",
};

async function main() {
  const [deployer] = await ethers.getSigners();

  // Use raw storage reads
  const provider = deployer.provider!;

  console.log("Checking synthetic tokens on Hub...\n");

  // Check tokenIdCounter - slot would depend on contract layout
  // Let's just check code at synthetic token addresses
  for (const [name, addr] of Object.entries(SYNTHETIC_ADDRESSES)) {
    const code = await provider.getCode(addr);
    console.log(`${name} (${addr}):`);
    console.log(`  Has code: ${code.length > 2 ? "YES" : "NO"}`);
    
    if (code.length > 2) {
      // Try to get token info
      const erc20 = new ethers.Contract(addr, [
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
        "function owner() view returns (address)",
      ], provider);
      
      try {
        const [n, s, d] = await Promise.all([
          erc20.name(),
          erc20.symbol(),
          erc20.decimals(),
        ]);
        console.log(`  Name: ${n}, Symbol: ${s}, Decimals: ${d}`);
        
        try {
          const o = await erc20.owner();
          console.log(`  Owner: ${o}`);
        } catch {
          console.log(`  Owner: (not available)`);
        }
      } catch (e: any) {
        console.log(`  Error: ${e.message?.substring(0, 50)}`);
      }
    }
    console.log();
  }

  // Also check if Hub knows about these tokens by calling a view function
  const hubAbi = [
    "function tokenIdCounter() view returns (uint256)",
    "function getSyntheticToken(uint256 _id) view returns (address)",
  ];
  const hub = new ethers.Contract(HUB_ADDRESS, hubAbi, provider);

  try {
    const count = await hub.tokenIdCounter();
    console.log(`\nHub tokenIdCounter: ${count}`);
    
    for (let i = 1; i <= Math.min(Number(count), 10); i++) {
      try {
        const addr = await hub.getSyntheticToken(i);
        console.log(`  Token ${i}: ${addr}`);
      } catch (e) {
        console.log(`  Token ${i}: (error)`);
      }
    }
  } catch (e: any) {
    console.log(`Cannot read tokenIdCounter: ${e.message?.substring(0, 80)}`);
  }
}

main().catch(console.error);
