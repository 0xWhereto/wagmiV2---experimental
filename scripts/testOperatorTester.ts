import { ethers } from "hardhat";

const V3_VAULT = "0x4bd60b79f568732630834f348EFeC7056E20a08A";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Test OperatorTester ===\n");
  
  // Deploy tester
  const OperatorTester = await ethers.getContractFactory("OperatorTester");
  const tester = await OperatorTester.deploy(V3_VAULT, { gasLimit: 1000000 });
  await tester.deployed();
  console.log("OperatorTester:", tester.address);
  
  // Set tester as operator
  const V3LPVault = await ethers.getContractFactory("V3LPVault");
  const v3Vault = V3LPVault.attach(V3_VAULT);
  await (await v3Vault.setOperator(tester.address, true)).wait();
  console.log("Set as operator:", await v3Vault.isOperator(tester.address));
  
  const sweth = new ethers.Contract(SWETH, ["function balanceOf(address) view returns (uint256)"], signer);
  const mim = new ethers.Contract(MIM, ["function balanceOf(address) view returns (uint256)"], signer);
  
  console.log("\nBefore test:");
  console.log("  V3Vault sWETH:", ethers.utils.formatEther(await sweth.balanceOf(V3_VAULT)));
  console.log("  V3Vault MIM:", ethers.utils.formatEther(await mim.balanceOf(V3_VAULT)));
  const [a0, a1] = await v3Vault.getTotalAssets();
  console.log("  V3Vault assets:", ethers.utils.formatEther(a0), "sWETH,", ethers.utils.formatEther(a1), "MIM");
  
  // Call testRemoveLiquidity
  console.log("\nCalling testRemoveLiquidity(10000) as operator...");
  try {
    const tx = await tester.testRemoveLiquidity(10000, { gasLimit: 2000000 });
    const receipt = await tx.wait();
    console.log("SUCCESS! Gas used:", receipt.gasUsed.toString());
    
    // Parse event
    const event = receipt.events?.find((e: any) => e.event === "RemoveLiquidityResult");
    if (event) {
      console.log("\nRemoveLiquidityResult event:");
      console.log("  amount0:", ethers.utils.formatEther(event.args.amount0));
      console.log("  amount1:", ethers.utils.formatEther(event.args.amount1));
      console.log("  balance0:", ethers.utils.formatEther(event.args.balance0));
      console.log("  balance1:", ethers.utils.formatEther(event.args.balance1));
    }
    
    console.log("\nTester balances after:");
    console.log("  sWETH:", ethers.utils.formatEther(await sweth.balanceOf(tester.address)));
    console.log("  MIM:", ethers.utils.formatEther(await mim.balanceOf(tester.address)));
  } catch (err: any) {
    console.log("FAILED:", err.reason || err.message);
  }
}
main().catch(console.error);
