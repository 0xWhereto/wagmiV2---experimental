import { ethers } from "hardhat";

async function main() {
  const errorData = "0xa0640723";
  
  // Get contract interfaces to decode
  const WToken = await ethers.getContractFactory("WToken");
  const LeverageAMM = await ethers.getContractFactory("LeverageAMM");
  const V3LPVault = await ethers.getContractFactory("V3LPVault");
  const MIMStakingVault = await ethers.getContractFactory("MIMStakingVault");
  
  // Common errors
  const errors = [
    "ZeroAmount()",
    "InsufficientShares()",
    "SlippageExceeded()",
    "DepositsPaused_()",
    "WithdrawalsPaused_()",
    "NotWToken()",
    "NotOperator()",
    "InvalidLayers()",
    "ExceedsMaxUtilization()",
    "InsufficientLiquidity(uint256,uint256)",
    "NotBorrower()",
    "ZeroShares()",
  ];
  
  for (const error of errors) {
    const selector = ethers.utils.id(error).slice(0, 10);
    console.log(`${error}: ${selector}`);
    if (selector === errorData) {
      console.log(`  ^^^ MATCH! Error is: ${error}`);
    }
  }
  
  // Also try contract-specific error parsing
  console.log("\nTrying to parse with contract interfaces...");
  
  try {
    const iface = WToken.interface;
    const decoded = iface.parseError(errorData);
    console.log("WToken error:", decoded);
  } catch {}
  
  try {
    const iface = LeverageAMM.interface;
    const decoded = iface.parseError(errorData);
    console.log("LeverageAMM error:", decoded);
  } catch {}
  
  try {
    const iface = V3LPVault.interface;
    const decoded = iface.parseError(errorData);
    console.log("V3LPVault error:", decoded);
  } catch {}
  
  try {
    const iface = MIMStakingVault.interface;
    const decoded = iface.parseError(errorData);
    console.log("MIMStakingVault error:", decoded);
  } catch {}
  
  // Check ERC20 errors
  const erc20Errors = [
    "ERC20InsufficientBalance(address,uint256,uint256)",
    "ERC20InsufficientAllowance(address,uint256,uint256)",
  ];
  for (const error of erc20Errors) {
    const selector = ethers.utils.id(error).slice(0, 10);
    console.log(`${error}: ${selector}`);
    if (selector === errorData) {
      console.log(`  ^^^ MATCH!`);
    }
  }
}
main().catch(console.error);
