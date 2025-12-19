import { ethers } from "hardhat";

const GATEWAY = "0x527f843672C4CD7F45B126f3E1E82D60A741C609";
const USER = "0x4151E05ABe56192e2A6775612C2020509Fd50637";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  console.log("=== Debug Quote ===\n");
  
  // First try with eth_call to get raw error data
  const iface = new ethers.utils.Interface([
    "function quoteDeposit(address _recipient, (address token, uint256 amount)[] _tokenAmounts, bytes _options) view returns (uint256 nativeFee, uint256 lzTokenFee)"
  ]);
  
  const calldata = iface.encodeFunctionData("quoteDeposit", [
    USER,
    [[USDC, ethers.utils.parseUnits("2", 6)]],
    "0x0003010011010000000000000000000000000007a120"
  ]);
  
  console.log(`Calldata: ${calldata.substring(0, 100)}...`);
  
  try {
    const result = await provider.call({
      to: GATEWAY,
      data: calldata
    });
    console.log(`Result: ${result}`);
  } catch (e: any) {
    console.log(`Error data: ${e.data || "none"}`);
    console.log(`Error message: ${e.message?.substring(0, 200)}`);
    
    // Try to decode error
    if (e.data) {
      try {
        // Common error selectors
        const errorSelectors: Record<string, string> = {
          "0x08c379a0": "Error(string)",
          "0x4e487b71": "Panic(uint256)",
        };
        
        const selector = e.data.substring(0, 10);
        console.log(`Error selector: ${selector}`);
        
        if (selector === "0x08c379a0") {
          const decoded = ethers.utils.defaultAbiCoder.decode(["string"], "0x" + e.data.substring(10));
          console.log(`Error message: ${decoded[0]}`);
        }
      } catch (decodeError) {
        console.log("Could not decode error");
      }
    }
  }
}

main().catch(console.error);
