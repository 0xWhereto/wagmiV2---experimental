import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const sUSDC = "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B";
const sWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const ARB_EID = 30110;

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Debug Bridge Back ===\n");
  
  const hub = new ethers.Contract(HUB, [
    "function syntheticTokens(address) view returns (bool exists, uint32 originEid, address originToken, uint8 tokenType, bool paused)",
    "function peers(uint32) view returns (bytes32)"
  ], signer);
  
  console.log("1. Checking sUSDC token info...");
  try {
    const info = await hub.syntheticTokens(sUSDC);
    console.log("   exists:", info.exists);
    console.log("   originEid:", info.originEid);
    console.log("   originToken:", info.originToken);
    console.log("   paused:", info.paused);
  } catch (e: any) {
    console.log("   Error:", e.message?.slice(0, 100));
  }
  
  console.log("\n2. Checking Arbitrum peer...");
  try {
    const peer = await hub.peers(ARB_EID);
    console.log("   peer:", peer);
    console.log("   is zero:", peer === ethers.constants.HashZero);
  } catch (e: any) {
    console.log("   Error:", e.message?.slice(0, 100));
  }
  
  console.log("\n3. Checking sUSDC approval to Hub...");
  const token = new ethers.Contract(sUSDC, [
    "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256)"
  ], signer);
  
  const allowance = await token.allowance(signer.address, HUB);
  console.log("   Allowance:", ethers.utils.formatUnits(allowance, 6));
  
  if (allowance.eq(0)) {
    console.log("   Approving...");
    await (await token.approve(HUB, ethers.constants.MaxUint256)).wait();
    console.log("   Approved");
  }
  
  console.log("\n4. Trying quote...");
  const lzOptions = ethers.utils.solidityPack(
    ["uint16", "uint8", "uint16", "uint8", "uint128"],
    [3, 1, 17, 1, 500000]
  );
  
  const hubQuote = new ethers.Contract(HUB, [
    "function quoteBridgeTokens(address,uint256,uint32,bytes) view returns (uint256,uint256)"
  ], signer);
  
  try {
    const quote = await hubQuote.quoteBridgeTokens(sUSDC, ethers.utils.parseUnits("1", 6), ARB_EID, lzOptions);
    console.log("   Quote success! Fee:", ethers.utils.formatEther(quote[0]), "S");
  } catch (e: any) {
    console.log("   Quote failed:", e.reason || e.message?.slice(0, 150));
  }
}
main().catch(console.error);
