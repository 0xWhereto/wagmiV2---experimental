import { ethers } from "hardhat";

const TX_HASH = "0xec604d5305efa9457ef40b08ece2fa0e71e5e9a0518596b38dbb53c1a4aca72c";
const MIM = "0x9dEb5301967DD118D9F37181EB971d1136a72635";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Debug MIM Mint Failure ===\n");
  
  const mim = new ethers.Contract(MIM, [
    "function name() view returns (string)",
    "function owner() view returns (address)",
    "function usdc() view returns (address)",
    "function pool() view returns (address)",
    "function mintWithUSDC(uint256) external",
    "function mint(address,uint256) external"
  ], signer);
  
  console.log("1. MIM Contract Info:");
  try {
    console.log("   Name:", await mim.name());
    console.log("   Owner:", await mim.owner());
    console.log("   USDC:", await mim.usdc());
    console.log("   Pool:", await mim.pool());
  } catch (e: any) {
    console.log("   Error reading config:", e.message?.slice(0, 100));
  }
  
  // Check if this is TestMIM (owner-mintable) or real MIM (USDC-backed)
  console.log("\n2. Contract type check:");
  try {
    // TestMIM has mint(address,uint256) but not mintWithUSDC
    const code = await ethers.provider.getCode(MIM);
    console.log("   Code size:", code.length / 2 - 1, "bytes");
    
    // Try to call mintWithUSDC staticly
    await mim.callStatic.mintWithUSDC(ethers.utils.parseEther("1"));
    console.log("   mintWithUSDC: EXISTS");
  } catch (e: any) {
    console.log("   mintWithUSDC: REVERTS -", e.reason || e.message?.slice(0, 80));
  }
  
  console.log("\n3. Is owner mint only?");
  console.log("   Your address:", signer.address);
  try {
    const owner = await mim.owner();
    console.log("   Is owner:", owner.toLowerCase() === signer.address.toLowerCase());
  } catch {
    console.log("   No owner function (not Ownable)");
  }
}
main().catch(console.error);
