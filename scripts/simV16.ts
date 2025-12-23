import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const NEW_WETH = "0xfC4D0237D564D44f115A2e28d56CB1b5856CdaB1";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Simulate v16 Deposit ===\n");

  const sweth = await ethers.getContractAt("IERC20", SWETH);
  const weth = new ethers.Contract(NEW_WETH, [
    "function deposit(uint256, uint256) external returns (uint256)"
  ], signer);

  const depositAmount = ethers.utils.parseUnits("0.0005", 18);
  
  // Ensure approval
  await (await sweth.approve(NEW_WETH, depositAmount)).wait();
  
  // Simulate
  try {
    const result = await weth.callStatic.deposit(depositAmount, 0, { gasLimit: 2000000 });
    console.log("✅ Simulation OK, would get:", ethers.utils.formatUnits(result, 18), "shares");
  } catch (e: any) {
    console.log("❌ Simulation failed");
    console.log("Reason:", e.reason);
    console.log("Message:", e.message?.slice(0, 500));
    if (e.data) {
      console.log("Error data:", e.data.slice(0, 200));
      // Try to decode common errors
      if (e.data.startsWith("0xe450d38c")) {
        const decoded = ethers.utils.defaultAbiCoder.decode(
          ["address", "uint256", "uint256"],
          "0x" + e.data.slice(10)
        );
        console.log("  ERC20InsufficientBalance:");
        console.log("    sender:", decoded[0]);
        console.log("    balance:", ethers.utils.formatUnits(decoded[1], 18));
        console.log("    needed:", ethers.utils.formatUnits(decoded[2], 18));
      }
    }
  }
}
main().catch(console.error);
