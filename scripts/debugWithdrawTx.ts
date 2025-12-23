import { ethers } from "hardhat";

const TX_HASH = "0xc4d12a05e6524979784eb5cbca1f905ae4263366343e6f11285c9fe8994016da";

const ADDRESSES = {
  MIM: "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708",
  SMIM: "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7",
  WETH: "0xEA7681f28c62AbF83DeD17eEd88D48b3BD813Af7"
};

async function main() {
  const [signer] = await ethers.getSigners();
  const provider = ethers.provider;
  
  console.log("=== Debugging Failed Withdrawal TX ===\n");
  console.log("TX Hash:", TX_HASH);

  // Get transaction details
  const tx = await provider.getTransaction(TX_HASH);
  if (!tx) {
    console.log("Transaction not found");
    return;
  }

  console.log("\n--- Transaction Details ---");
  console.log("From:", tx.from);
  console.log("To:", tx.to);
  console.log("Value:", ethers.utils.formatEther(tx.value || 0), "ETH");
  
  // Decode input data
  const iface = new ethers.utils.Interface([
    "function withdraw(uint256 shares) returns (uint256)",
    "function withdraw(uint256 shares, uint256 minAssets) returns (uint256)",
    "function withdraw(uint256 assets, address receiver, address owner) returns (uint256)"
  ]);

  try {
    const decoded = iface.parseTransaction({ data: tx.data });
    console.log("\n--- Decoded Input ---");
    console.log("Function:", decoded.name);
    console.log("Args:", decoded.args.map((a: any) => a.toString()));
    
    if (decoded.args[0]) {
      const amount = decoded.args[0];
      console.log("Amount (formatted 18 dec):", ethers.utils.formatUnits(amount, 18));
    }
  } catch (e) {
    console.log("Could not decode with known ABIs");
    console.log("Raw data:", tx.data);
  }

  // Check which contract was called
  console.log("\n--- Contract Identification ---");
  if (tx.to?.toLowerCase() === ADDRESSES.SMIM.toLowerCase()) {
    console.log("Target: sMIM (StakingVault)");
    
    // Check current state
    const vault = new ethers.Contract(ADDRESSES.SMIM, [
      "function balanceOf(address) view returns (uint256)",
      "function getCash() view returns (uint256)",
      "function totalAssets() view returns (uint256)",
      "function convertToAssets(uint256) view returns (uint256)"
    ], signer);

    const userBalance = await vault.balanceOf(tx.from);
    const cash = await vault.getCash();
    
    console.log("User sMIM balance:", ethers.utils.formatUnits(userBalance, 18));
    console.log("Vault cash:", ethers.utils.formatUnits(cash, 18), "MIM");
    
    // Try to decode the amount being withdrawn
    try {
      const decoded = iface.parseTransaction({ data: tx.data });
      const shares = decoded.args[0];
      const assetsNeeded = await vault.convertToAssets(shares);
      console.log("\nWithdraw requested:", ethers.utils.formatUnits(shares, 18), "shares");
      console.log("Assets needed:", ethers.utils.formatUnits(assetsNeeded, 18), "MIM");
      console.log("Cash available:", ethers.utils.formatUnits(cash, 18), "MIM");
      
      if (assetsNeeded.gt(cash)) {
        console.log("\n❌ INSUFFICIENT LIQUIDITY");
        console.log("Shortfall:", ethers.utils.formatUnits(assetsNeeded.sub(cash), 18), "MIM");
      } else {
        console.log("\n✅ Sufficient liquidity available");
      }
    } catch (e) {
      console.log("Could not analyze amount");
    }
    
  } else if (tx.to?.toLowerCase() === ADDRESSES.WETH.toLowerCase()) {
    console.log("Target: wETH (Zero-IL Vault)");
  } else {
    console.log("Target: Unknown contract -", tx.to);
  }

  // Get receipt to check revert reason
  console.log("\n--- Transaction Receipt ---");
  try {
    const receipt = await provider.getTransactionReceipt(TX_HASH);
    console.log("Status:", receipt.status === 1 ? "Success" : "Failed");
    console.log("Gas Used:", receipt.gasUsed.toString());
    
    if (receipt.status === 0) {
      // Try to get revert reason
      try {
        await provider.call({
          to: tx.to,
          data: tx.data,
          from: tx.from,
          value: tx.value,
          gasLimit: tx.gasLimit
        }, tx.blockNumber! - 1);
      } catch (e: any) {
        console.log("Revert reason:", e.reason || e.message?.slice(0, 200));
      }
    }
  } catch (e: any) {
    console.log("Could not get receipt:", e.message?.slice(0, 100));
  }
}

main().catch(console.error);
