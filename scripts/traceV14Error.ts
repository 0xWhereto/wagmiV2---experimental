import { ethers } from "hardhat";

const NEW_WETH = "0xb9d5bf7bA3977EEC67E3d161699BEA09618e6343";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Trace v14 Error ===\n");

  const weth = new ethers.Contract(NEW_WETH, [
    "function balanceOf(address) view returns (uint256)",
    "function withdraw(uint256, uint256) external returns (uint256)"
  ], signer);

  const shares = await weth.balanceOf(signer.address);
  console.log("Shares:", ethers.utils.formatUnits(shares, 18));

  // Try to call withdraw and get detailed error
  try {
    await weth.callStatic.withdraw(shares, 0, { gasLimit: 3000000 });
    console.log("✅ Would succeed");
  } catch (e: any) {
    console.log("❌ Error:", e.reason || "no reason");
    if (e.data) {
      console.log("Error data:", e.data);
      
      // Decode ERC20InsufficientBalance
      if (e.data.startsWith("0xe450d38c")) {
        const decoded = ethers.utils.defaultAbiCoder.decode(
          ["address", "uint256", "uint256"],
          "0x" + e.data.slice(10)
        );
        console.log("\nERC20InsufficientBalance:");
        console.log("  sender:", decoded[0]);
        console.log("  balance:", decoded[1].toString(), "wei =", ethers.utils.formatUnits(decoded[1], 18));
        console.log("  needed:", decoded[2].toString(), "wei =", ethers.utils.formatUnits(decoded[2], 18));
        console.log("  shortfall:", decoded[2].sub(decoded[1]).toString(), "wei");
      }
    }
  }
}

main().catch(console.error);
