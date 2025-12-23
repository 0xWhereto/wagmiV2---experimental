import { ethers } from "hardhat";

const LEVERAGE_AMM = "0x8CA24d00ffcF60e9ba7F67F9d41ccA28E22dF508";

async function main() {
  const provider = ethers.provider;
  
  console.log("=== Analyzing LeverageAMM Contract ===\n");

  // Get the result of totalUnderlying which seems to return an address
  const tuResult = await provider.call({
    to: LEVERAGE_AMM,
    data: ethers.utils.id("totalUnderlying()").slice(0, 10)
  });
  console.log("totalUnderlying() raw:", tuResult);
  
  // The result looks like an address padded to 32 bytes
  // 0x5e501c482952c1f2d58a4294f9a97759968c5125 = sWETH address!
  console.log("\nThis is actually the sWETH ADDRESS, not a uint256!");
  console.log("The function probably has a different signature in the deployed contract.");

  // Let's try to find the actual function names by testing various selectors
  console.log("\n--- Testing alternative function names ---");
  
  const tests = [
    "underlying()",
    "asset()",
    "token()",
    "baseAsset()",
    "underlyingAsset()",
    "getUnderlying()",
    "getTotalUnderlying()",
    "totalAsset()",
  ];

  for (const fn of tests) {
    try {
      const result = await provider.call({
        to: LEVERAGE_AMM,
        data: ethers.utils.id(fn).slice(0, 10)
      });
      console.log(`✅ ${fn}: ${result.slice(0, 66)}`);
    } catch {
      // silent fail
    }
  }

  // Try decoding the real function signatures from the bytecode
  // The selector 0x7158da7c maps to totalUnderlying() in our source
  // But it returns an address, which suggests either:
  // 1. Different contract was deployed
  // 2. Function has different return type
  
  console.log("\n--- Checking V3LPVault layer structure ---");
  // Try to get layers differently
  const v3 = "0x1139d155D39b2520047178444C51D3D70204650F";
  
  // layers is a mapping, try layers[0]
  // Storage: mapping is at slot X, layers[0] = keccak256(0 . X)
  
  // Let's try to read the NFT position manager positions
  const PM = "0x5826e10B513C891910032F15292B2f1b3041C3Df";
  
  const positionManager = new ethers.Contract(PM, [
    "function balanceOf(address) view returns (uint256)",
    "function tokenOfOwnerByIndex(address, uint256) view returns (uint256)",
    "function positions(uint256) view returns (uint96, address, address, address, uint24, int24, int24, uint128, uint256, uint256, uint128, uint128)"
  ], provider);

  try {
    const nftBalance = await positionManager.balanceOf(v3);
    console.log("V3LPVault owns NFT positions:", nftBalance.toString());
    
    if (nftBalance.gt(0)) {
      for (let i = 0; i < Math.min(5, nftBalance.toNumber()); i++) {
        const tokenId = await positionManager.tokenOfOwnerByIndex(v3, i);
        console.log(`  Position ${i}: tokenId=${tokenId.toString()}`);
        
        const pos = await positionManager.positions(tokenId);
        console.log(`    liquidity: ${pos[7].toString()}`);
        console.log(`    tickLower: ${pos[5]}, tickUpper: ${pos[6]}`);
      }
    }
  } catch (e: any) {
    console.log("Error reading NFT positions:", e.message?.slice(0, 100));
  }
}

main().catch(console.error);
