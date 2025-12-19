import { ethers } from "hardhat";

async function testQuote(name: string, rpc: string, gateway: string, token: string) {
  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const USER = "0x4151E05ABe56192e2A6775612C2020509Fd50637";
  
  const iface = new ethers.utils.Interface([
    "function quoteDeposit(address _recipient, (address token, uint256 amount)[] _tokenAmounts, bytes _options) view returns (uint256 nativeFee, uint256 lzTokenFee)"
  ]);
  
  const calldata = iface.encodeFunctionData("quoteDeposit", [
    USER,
    [[token, ethers.utils.parseUnits("2", 6)]],
    "0x0003010011010000000000000000000000000007a120"
  ]);
  
  console.log(`${name}:`);
  
  try {
    const result = await provider.call({ to: gateway, data: calldata });
    const decoded = ethers.BigNumber.from(result.slice(0, 66));
    console.log(`  ✅ Quote: ${ethers.utils.formatEther(decoded)} ETH`);
  } catch (e: any) {
    console.log(`  ❌ Error: ${e.data || e.message?.substring(0, 100)}`);
    
    if (e.data) {
      try {
        if (e.data.startsWith("0x08c379a0")) {
          const decoded = ethers.utils.defaultAbiCoder.decode(["string"], "0x" + e.data.slice(10));
          console.log(`  Error message: ${decoded[0]}`);
        }
      } catch {}
    }
  }
}

async function main() {
  console.log("=== DEBUG QUOTES ===\n");
  
  await testQuote(
    "Arbitrum",
    "https://arb1.arbitrum.io/rpc",
    "0x527f843672C4CD7F45B126f3E1E82D60A741C609",
    "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
  );
  
  await testQuote(
    "Ethereum",
    "https://ethereum-rpc.publicnode.com",
    "0x5826e10B513C891910032F15292B2F1b3041C3Df",
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
  );
}

main().catch(console.error);
