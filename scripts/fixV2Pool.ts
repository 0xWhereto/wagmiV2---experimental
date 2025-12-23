import { ethers } from "hardhat";

const MIM = "0x9dEb5301967DD118D9F37181EB971d1136a72635"; // TestMIM
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const FACTORY = "0x3a1713B6C3734cfC883A3897647f3128Fe789f39";
const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";

// V2 contracts to update
const V3_VAULT = "0x6b922148A19e68c0aC175a8CF2CbF931acC290ca";
const LEVERAGE_AMM = "0x4A5Cb23ad31A81516EcA6f1A4F0C001428335855";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Fix V2 Pool - Create with Correct Price ===\n");
  
  const factory = new ethers.Contract(FACTORY, [
    "function createPool(address,address,uint24) returns (address)",
    "function getPool(address,address,uint24) view returns (address)"
  ], signer);
  
  // Use 0.05% fee tier (500) for better precision
  const fee = 500;
  
  console.log("1. Checking if 0.05% pool exists...");
  let pool = await factory.getPool(SWETH, MIM, fee);
  
  if (pool === ethers.constants.AddressZero) {
    console.log("   Creating new 0.05% fee pool...");
    const tx = await factory.createPool(SWETH, MIM, fee, { gasLimit: 5_000_000 });
    await tx.wait();
    pool = await factory.getPool(SWETH, MIM, fee);
    console.log("   ✓ Pool created:", pool);
    
    // Initialize with CORRECT price
    // For sWETH (token0) / MIM (token1), price = MIM/sWETH = 3000
    // sqrtPriceX96 = sqrt(3000) * 2^96 = 54.77 * 79228162514264337593543950336
    // = 4339505370421188015854575616
    const sqrtPriceX96 = "4339505370421188015854575616";
    
    const poolContract = new ethers.Contract(pool, [
      "function initialize(uint160) external",
      "function token0() view returns (address)",
      "function slot0() view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)"
    ], signer);
    
    const token0 = await poolContract.token0();
    console.log("   token0:", token0);
    console.log("   sWETH is token0:", token0.toLowerCase() === SWETH.toLowerCase());
    
    await (await poolContract.initialize(sqrtPriceX96)).wait();
    
    const slot0 = await poolContract.slot0();
    console.log("   ✓ Initialized at tick:", slot0[1]);
    
  } else {
    console.log("   Pool already exists:", pool);
  }
  
  // Verify price
  const poolContract = new ethers.Contract(pool, [
    "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)",
    "function liquidity() view returns (uint128)"
  ], signer);
  
  const slot0 = await poolContract.slot0();
  const sqrtPrice = parseFloat(slot0.sqrtPriceX96.toString()) / (2 ** 96);
  const price = sqrtPrice * sqrtPrice;
  
  console.log("\n2. Pool state:");
  console.log("   Tick:", slot0.tick);
  console.log("   Price:", price.toFixed(2), "MIM per sWETH");
  console.log("   Liquidity:", (await poolContract.liquidity()).toString());
  
  // Seed with liquidity
  console.log("\n3. Seeding pool with liquidity...");
  
  const mim = new ethers.Contract(MIM, [
    "function approve(address,uint256)",
    "function mint(address,uint256)"
  ], signer);
  const sweth = new ethers.Contract(SWETH, [
    "function approve(address,uint256)",
    "function balanceOf(address) view returns (uint256)"
  ], signer);
  
  // Mint MIM for liquidity
  await (await mim.mint(signer.address, ethers.utils.parseEther("100"))).wait();
  
  // Approve
  await (await sweth.approve(POSITION_MANAGER, ethers.constants.MaxUint256)).wait();
  await (await mim.approve(POSITION_MANAGER, ethers.constants.MaxUint256)).wait();
  
  const positionManager = new ethers.Contract(POSITION_MANAGER, [
    "function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)"
  ], signer);
  
  // Tick spacing for 0.05% is 10
  // Current tick should be ~80067
  const tickLower = 79000;
  const tickUpper = 81000;
  
  const swethAmount = ethers.utils.parseEther("0.0001");
  const mimAmount = ethers.utils.parseEther("0.3");
  
  try {
    const tx = await positionManager.mint({
      token0: SWETH,
      token1: MIM,
      fee: fee,
      tickLower: tickLower,
      tickUpper: tickUpper,
      amount0Desired: swethAmount,
      amount1Desired: mimAmount,
      amount0Min: 0,
      amount1Min: 0,
      recipient: signer.address,
      deadline: Math.floor(Date.now() / 1000) + 600
    }, { gasLimit: 1000000 });
    
    await tx.wait();
    console.log("   ✓ Liquidity added!");
    console.log("   New liquidity:", (await poolContract.liquidity()).toString());
  } catch (e: any) {
    console.log("   ✗ Failed:", e.reason || e.message?.slice(0, 150));
  }
  
  console.log("\n4. New pool address:", pool);
  console.log("   Update V3LPVault and SimpleOracle to use this pool!");
}
main().catch(console.error);
