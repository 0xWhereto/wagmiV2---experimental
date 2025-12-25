import { ethers } from "hardhat";

const GATEWAY = "0x527f843672C4CD7F45B126f3E1E82D60A741C609";
const USER = "0x4151E05ABe56192e2A6775612C2020509Fd50637";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  console.log("=== Simulating Deposit ===\n");
  
  // Check USDC allowance
  const erc20Abi = [
    "function allowance(address,address) view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
  ];
  
  const usdc = new ethers.Contract(USDC, erc20Abi, provider);
  
  const balance = await usdc.balanceOf(USER);
  const allowance = await usdc.allowance(USER, GATEWAY);
  
  console.log(`User USDC balance: ${ethers.utils.formatUnits(balance, 6)} USDC`);
  console.log(`User allowance to Gateway: ${ethers.utils.formatUnits(allowance, 6)} USDC`);
  
  if (allowance.lt(ethers.utils.parseUnits("2", 6))) {
    console.log(`\n❌ INSUFFICIENT ALLOWANCE!`);
    console.log(`The user needs to approve the Gateway to spend USDC first.`);
  }
  
  // Also check quoteDeposit
  const gatewayAbi = [
    "function quoteDeposit(address _recipient, (address token, uint256 amount)[] _tokenAmounts, bytes _options) view returns (uint256 nativeFee, uint256 lzTokenFee)",
  ];
  
  const gateway = new ethers.Contract(GATEWAY, gatewayAbi, provider);
  
  try {
    const quote = await gateway.quoteDeposit(
      USER,
      [{ token: USDC, amount: ethers.utils.parseUnits("2", 6) }],
      "0x0003010011010000000000000000000000000007a120"
    );
    console.log(`\nQuote: ${ethers.utils.formatEther(quote.nativeFee)} ETH`);
  } catch (e: any) {
    console.log(`\nQuote error: ${e.reason || e.message?.substring(0, 100)}`);
  }
}

main().catch(console.error);

