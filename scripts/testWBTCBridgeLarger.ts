import { ethers } from "hardhat";

const OLD_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";

async function main() {
  console.log("=== TESTING WBTC MIN BRIDGE AMOUNTS ===\n");
  
  const [signer] = await ethers.getSigners();
  const gateway = await ethers.getContractAt("GatewayVault", OLD_GATEWAY);
  
  const lzOptions = ethers.utils.solidityPack(
    ["uint16", "uint8", "uint16", "uint8", "uint128"],
    [3, 1, 17, 1, 500000]
  );
  
  // Try different amounts
  const amounts = [
    "0.0001",    // 10000 sats
    "0.001",     // 100000 sats  
    "0.01",      // 1000000 sats
    "0.0002",    // 20000 sats
    "0.00035",   // Our balance
  ];
  
  for (const amtStr of amounts) {
    const amount = ethers.utils.parseUnits(amtStr, 8);
    const assets = [{ tokenAddress: WBTC, tokenAmount: amount }];
    
    try {
      await gateway.quoteDeposit(signer.address, assets, lzOptions);
      console.log(`✅ ${amtStr} WBTC: OK`);
    } catch (e: any) {
      if (e.reason?.includes("minimum bridge")) {
        console.log(`❌ ${amtStr} WBTC: below minimum`);
      } else {
        console.log(`❌ ${amtStr} WBTC: ${e.reason || e.message?.slice(0, 50)}`);
      }
    }
  }
}

main().catch(console.error);
