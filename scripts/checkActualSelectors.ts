import { ethers } from "hardhat";

const V3LP_VAULT = "0x1139d155D39b2520047178444C51D3D70204650F";
const LEVERAGE_AMM = "0x8CA24d00ffcF60e9ba7F67F9d41ccA28E22dF508";

async function main() {
  const provider = ethers.provider;
  
  console.log("=== Testing Function Selectors ===\n");

  const selectors = [
    { name: "pool()", selector: "0x16f0115b" },
    { name: "token0()", selector: "0x0dfe1681" },
    { name: "token1()", selector: "0xd21220a7" },
    { name: "owner()", selector: "0x8da5cb5b" },
    { name: "positionManager()", selector: "0x791b98bc" },
    { name: "layerCount()", selector: "0x77f5a5d3" },
    { name: "getTotalLiquidity()", selector: "0x6d5433e6" },
    { name: "removeLiquidity(uint256,uint256,uint256)", selector: "0xbeb85eab" },
  ];

  console.log("--- V3LPVault Function Tests ---");
  for (const s of selectors) {
    try {
      const result = await provider.call({
        to: V3LP_VAULT,
        data: s.selector
      });
      console.log(`✅ ${s.name}: ${result.slice(0, 66)}...`);
    } catch (e: any) {
      console.log(`❌ ${s.name}: REVERTS`);
    }
  }

  // Try some other functions that might exist
  console.log("\n--- Alternative Function Tests ---");
  const altSelectors = [
    { name: "getAssets()", selector: ethers.utils.id("getAssets()").slice(0, 10) },
    { name: "totalAssets()", selector: ethers.utils.id("totalAssets()").slice(0, 10) },
    { name: "getPositionAmounts(uint256)", selector: ethers.utils.id("getPositionAmounts(uint256)").slice(0, 10) },
  ];

  for (const s of altSelectors) {
    try {
      const result = await provider.call({
        to: V3LP_VAULT,
        data: s.selector
      });
      console.log(`✅ ${s.name}: ${result.slice(0, 66)}...`);
    } catch (e: any) {
      console.log(`❌ ${s.name}: REVERTS`);
    }
  }

  // Check LeverageAMM
  console.log("\n--- LeverageAMM Function Tests ---");
  const ammSelectors = [
    { name: "mim()", selector: "0x9c1d2bc2" },
    { name: "stakingVault()", selector: "0x5c65816e" },
    { name: "wToken()", selector: "0xa8f4680c" },
    { name: "oracle()", selector: "0x7dc0d1d0" },
    { name: "v3Vault()", selector: "0xc28e1041" },
    { name: "totalDebt()", selector: "0xfc7b9c18" },
    { name: "totalUnderlying()", selector: "0x7158da7c" },
    { name: "closePosition(uint256,uint256)", selector: "0x76a9f5f2" },
  ];

  for (const s of ammSelectors) {
    try {
      const result = await provider.call({
        to: LEVERAGE_AMM,
        data: s.selector
      });
      console.log(`✅ ${s.name}: ${result.slice(0, 66)}...`);
    } catch (e: any) {
      console.log(`❌ ${s.name}: REVERTS`);
    }
  }
}

main().catch(console.error);
