import { ethers } from "hardhat";

const TX_HASH = "0x6f4b2b15c32b81122155cc66ac84cc7479f38a30036904ab7f6f9e84f9d74057";

const WTOKEN_ABI = [
  "function deposit(uint256 amount, uint256 minShares) external returns (uint256)",
];

async function main() {
  const [signer] = await ethers.getSigners();
  const provider = signer.provider!;
  
  // Get transaction
  const tx = await provider.getTransaction(TX_HASH);
  console.log("Transaction:", TX_HASH);
  console.log("From:", tx.from);
  console.log("To:", tx.to);
  console.log("Data:", tx.data);
  
  // Decode the input
  const iface = new ethers.utils.Interface(WTOKEN_ABI);
  try {
    const decoded = iface.parseTransaction({ data: tx.data });
    console.log("\nDecoded:");
    console.log("  Function:", decoded.name);
    console.log("  amount:", ethers.utils.formatEther(decoded.args.amount), "sWETH");
    console.log("  minShares:", decoded.args.minShares.toString());
    
    // Calculate how much MIM this needs
    const price = 3000; // MIM per sWETH
    const mimNeeded = parseFloat(ethers.utils.formatEther(decoded.args.amount)) * price;
    console.log("\n  MIM needed for 2x leverage:", mimNeeded, "MIM");
  } catch (e: any) {
    console.log("Failed to decode:", e.message);
  }
  
  // Check receipt for error
  const receipt = await provider.getTransactionReceipt(TX_HASH);
  console.log("\nReceipt status:", receipt.status === 1 ? "Success" : "Failed");
  console.log("Gas used:", receipt.gasUsed.toString());
  
  // Check current available liquidity
  const stakingVault = new ethers.Contract("0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7", [
    "function getCash() view returns (uint256)",
    "function totalBorrows() view returns (uint256)",
  ], signer);
  
  const cash = await stakingVault.getCash();
  const borrows = await stakingVault.totalBorrows();
  const available = cash.mul(90).div(100);
  
  console.log("\n=== Liquidity Check ===");
  console.log("Cash:", ethers.utils.formatEther(cash), "MIM");
  console.log("Available (90%):", ethers.utils.formatEther(available), "MIM");
  console.log("Max sWETH deposit:", parseFloat(ethers.utils.formatEther(available)) / 3000, "sWETH");
}

main().catch(console.error);

