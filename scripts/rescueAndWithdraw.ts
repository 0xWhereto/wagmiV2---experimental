import { ethers } from "hardhat";

const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const LEVERAGE_AMM = "0x8CA24d00ffcF60e9ba7F67F9d41ccA28E22dF508";
const WETH_VAULT = "0xEA7681f28c62AbF83DeD17eEd88D48b3BD813Af7";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const SUSDC = "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Rescue and Withdraw from wETH Vault ===\n");
  console.log("Signer:", signer.address);

  const mim = await ethers.getContractAt("IERC20", MIM);
  const susdc = await ethers.getContractAt("IERC20", SUSDC);
  const weth = new ethers.Contract(WETH_VAULT, [
    "function balanceOf(address) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function withdraw(uint256 shares, uint256 minAssets) external returns (uint256)"
  ], signer);

  // Step 1: Check current MIM balance
  const mimBalance = await mim.balanceOf(signer.address);
  console.log("Current MIM balance:", ethers.utils.formatUnits(mimBalance, 18), "MIM");

  // We need at least 0.35 MIM (with buffer) to inject into LeverageAMM
  const neededMIM = ethers.utils.parseUnits("0.5", 18); // Extra buffer

  if (mimBalance.lt(neededMIM)) {
    console.log("\n--- Need to mint more MIM first ---");
    
    // Check sUSDC balance
    const susdcBalance = await susdc.balanceOf(signer.address);
    console.log("sUSDC balance:", ethers.utils.formatUnits(susdcBalance, 6));

    if (susdcBalance.gt(0)) {
      // Mint MIM with sUSDC
      const mimContract = new ethers.Contract(MIM, [
        "function mintWithUSDC(uint256 amount) external returns (uint256)",
        "function approve(address, uint256) external returns (bool)"
      ], signer);

      // Approve sUSDC for MIM
      console.log("\nApproving sUSDC for MIM...");
      const susdcContract = await ethers.getContractAt("IERC20", SUSDC);
      const mintAmount = ethers.utils.parseUnits("1", 6); // Mint 1 MIM
      await (await susdcContract.approve(MIM, mintAmount)).wait();
      
      console.log("Minting MIM...");
      const tx = await mimContract.mintWithUSDC(mintAmount);
      await tx.wait();
      console.log("✅ Minted MIM");
      
      const newMimBalance = await mim.balanceOf(signer.address);
      console.log("New MIM balance:", ethers.utils.formatUnits(newMimBalance, 18));
    } else {
      console.log("❌ No sUSDC to mint MIM. Need to bridge sUSDC first.");
      return;
    }
  }

  // Step 2: Transfer MIM directly to LeverageAMM to cover shortfall
  console.log("\n--- Injecting MIM into LeverageAMM ---");
  
  const shortfall = ethers.utils.parseUnits("0.35", 18); // 0.35 MIM with buffer
  console.log("Injecting", ethers.utils.formatUnits(shortfall, 18), "MIM to LeverageAMM...");
  
  const transferTx = await mim.transfer(LEVERAGE_AMM, shortfall);
  await transferTx.wait();
  console.log("✅ MIM transferred to LeverageAMM");

  const ammMimBalance = await mim.balanceOf(LEVERAGE_AMM);
  console.log("LeverageAMM MIM balance:", ethers.utils.formatUnits(ammMimBalance, 18));

  // Step 3: Attempt withdrawal
  console.log("\n--- Attempting Withdrawal ---");
  
  const userShares = await weth.balanceOf(signer.address);
  console.log("User wETH shares:", ethers.utils.formatUnits(userShares, 18));

  if (userShares.gt(0)) {
    try {
      console.log("Withdrawing all wETH shares...");
      const withdrawTx = await weth.withdraw(userShares, 0, { gasLimit: 2000000 });
      console.log("TX Hash:", withdrawTx.hash);
      const receipt = await withdrawTx.wait();
      console.log("✅ Withdrawal successful! Gas used:", receipt.gasUsed.toString());

      // Check final balances
      const sweth = await ethers.getContractAt("IERC20", "0x5E501C482952c1F2D58a4294F9A97759968c5125");
      const finalSweth = await sweth.balanceOf(signer.address);
      const finalWeth = await weth.balanceOf(signer.address);
      
      console.log("\n=== Final State ===");
      console.log("sWETH received:", ethers.utils.formatUnits(finalSweth, 18));
      console.log("wETH remaining:", ethers.utils.formatUnits(finalWeth, 18));
    } catch (e: any) {
      console.log("❌ Withdrawal failed:", e.reason || e.message?.slice(0, 300));
      
      // Decode error if possible
      if (e.data) {
        console.log("Error data:", e.data);
      }
    }
  } else {
    console.log("No wETH shares to withdraw");
  }
}

main().catch(console.error);
