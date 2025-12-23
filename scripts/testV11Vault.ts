import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const NEW_WETH = "0x4ccf5028EaE017b25cb0Efd075123534Fec53fc8";
const NEW_LEVERAGE_AMM = "0xd9bFC26be5FC0cD2eae8264736423099640aDc5a";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Testing Vault v11 (with swap fix) ===\n");
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
  const depositAmount = ethers.utils.parseUnits("0.0005", 18); // 0.0005 sWETH
  
  if (swethBalance.gte(depositAmount)) {
    console.log("\n--- Testing Deposit ---");
    console.log("Depositing", ethers.utils.formatUnits(depositAmount, 18), "sWETH...");
    
    // Approve
    await (await sweth.approve(NEW_WETH, depositAmount)).wait();
    console.log("Approved");
    
    try {
      const swethBefore = await sweth.balanceOf(signer.address);
      const tx = await weth.deposit(depositAmount, 0, { gasLimit: 2000000 });
      const receipt = await tx.wait();
      console.log("✅ Deposit successful! Gas used:", receipt.gasUsed.toString());
      
      const shares = await weth.balanceOf(signer.address);
      console.log("wETH shares received:", ethers.utils.formatUnits(shares, 18));
      
      // Check LeverageAMM state
      const amm = new ethers.Contract(NEW_LEVERAGE_AMM, [
        "function totalDebt() view returns (uint256)",
        "function totalUnderlying() view returns (uint256)"
      ], signer);
      
      const debt = await amm.totalDebt();
      const underlying = await amm.totalUnderlying();
      console.log("\nLeverageAMM state after deposit:");
      console.log("  Total Debt:", ethers.utils.formatUnits(debt, 18), "MIM");
      console.log("  Total Underlying:", ethers.utils.formatUnits(underlying, 18), "sWETH");
      
      // Now test withdrawal
      console.log("\n--- Testing Withdrawal ---");
      
      // Simulate first
      try {
        const assetsOut = await weth.callStatic.withdraw(shares, 0);
        console.log("Simulation: Would receive", ethers.utils.formatUnits(assetsOut, 18), "sWETH");
        
        // Execute withdrawal
        const withdrawTx = await weth.withdraw(shares, 0, { gasLimit: 2500000 });
        await withdrawTx.wait();
        console.log("✅ Withdrawal successful!");
        
        const swethAfter = await sweth.balanceOf(signer.address);
        const received = swethAfter.sub(swethBefore).add(depositAmount);
        console.log("Net sWETH change:", ethers.utils.formatUnits(received, 18));
        console.log("Final sWETH balance:", ethers.utils.formatUnits(swethAfter, 18));
      } catch (e: any) {
        console.log("❌ Withdrawal failed:", e.reason || e.message?.slice(0, 300));
        if (e.data) {
          // Try to decode
          try {
            const decoded = ethers.utils.defaultAbiCoder.decode(
              ["address", "uint256", "uint256"],
              "0x" + e.data.slice(10)
            );
            console.log("\nERC20InsufficientBalance:");
            console.log("  sender:", decoded[0]);
            console.log("  balance:", ethers.utils.formatUnits(decoded[1], 18));
            console.log("  needed:", ethers.utils.formatUnits(decoded[2], 18));
          } catch {}
        }
      }
    } catch (e: any) {
      console.log("❌ Deposit failed:", e.reason || e.message?.slice(0, 200));
    }
  } else {
    console.log("⚠️ Insufficient sWETH for test");
  }
}

main().catch(console.error);
