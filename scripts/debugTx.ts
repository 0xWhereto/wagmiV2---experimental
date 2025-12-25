import { ethers } from "hardhat";

const TX_HASH = "0x906b3657b63e5808aefce6540c1b05b60793818f5d85a70bfbb9294e6f92f732";

const ADDRESSES = {
  wETH: "0xed5Ae4CA461E1871fdBa61766a5215c3ea16d9CA",
  leverageAMM: "0x61832D6486E8cf367B8919C7eE140Cd545048674",
  v3LPVault: "0xAc2fCBDdaDe5BD1920909054B03Ad4641f971b8E",
  stakingVault: "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7",
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  oracle: "0xD8680463F66C7bF74C61A2660aF4d7094ee9F749",
};

async function main() {
  const [signer] = await ethers.getSigners();
  const provider = signer.provider!;
  
  // Get transaction
  const tx = await provider.getTransaction(TX_HASH);
  const receipt = await provider.getTransactionReceipt(TX_HASH);
  
  console.log("Transaction:", TX_HASH);
  console.log("Status:", receipt.status === 1 ? "Success" : "Failed");
  console.log("From:", tx.from);
  console.log("To:", tx.to);
  console.log("Gas used:", receipt.gasUsed.toString());
  
  // Check current vault state
  const wETH = new ethers.Contract(ADDRESSES.wETH, [
    "function totalSupply() view returns (uint256)",
    "function totalDeposited() view returns (uint256)",
    "function pricePerShare() view returns (uint256)",
    "function convertToShares(uint256) view returns (uint256)",
    "function convertToAssets(uint256) view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
  ], signer);
  
  const leverageAMM = new ethers.Contract(ADDRESSES.leverageAMM, [
    "function totalDebt() view returns (uint256)",
    "function totalUnderlying() view returns (uint256)",
    "function getPrice() view returns (uint256)",
  ], signer);
  
  console.log("\n=== Current Vault State ===\n");
  
  const totalSupply = await wETH.totalSupply();
  const totalDeposited = await wETH.totalDeposited();
  const pricePerShare = await wETH.pricePerShare();
  
  console.log("wETH Vault:");
  console.log("  totalSupply:", ethers.utils.formatEther(totalSupply), "wETH");
  console.log("  totalDeposited:", ethers.utils.formatEther(totalDeposited), "sWETH");
  console.log("  pricePerShare:", ethers.utils.formatEther(pricePerShare));
  
  // Check ratio
  if (!totalSupply.isZero()) {
    const ratio = totalDeposited.mul(ethers.utils.parseEther("1")).div(totalSupply);
    console.log("  deposits/supply ratio:", ethers.utils.formatEther(ratio));
  }
  
  // Check conversion
  const testDeposit = ethers.utils.parseEther("0.001");
  const expectedShares = await wETH.convertToShares(testDeposit);
  console.log("\nConversion test:");
  console.log("  0.001 sWETH -> ", ethers.utils.formatEther(expectedShares), "wETH");
  console.log("  Ratio:", parseFloat(ethers.utils.formatEther(expectedShares)) / 0.001);
  
  // Check LeverageAMM
  console.log("\nLeverageAMM:");
  const totalDebt = await leverageAMM.totalDebt();
  const totalUnderlying = await leverageAMM.totalUnderlying();
  const price = await leverageAMM.getPrice();
  
  console.log("  totalDebt:", ethers.utils.formatEther(totalDebt), "MIM");
  console.log("  totalUnderlying:", ethers.utils.formatEther(totalUnderlying), "sWETH");
  console.log("  getPrice:", ethers.utils.formatEther(price), "MIM/sWETH");
  
  // Parse logs from the transaction
  console.log("\n=== Transaction Logs ===\n");
  for (const log of receipt.logs) {
    console.log("Log address:", log.address);
    console.log("  Topics:", log.topics.length);
    console.log("  Data length:", log.data.length);
  }
}

main().catch(console.error);


