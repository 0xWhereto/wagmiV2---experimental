import { ethers } from "hardhat";

const NEW_WETH = "0x1d71d3aaaEf85C1d3c78c9EC670AC097Db804634";
const NEW_AMM = "0xbBe44C50D260f54Eee92044419F25a4e1c579d30";
const V3LP_VAULT = "0x1139d155D39b2520047178444C51D3D70204650F";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Debug v15 ===\n");

  const mim = await ethers.getContractAt("IERC20", MIM);
  const weth = new ethers.Contract(NEW_WETH, [
    "function balanceOf(address) view returns (uint256)",
    "function withdraw(uint256, uint256) external returns (uint256)"
  ], signer);

  const amm = new ethers.Contract(NEW_AMM, [
    "function totalDebt() view returns (uint256)"
  ], signer);

  const v3 = new ethers.Contract(V3LP_VAULT, [
    "function removeLiquidity(uint256, uint256, uint256) returns (uint256, uint256)"
  ], signer);

  const shares = await weth.balanceOf(signer.address);
  const debt = await amm.totalDebt();
  console.log("Shares:", ethers.utils.formatUnits(shares, 18));
  console.log("Debt:", ethers.utils.formatUnits(debt, 18));

  // Simulate removal
  const [a0, a1] = await v3.callStatic.removeLiquidity(10000, 0, 0);
  console.log("\nV3 removal would give:");
  console.log("  sWETH:", ethers.utils.formatUnits(a0, 18));
  console.log("  MIM:", ethers.utils.formatUnits(a1, 18));
  
  console.log("\nMIM in AMM:", ethers.utils.formatUnits(await mim.balanceOf(NEW_AMM), 18));

  // Try withdraw with callStatic
  try {
    const result = await weth.callStatic.withdraw(shares, 0);
    console.log("\n✅ Sim OK, would get:", ethers.utils.formatUnits(result, 18), "sWETH");
  } catch (e: any) {
    console.log("\n❌ Sim failed");
    if (e.data && e.data.startsWith("0xe450d38c")) {
      const decoded = ethers.utils.defaultAbiCoder.decode(
        ["address", "uint256", "uint256"],
        "0x" + e.data.slice(10)
      );
      console.log("  balance:", ethers.utils.formatUnits(decoded[1], 18));
      console.log("  needed:", ethers.utils.formatUnits(decoded[2], 18));
      console.log("  shortfall:", (decoded[2].sub(decoded[1])).toString(), "wei");
    } else {
      console.log("  error:", e.message?.slice(0, 200));
    }
  }
}
main().catch(console.error);
