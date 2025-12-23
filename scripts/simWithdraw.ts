import { ethers } from "hardhat";

const NEW_WETH = "0x59319f840A910Ab081fC3070d5C6310d55ad4D9A";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Simulate WToken Withdraw ===\n");

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
    console.log("Reason:", e.reason);
    console.log("Message:", e.message?.slice(0, 400));
    if (e.data && e.data.length > 2) {
      console.log("Error data:", e.data.slice(0, 100));
      
      // Try to decode ERC20InsufficientBalance
      if (e.data.startsWith("0xe450d38c")) {
        const decoded = ethers.utils.defaultAbiCoder.decode(
          ["address", "uint256", "uint256"],
          "0x" + e.data.slice(10)
        );
        console.log("ERC20InsufficientBalance:");
        console.log("  sender:", decoded[0]);
        console.log("  balance:", ethers.utils.formatUnits(decoded[1], 18));
        console.log("  needed:", ethers.utils.formatUnits(decoded[2], 18));
      }
    }
  }
}
main().catch(console.error);
