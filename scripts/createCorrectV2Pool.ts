import { ethers } from "hardhat";

const MIM = "0x9dEb5301967DD118D9F37181EB971d1136a72635"; // TestMIM
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const FACTORY = "0x3a1713B6C3734cfC883A3897647f3128Fe789f39";
const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Create Correct V2 Pool ===\n");
  
  const factory = new ethers.Contract(FACTORY, [
    "function createPool(address,address,uint24) returns (address)",
    "function getPool(address,address,uint24) view returns (address)"
  ], signer);
  
  // Use 0.01% fee tier (100) - hasn't been used yet
  const fee = 100;
  
  console.log("1. Creating 0.01% fee pool with TestMIM...");
  let pool = await factory.getPool(SWETH, MIM, fee);
  
  if (pool === ethers.constants.AddressZero) {
    const tx = await factory.createPool(SWETH, MIM, fee, { gasLimit: 5_000_000 });
    await tx.wait();
    pool = await factory.getPool(SWETH, MIM, fee);
    console.log("   ✓ Pool created:", pool);
  } else {
    console.log("   Pool exists:", pool);
  }
  
  const poolContract = new ethers.Contract(pool, [
    "function initialize(uint160) external",
    "function token0() view returns (address)",
    "function slot0() view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)"
  ], signer);
  
  const token0 = await poolContract.token0();
  console.log("   token0:", token0);
  const swethIsToken0 = token0.toLowerCase() === SWETH.toLowerCase();
  console.log("   sWETH is token0:", swethIsToken0);
  
  // CORRECT sqrtPriceX96 for price = 3000 MIM per sWETH
  // sqrtPriceX96 = sqrt(3000) * 2^96 = 4339505179874779672736325173248
  const sqrtPriceX96 = "4339505179874779672736325173248";
  
  console.log("\n2. Initializing with sqrtPriceX96:", sqrtPriceX96);
  
  try {
    await (await poolContract.initialize(sqrtPriceX96)).wait();
    console.log("   ✓ Initialized!");
  } catch (e: any) {
    console.log("   Already initialized or failed:", e.reason || e.message?.slice(0, 80));
  }
  
  const slot0 = await poolContract.slot0();
  console.log("   Tick:", slot0[1]);
  
  // Calculate actual price
  const sqrtPriceNum = parseFloat(slot0[0].toString()) / (2 ** 96);
  const actualPrice = sqrtPriceNum * sqrtPriceNum;
  console.log("   Actual price:", actualPrice.toFixed(2), "MIM per sWETH");
  
  if (Math.abs(actualPrice - 3000) < 100) {
    console.log("   ✓ Price is correct!");
  } else {
    console.log("   ⚠️ Price is still wrong!");
  }
  
  // Seed with liquidity
  console.log("\n3. Seeding pool...");
  
  const mim = new ethers.Contract(MIM, [
    "function approve(address,uint256)",
    "function mint(address,uint256)"
  ], signer);
  const sweth = new ethers.Contract(SWETH, [
    "function approve(address,uint256)",
    "function balanceOf(address) view returns (uint256)"
  ], signer);
  
  await (await mim.mint(signer.address, ethers.utils.parseEther("100"))).wait();
  await (await sweth.approve(POSITION_MANAGER, ethers.constants.MaxUint256)).wait();
  await (await mim.approve(POSITION_MANAGER, ethers.constants.MaxUint256)).wait();
  
  const positionManager = new ethers.Contract(POSITION_MANAGER, [
    "function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)"
  ], signer);
  
  // Tick spacing for 0.01% is 1, so use multiples of 1
  // Current tick should be ~80067
  const tickLower = 79000;
  const tickUpper = 81000;
  
  try {
    const tx = await positionManager.mint({
      token0: SWETH,
      token1: MIM,
      fee: fee,
      tickLower: tickLower,
      tickUpper: tickUpper,
      amount0Desired: ethers.utils.parseEther("0.0001"),
      amount1Desired: ethers.utils.parseEther("0.3"),
      amount0Min: 0,
      amount1Min: 0,
      recipient: signer.address,
      deadline: Math.floor(Date.now() / 1000) + 600
    }, { gasLimit: 1000000 });
    
    await tx.wait();
    console.log("   ✓ Liquidity added!");
  } catch (e: any) {
    console.log("   ✗ Failed:", e.reason || e.message?.slice(0, 100));
  }
  
  console.log("\n=== New Correct Pool ===");
  console.log("Address:", pool);
  console.log("Fee tier: 0.01%");
  console.log("\nNeed to redeploy V3LPVault and SimpleOracle with this pool!");
}
main().catch(console.error);
