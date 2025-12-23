import { ethers } from "hardhat";

const WETH_VAULT = "0xEA7681f28c62AbF83DeD17eEd88D48b3BD813Af7";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Retry Withdrawal ===\n");

  const weth = new ethers.Contract(WETH_VAULT, [
    "function balanceOf(address) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function withdraw(uint256 shares, uint256 minAssets) external returns (uint256)"
  ], signer);

  const sweth = await ethers.getContractAt("IERC20", SWETH);
  const swethBefore = await sweth.balanceOf(signer.address);

  const userShares = await weth.balanceOf(signer.address);
  console.log("User wETH shares:", ethers.utils.formatUnits(userShares, 18));
  console.log("sWETH before:", ethers.utils.formatUnits(swethBefore, 18));

  if (userShares.gt(0)) {
    // First simulate
    console.log("\nSimulating withdrawal...");
    try {
      const assets = await weth.callStatic.withdraw(userShares, 0);
      console.log("✅ Simulation passed! Would receive:", ethers.utils.formatUnits(assets, 18), "sWETH");
      
      // Actually execute
      console.log("\nExecuting withdrawal...");
      const tx = await weth.withdraw(userShares, 0, { gasLimit: 2500000 });
      console.log("TX Hash:", tx.hash);
      const receipt = await tx.wait();
      console.log("✅ Withdrawal successful! Gas used:", receipt.gasUsed.toString());

      const swethAfter = await sweth.balanceOf(signer.address);
      const received = swethAfter.sub(swethBefore);
      const remaining = await weth.balanceOf(signer.address);
      
      console.log("\n=== Final State ===");
      console.log("sWETH received:", ethers.utils.formatUnits(received, 18));
      console.log("wETH remaining:", ethers.utils.formatUnits(remaining, 18));
    } catch (e: any) {
      console.log("❌ Failed:", e.reason || e.message?.slice(0, 400));
      if (e.data) {
        // Try to decode error
        try {
          const decoded = ethers.utils.defaultAbiCoder.decode(
            ["address", "uint256", "uint256"],
            "0x" + e.data.slice(10)
          );
          console.log("\nERC20InsufficientBalance error:");
          console.log("  sender:", decoded[0]);
          console.log("  balance:", ethers.utils.formatUnits(decoded[1], 18));
          console.log("  needed:", ethers.utils.formatUnits(decoded[2], 18));
        } catch {}
      }
    }
  }
}

main().catch(console.error);
