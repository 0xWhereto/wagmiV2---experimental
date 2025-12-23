import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const sUSDC = "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B";
const sWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const ARB_EID = 30110;

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Bridge Tokens Back to Arbitrum ===\n");
  
  const hub = new ethers.Contract(HUB, [
    "function bridgeTokens(address recipient, address syntheticToken, uint256 amount, uint32 dstEid, bytes calldata lzOptions) external payable",
    "function quoteBridgeTokens(address syntheticToken, uint256 amount, uint32 dstEid, bytes calldata lzOptions) external view returns (uint256 nativeFee, uint256 lzTokenFee)"
  ], signer);
  
  // LZ Options for 500k gas
  const lzOptions = ethers.utils.solidityPack(
    ["uint16", "uint8", "uint16", "uint8", "uint128"],
    [3, 1, 17, 1, 500000]
  );
  
  // Get sUSDC balance
  const susdcToken = new ethers.Contract(sUSDC, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)"
  ], signer);
  
  const swethToken = new ethers.Contract(sWETH, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)"
  ], signer);
  
  const susdcBal = await susdcToken.balanceOf(signer.address);
  const swethBal = await swethToken.balanceOf(signer.address);
  
  console.log("sUSDC balance:", ethers.utils.formatUnits(susdcBal, 6));
  console.log("sWETH balance:", ethers.utils.formatEther(swethBal));
  
  if (susdcBal.gt(0)) {
    console.log("\n1. Bridging sUSDC back to Arbitrum...");
    try {
      const quote = await hub.quoteBridgeTokens(sUSDC, susdcBal, ARB_EID, lzOptions);
      console.log("   Fee:", ethers.utils.formatEther(quote.nativeFee), "S");
      
      const tx = await hub.bridgeTokens(
        signer.address,
        sUSDC,
        susdcBal,
        ARB_EID,
        lzOptions,
        { value: quote.nativeFee, gasLimit: 500000 }
      );
      const receipt = await tx.wait();
      console.log("   ✓ Tx:", receipt.transactionHash);
    } catch (e: any) {
      console.log("   ✗ Error:", e.reason || e.message?.slice(0, 100));
    }
  }
  
  if (swethBal.gt(0)) {
    console.log("\n2. Bridging sWETH back to Arbitrum...");
    try {
      const quote = await hub.quoteBridgeTokens(sWETH, swethBal, ARB_EID, lzOptions);
      console.log("   Fee:", ethers.utils.formatEther(quote.nativeFee), "S");
      
      const tx = await hub.bridgeTokens(
        signer.address,
        sWETH,
        swethBal,
        ARB_EID,
        lzOptions,
        { value: quote.nativeFee, gasLimit: 500000 }
      );
      const receipt = await tx.wait();
      console.log("   ✓ Tx:", receipt.transactionHash);
    } catch (e: any) {
      console.log("   ✗ Error:", e.reason || e.message?.slice(0, 100));
    }
  }
  
  console.log("\n✓ Bridging initiated. Tokens should arrive on Arbitrum in ~1-2 minutes.");
}
main().catch(console.error);
