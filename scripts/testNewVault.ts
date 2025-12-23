import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const NEW_WETH = "0x0A401D992A0DFf215dC450186A4Ee53211e870Ec";
const NEW_LEVERAGE_AMM = "0x81513AFec6B50073dE566C95B6140f21b67B6091";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Testing New Vault (v10 with underwater fix) ===\n");
  console.log("Signer:", signer.address);

  const sweth = await ethers.getContractAt("IERC20", SWETH);
  const mim = await ethers.getContractAt("IERC20", MIM);
  const weth = new ethers.Contract(NEW_WETH, [
    "function deposit(uint256, uint256) external returns (uint256)",
    "function withdraw(uint256, uint256) external returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function pricePerShare() view returns (uint256)"
  ], signer);

  // Check balances
  const swethBalance = await sweth.balanceOf(signer.address);
  console.log("sWETH balance:", ethers.utils.formatUnits(swethBalance, 18));

  // Check staking vault cash
  const cash = await mim.balanceOf(STAKING_VAULT);
  console.log("StakingVault MIM:", ethers.utils.formatUnits(cash, 18));

  // Deposit a small amount
  const depositAmount = ethers.utils.parseUnits("0.0002", 18); // 0.0002 sWETH
  
  if (swethBalance.gte(depositAmount)) {
    console.log("\n--- Testing Deposit ---");
    console.log("Depositing", ethers.utils.formatUnits(depositAmount, 18), "sWETH...");
    
    // Approve
    await (await sweth.approve(NEW_WETH, depositAmount)).wait();
    console.log("Approved");
    
    try {
      const tx = await weth.deposit(depositAmount, 0, { gasLimit: 2000000 });
      const receipt = await tx.wait();
      console.log("✅ Deposit successful! Gas used:", receipt.gasUsed.toString());
      
      const shares = await weth.balanceOf(signer.address);
      console.log("wETH shares received:", ethers.utils.formatUnits(shares, 18));
      
      // Now test withdrawal
      console.log("\n--- Testing Withdrawal ---");
      
      // Simulate first
      try {
        const assetsOut = await weth.callStatic.withdraw(shares, 0);
        console.log("Simulation: Would receive", ethers.utils.formatUnits(assetsOut, 18), "sWETH");
        
        // Execute withdrawal
        const withdrawTx = await weth.withdraw(shares, 0, { gasLimit: 2000000 });
        await withdrawTx.wait();
        console.log("✅ Withdrawal successful!");
        
        const finalSweth = await sweth.balanceOf(signer.address);
        console.log("Final sWETH balance:", ethers.utils.formatUnits(finalSweth, 18));
      } catch (e: any) {
        console.log("❌ Withdrawal failed:", e.reason || e.message?.slice(0, 200));
      }
    } catch (e: any) {
      console.log("❌ Deposit failed:", e.reason || e.message?.slice(0, 200));
    }
  } else {
    console.log("⚠️ Insufficient sWETH for test");
  }
}

main().catch(console.error);
