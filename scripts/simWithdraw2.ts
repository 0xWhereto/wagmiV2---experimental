import { ethers } from "hardhat";

const NEW_WETH = "0x59319f840A910Ab081fC3070d5C6310d55ad4D9A";
const NEW_AMM = "0x34e9a683199E566F494e6C9C3fA299479D5e028F";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Simulate Withdrawal ===\n");

  const mim = await ethers.getContractAt("IERC20", MIM);
  console.log("AMM MIM balance:", ethers.utils.formatUnits(await mim.balanceOf(NEW_AMM), 18));

  const weth = new ethers.Contract(NEW_WETH, [
    "function balanceOf(address) view returns (uint256)",
    "function withdraw(uint256, uint256) external returns (uint256)"
  ], signer);

  const shares = await weth.balanceOf(signer.address);
  console.log("Shares:", ethers.utils.formatUnits(shares, 18));

  // Simulate withdrawal
  console.log("\n--- Simulating withdraw ---");
  try {
    const result = await weth.callStatic.withdraw(shares, 0, { gasLimit: 2500000 });
    console.log("✅ Simulation OK, would get:", ethers.utils.formatUnits(result, 18), "sWETH");
  } catch (e: any) {
    console.log("❌ Simulation failed");
    console.log("Error data:", e.data?.slice(0, 100));
    
    // Decode error
    if (e.data && e.data.startsWith("0xe450d38c")) {
      const decoded = ethers.utils.defaultAbiCoder.decode(
        ["address", "uint256", "uint256"],
        "0x" + e.data.slice(10)
      );
      console.log("ERC20InsufficientBalance:");
      console.log("  sender:", decoded[0]);
      console.log("  balance:", ethers.utils.formatUnits(decoded[1], 18));
      console.log("  needed:", ethers.utils.formatUnits(decoded[2], 18));
    } else {
      // Check for other errors
      const selectors: {[key: string]: string} = {
        "0x2703feb0": "NotWToken()",
        "0x1f2a2005": "ZeroAmount()",
        "0xbb55fd27": "InsufficientLiquidity()",
        "0x5857ecb7": "NotEnoughUnderlying()",
        "0xf931874c": "NotEnoughMIM()",
        "0x81ceff30": "SwapFailed()"
      };
      const selector = e.data?.slice(0, 10);
      console.log("Error selector:", selector);
      if (selectors[selector]) {
        console.log("Error:", selectors[selector]);
      }
    }
  }
}
main().catch(console.error);
