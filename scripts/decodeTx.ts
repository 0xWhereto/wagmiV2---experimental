import { ethers } from "hardhat";

const TX_HASH = "0x149fd13ad40089d2f39aa13d5703450cb158c58b91c18f66e09de57deb8b2f81";

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  const tx = await provider.getTransaction(TX_HASH);
  
  // Get GatewayVault interface
  const Gateway = await ethers.getContractFactory("GatewayVault");
  const iface = Gateway.interface;
  
  console.log("=== Decoding Failed Transaction ===\n");
  
  try {
    const decoded = iface.parseTransaction({ data: tx.data, value: tx.value });
    console.log(`Function: ${decoded.name}`);
    console.log(`\nArguments:`);
    console.log(`  recipient: ${decoded.args[0]}`);
    console.log(`  tokenAmounts: ${JSON.stringify(decoded.args[1].map((t: any) => ({
      token: t[0],
      amount: t[1].toString()
    })), null, 2)}`);
    console.log(`  options: ${decoded.args[2]}`);
    
    // Check the token
    const token = decoded.args[1][0][0];
    const amount = decoded.args[1][0][1];
    
    console.log(`\n=== Checking Token ===`);
    console.log(`Token: ${token}`);
    console.log(`Amount: ${ethers.utils.formatUnits(amount, 18)} (assuming 18 decimals)`);
    
    // Check if token is registered on gateway
    const gatewayAbi = [
      "function getAllAvailableTokenByAddress(address) view returns (tuple(bool onPause, int8 decimalsDelta, address syntheticTokenAddress, address tokenAddress, uint8 tokenDecimals, string tokenSymbol, uint256 tokenBalance))",
      "function getAllAvailableTokens() view returns (tuple(bool onPause, int8 decimalsDelta, address syntheticTokenAddress, address tokenAddress, uint8 tokenDecimals, string tokenSymbol, uint256 tokenBalance)[])",
    ];
    
    const gateway = new ethers.Contract(tx.to!, gatewayAbi, provider);
    
    // Get all tokens
    const tokens = await gateway.getAllAvailableTokens();
    console.log(`\nGateway has ${tokens.length} tokens:`);
    for (const t of tokens) {
      console.log(`  ${t.tokenSymbol}: ${t.tokenAddress}`);
      if (t.tokenAddress.toLowerCase() === token.toLowerCase()) {
        console.log(`    ✅ FOUND - syntheticToken: ${t.syntheticTokenAddress}`);
        console.log(`    onPause: ${t.onPause}`);
      }
    }
    
    // Try to get specific token
    try {
      const tokenInfo = await gateway.getAllAvailableTokenByAddress(token);
      console.log(`\nToken info:`);
      console.log(`  Symbol: ${tokenInfo.tokenSymbol}`);
      console.log(`  Synthetic: ${tokenInfo.syntheticTokenAddress}`);
      console.log(`  On Pause: ${tokenInfo.onPause}`);
    } catch (e: any) {
      console.log(`\n❌ Token not found in gateway: ${e.message?.substring(0, 50)}`);
    }
    
  } catch (e: any) {
    console.log(`Error decoding: ${e.message}`);
  }
}

main().catch(console.error);
