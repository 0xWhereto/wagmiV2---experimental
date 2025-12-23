import { ethers } from "hardhat";

const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";
const MIM = "0x1590da8C11431eFe1cB42Acfd8A500A5bdb7B1A2";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)"
];

const PM_ABI = [
  "function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)"
];

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Testing in-range position on 0.05% pool");
  
  // Current tick is -80201
  // For in-range: tickLower < -80201 < tickUpper
  const tickLower = -82000;  // Below current
  const tickUpper = -78000;  // Above current
  
  console.log("Tick range:", tickLower, "to", tickUpper);
  console.log("Current tick -80201 is in range?", tickLower < -80201 && -80201 < tickUpper);
  
  // Small amounts
  const amount0 = ethers.utils.parseUnits("1", 18); // 1 MIM
  const amount1 = ethers.utils.parseEther("0.001"); // 0.001 sWETH
  
  const sweth = new ethers.Contract(SWETH, ERC20_ABI, signer);
  const mim = new ethers.Contract(MIM, ERC20_ABI, signer);
  
  console.log("\nApproving...");
  await (await mim.approve(POSITION_MANAGER, amount0)).wait();
  await (await sweth.approve(POSITION_MANAGER, amount1)).wait();
  
  const pm = new ethers.Contract(POSITION_MANAGER, PM_ABI, signer);
  
  console.log("Minting...");
  try {
    const tx = await pm.mint({
      token0: MIM,
      token1: SWETH,
      fee: 500,
      tickLower: tickLower,
      tickUpper: tickUpper,
      amount0Desired: amount0,
      amount1Desired: amount1,
      amount0Min: 0,
      amount1Min: 0,
      recipient: signer.address,
      deadline: Math.floor(Date.now() / 1000) + 3600
    }, { gasLimit: 600000 });
    
    const receipt = await tx.wait();
    console.log("SUCCESS! Tx:", tx.hash);
  } catch (e: any) {
    console.log("Error:", e.message);
  }
}

main().catch(console.error);

