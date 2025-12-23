import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const NEW_WETH = "0xc497a846B3c4c0574F6D05FB7ad2650970b963cF";
const NEW_AMM = "0x45b825A072e0eE39c524c79964a534C9806e2E17";
const V3_VAULT = "0x825Bccfba2a8814996c5ea91701885Bd6A7025d6";
const STAKING_VAULT = "0xBdBAd1ae9B2Ba67A1E0d8E6DD8eEcf4a7A52c8d5";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Debug v16 ===\n");

  const sweth = await ethers.getContractAt("IERC20", SWETH);
  const mim = await ethers.getContractAt("IERC20", MIM);

  // Check staking vault MIM balance
  console.log("--- Staking Vault State ---");
  const stakingMIM = await mim.balanceOf(STAKING_VAULT);
  console.log("MIM in StakingVault:", ethers.utils.formatUnits(stakingMIM, 18));

  const stakingVault = new ethers.Contract(STAKING_VAULT, [
    "function authorizedBorrowers(address) view returns (bool)",
    "function totalBorrows() view returns (uint256)"
  ], signer);

  const authorized = await stakingVault.authorizedBorrowers(NEW_AMM);
  console.log("LeverageAMM authorized:", authorized);
  console.log("Total borrows:", ethers.utils.formatUnits(await stakingVault.totalBorrows(), 18));

  // Check V3 vault state
  console.log("\n--- V3 Vault State ---");
  const v3 = new ethers.Contract(V3_VAULT, [
    "function isOperator(address) view returns (bool)",
    "function layers(uint256) view returns (int24 tickLower, int24 tickUpper, uint256 tokenId, uint128 liquidity)"
  ], signer);

  console.log("LeverageAMM is operator:", await v3.isOperator(NEW_AMM));
  
  // Check layers
  for (let i = 0; i < 4; i++) {
    try {
      const layer = await v3.layers(i);
      console.log(`Layer ${i}: tokenId=${layer.tokenId}, liquidity=${layer.liquidity}`);
    } catch {
      break;
    }
  }

  // Check WToken state
  console.log("\n--- WToken State ---");
  const wtoken = new ethers.Contract(NEW_WETH, [
    "function leverageAMM() view returns (address)",
    "function v3LPVault() view returns (address)",
    "function underlyingAsset() view returns (address)"
  ], signer);

  console.log("leverageAMM:", await wtoken.leverageAMM());
  console.log("v3LPVault:", await wtoken.v3LPVault());
  console.log("underlyingAsset:", await wtoken.underlyingAsset());

  // Check LeverageAMM state
  console.log("\n--- LeverageAMM State ---");
  const amm = new ethers.Contract(NEW_AMM, [
    "function wToken() view returns (address)",
    "function v3LPVault() view returns (address)",
    "function stakingVault() view returns (address)",
    "function oracle() view returns (address)",
    "function underlyingIsToken0() view returns (bool)",
    "function totalDebt() view returns (uint256)",
    "function totalUnderlying() view returns (uint256)"
  ], signer);

  console.log("wToken:", await amm.wToken());
  console.log("v3LPVault:", await amm.v3LPVault());
  console.log("stakingVault:", await amm.stakingVault());
  console.log("oracle:", await amm.oracle());
  console.log("underlyingIsToken0:", await amm.underlyingIsToken0());
  console.log("totalDebt:", ethers.utils.formatUnits(await amm.totalDebt(), 18));
  console.log("totalUnderlying:", ethers.utils.formatUnits(await amm.totalUnderlying(), 18));

  // Try simulating deposit
  console.log("\n--- Simulate Deposit ---");
  const depositAmount = ethers.utils.parseUnits("0.0005", 18);
  
  const wethContract = new ethers.Contract(NEW_WETH, [
    "function deposit(uint256, uint256) external returns (uint256)"
  ], signer);

  try {
    await sweth.approve(NEW_WETH, depositAmount);
    const result = await wethContract.callStatic.deposit(depositAmount, 0, { gasLimit: 2000000 });
    console.log("✅ Simulation OK, would get:", ethers.utils.formatUnits(result, 18), "shares");
  } catch (e: any) {
    console.log("❌ Simulation failed");
    console.log("Error:", e.reason || e.message?.slice(0, 300));
    if (e.data) {
      console.log("Error data:", e.data.slice(0, 100));
    }
  }
}
main().catch(console.error);
