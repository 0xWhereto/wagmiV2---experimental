import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const NEW_WETH = "0x59319f840A910Ab081fC3070d5C6310d55ad4D9A";
const NEW_AMM = "0x34e9a683199E566F494e6C9C3fA299479D5e028F";
const V3_VAULT = "0x825Bccfba2a8814996c5ea91701885Bd6A7025d6";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Debug Withdrawal ===\n");

  const sweth = await ethers.getContractAt("IERC20", SWETH);
  const mim = await ethers.getContractAt("IERC20", MIM);

  const weth = new ethers.Contract(NEW_WETH, [
    "function balanceOf(address) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function withdraw(uint256, uint256) external returns (uint256)"
  ], signer);

  const amm = new ethers.Contract(NEW_AMM, [
    "function totalDebt() view returns (uint256)",
    "function totalUnderlying() view returns (uint256)",
    "function closePosition(uint256, uint256) external returns (uint256)"
  ], signer);

  const v3 = new ethers.Contract(V3_VAULT, [
    "function getTotalAssets() view returns (uint256, uint256)",
    "function removeLiquidity(uint256, uint256, uint256) external returns (uint256, uint256)"
  ], signer);

  // Check state
  const shares = await weth.balanceOf(signer.address);
  const totalSupply = await weth.totalSupply();
  console.log("Shares:", ethers.utils.formatUnits(shares, 18));
  console.log("TotalSupply:", ethers.utils.formatUnits(totalSupply, 18));

  console.log("\nAMM State:");
  console.log("  totalDebt:", ethers.utils.formatUnits(await amm.totalDebt(), 18));
  console.log("  totalUnderlying:", ethers.utils.formatUnits(await amm.totalUnderlying(), 18));

  const [a0, a1] = await v3.getTotalAssets();
  console.log("\nV3 Assets:");
  console.log("  sWETH:", ethers.utils.formatUnits(a0, 18));
  console.log("  MIM:", ethers.utils.formatUnits(a1, 18));

  console.log("\nBalances:");
  console.log("  AMM sWETH:", ethers.utils.formatUnits(await sweth.balanceOf(NEW_AMM), 18));
  console.log("  AMM MIM:", ethers.utils.formatUnits(await mim.balanceOf(NEW_AMM), 18));
  console.log("  V3 sWETH:", ethers.utils.formatUnits(await sweth.balanceOf(V3_VAULT), 18));
  console.log("  V3 MIM:", ethers.utils.formatUnits(await mim.balanceOf(V3_VAULT), 18));

  // Simulate V3 removeLiquidity
  console.log("\n--- Simulating V3 removeLiquidity(10000) ---");
  try {
    const [r0, r1] = await v3.callStatic.removeLiquidity(10000, 0, 0);
    console.log("  Would get sWETH:", ethers.utils.formatUnits(r0, 18));
    console.log("  Would get MIM:", ethers.utils.formatUnits(r1, 18));
  } catch (e: any) {
    console.log("  Failed:", e.reason || e.message?.slice(0, 200));
  }

  // Simulate closePosition
  console.log("\n--- Simulating closePosition ---");
  try {
    const result = await amm.callStatic.closePosition(shares, totalSupply, { gasLimit: 2000000 });
    console.log("  Would get:", ethers.utils.formatUnits(result, 18), "sWETH");
  } catch (e: any) {
    console.log("  Failed:", e.reason || e.message?.slice(0, 300));
    if (e.data && e.data.startsWith("0xe450d38c")) {
      const decoded = ethers.utils.defaultAbiCoder.decode(
        ["address", "uint256", "uint256"],
        "0x" + e.data.slice(10)
      );
      console.log("  ERC20InsufficientBalance:");
      console.log("    sender:", decoded[0]);
      console.log("    balance:", ethers.utils.formatUnits(decoded[1], 18));
      console.log("    needed:", ethers.utils.formatUnits(decoded[2], 18));
      console.log("    shortfall:", ethers.utils.formatUnits(decoded[2].sub(decoded[1]), 18));
    }
  }
}
main().catch(console.error);
