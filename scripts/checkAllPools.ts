import { ethers } from "hardhat";

// All known sWETH/MIM pools
const POOLS = [
  { name: "V2 Pool (0.3%)", address: "0x863EaD6f618456AdeBE876Abce952D4240500e62" },
  { name: "Old Pool 0.05%", address: "0x4ed3B3e2AD7e19124D921fE2F6956e1C62Cbf190" },
  { name: "Old Pool 0.3%", address: "0x81b772522DcD6705C5a97ec37F38F9ef213bA8C6" },
  { name: "Old Pool 0.01%", address: "0xFBfb4e7DE02EFfd36c9A307340a6a0AdCd01663B" },
];

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Check All sWETH/MIM Pools ===\n");
  
  for (const pool of POOLS) {
    console.log(`\n${pool.name}: ${pool.address}`);
    
    try {
      const contract = new ethers.Contract(pool.address, [
        "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)",
        "function liquidity() view returns (uint128)",
        "function token0() view returns (address)",
        "function token1() view returns (address)"
      ], signer);
      
      const slot0 = await contract.slot0();
      const liquidity = await contract.liquidity();
      const token0 = await contract.token0();
      const token1 = await contract.token1();
      
      const swethIsToken0 = token0.toLowerCase() === SWETH.toLowerCase();
      
      // Calculate price from sqrtPriceX96
      // price = (sqrtPriceX96 / 2^96)^2
      const sqrtPrice = slot0.sqrtPriceX96.toString();
      const sqrtPriceNum = parseFloat(sqrtPrice) / (2 ** 96);
      const price = sqrtPriceNum * sqrtPriceNum;
      
      // If sWETH is token0, price is MIM/sWETH, else sWETH/MIM
      const mimPerSweth = swethIsToken0 ? price : 1/price;
      const swethPerMim = swethIsToken0 ? 1/price : price;
      
      console.log(`  token0: ${token0} ${swethIsToken0 ? '(sWETH)' : '(MIM)'}`);
      console.log(`  token1: ${token1} ${swethIsToken0 ? '(MIM)' : '(sWETH)'}`);
      console.log(`  tick: ${slot0.tick}`);
      console.log(`  liquidity: ${liquidity.toString()}`);
      console.log(`  Price: ${mimPerSweth.toFixed(2)} MIM per sWETH`);
      console.log(`  Price: ${swethPerMim.toFixed(8)} sWETH per MIM`);
      
      if (mimPerSweth < 100 || mimPerSweth > 10000) {
        console.log(`  ⚠️  PRICE LOOKS WRONG! Expected ~3000 MIM per sWETH`);
      }
      
    } catch (e: any) {
      console.log(`  Error: ${e.message?.slice(0, 80)}`);
    }
  }
}
main().catch(console.error);
