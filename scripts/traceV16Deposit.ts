import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const NEW_WETH = "0xfC4D0237D564D44f115A2e28d56CB1b5856CdaB1";
const NEW_AMM = "0x0554F3e0C5d4386FE5AB9A2F7C2D4f364dD61cc4";
const V3_VAULT = "0x825Bccfba2a8814996c5ea91701885Bd6A7025d6";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const SIMPLE_ORACLE = "0xB09aEeBe0E3DFca9F8fEA8F050F7D4b5f70DcF20";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Trace v16 Deposit ===\n");

  const mim = await ethers.getContractAt("IERC20", MIM);
  const sweth = await ethers.getContractAt("IERC20", SWETH);

  // Check oracle price
  const oracle = new ethers.Contract(SIMPLE_ORACLE, [
    "function getPrice() view returns (uint256)"
  ], signer);

  const price = await oracle.getPrice();
  console.log("Oracle price (MIM/sWETH):", ethers.utils.formatUnits(price, 18));

  // Check LeverageAMM approvals
  console.log("\n--- LeverageAMM Approvals ---");
  const ammMIMAllowance = await mim.allowance(NEW_AMM, V3_VAULT);
  const ammSwethAllowance = await sweth.allowance(NEW_AMM, V3_VAULT);
  console.log("MIM allowance to V3Vault:", ethers.utils.formatUnits(ammMIMAllowance, 18));
  console.log("sWETH allowance to V3Vault:", ethers.utils.formatUnits(ammSwethAllowance, 18));

  // Check WToken approvals
  console.log("\n--- WToken Approvals ---");
  const wtokenSwethAllowance = await sweth.allowance(NEW_WETH, NEW_AMM);
  console.log("sWETH allowance to LeverageAMM:", ethers.utils.formatUnits(wtokenSwethAllowance, 18));

  // Check StakingVault state
  console.log("\n--- StakingVault State ---");
  const stakingVault = new ethers.Contract(STAKING_VAULT, [
    "function isBorrower(address) view returns (bool)",
    "function availableLiquidity() view returns (uint256)"
  ], signer);

  console.log("LeverageAMM is borrower:", await stakingVault.isBorrower(NEW_AMM));
  console.log("Available liquidity:", ethers.utils.formatUnits(await stakingVault.availableLiquidity(), 18));

  // Check MIM allowance from StakingVault to LeverageAMM
  const stakingMIMBalance = await mim.balanceOf(STAKING_VAULT);
  console.log("MIM in StakingVault:", ethers.utils.formatUnits(stakingMIMBalance, 18));

  // Check V3LPVault layers
  console.log("\n--- V3LPVault Layers ---");
  const v3 = new ethers.Contract(V3_VAULT, [
    "function isOperator(address) view returns (bool)",
    "function layers(uint256) view returns (int24, int24, uint256, uint128)"
  ], signer);

  console.log("LeverageAMM is operator:", await v3.isOperator(NEW_AMM));

  for (let i = 0; i < 4; i++) {
    try {
      const [tickLower, tickUpper, tokenId, liquidity] = await v3.layers(i);
      console.log(`Layer ${i}: tokenId=${tokenId}, liquidity=${liquidity}`);
    } catch {
      break;
    }
  }

  // Calculate expected borrow amount
  const depositAmount = ethers.utils.parseUnits("0.0005", 18);
  const expectedBorrow = depositAmount.mul(price).div(ethers.utils.parseUnits("1", 18));
  console.log("\n--- Expected Values ---");
  console.log("Deposit amount:", ethers.utils.formatUnits(depositAmount, 18), "sWETH");
  console.log("Expected MIM borrow:", ethers.utils.formatUnits(expectedBorrow, 18), "MIM");
}
main().catch(console.error);
