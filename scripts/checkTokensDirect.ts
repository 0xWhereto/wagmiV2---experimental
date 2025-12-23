import { ethers } from "hardhat";

// Known token addresses from our config
const TOKENS = {
  sUSDC: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B",
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  TestMIM: "0x9dEb5301967DD118D9F37181EB971d1136a72635",
  sMIM: "0xdeF5851B6C14559c47bf7cC98BACBeC9D31eb968",
};

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Check Tokens Directly ===\n");
  console.log("Wallet:", signer.address);
  
  for (const [name, addr] of Object.entries(TOKENS)) {
    console.log(`\n${name} (${addr}):`);
    try {
      const token = new ethers.Contract(addr, [
        "function balanceOf(address) view returns (uint256)",
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
        "function name() view returns (string)"
      ], signer);
      
      const symbol = await token.symbol();
      const decimals = await token.decimals();
      const balance = await token.balanceOf(signer.address);
      console.log("   Symbol:", symbol);
      console.log("   Decimals:", decimals);
      console.log("   Balance:", ethers.utils.formatUnits(balance, decimals));
    } catch (e: any) {
      console.log("   Error:", e.message?.slice(0, 80));
    }
  }
  
  // Check TestMIM contract type
  console.log("\n=== TestMIM Contract Check ===");
  const mim = new ethers.Contract(TOKENS.TestMIM, [
    "function owner() view returns (address)",
    "function mint(address,uint256)",
    "function mintWithUSDC(uint256)"
  ], signer);
  
  try {
    const owner = await mim.owner();
    console.log("Owner:", owner);
    console.log("Is owner:", owner.toLowerCase() === signer.address.toLowerCase());
  } catch (e) {
    console.log("No owner function");
  }
  
  // Check if mintWithUSDC exists
  try {
    await mim.callStatic.mintWithUSDC(1);
    console.log("mintWithUSDC: EXISTS");
  } catch (e: any) {
    if (e.message?.includes("is not a function")) {
      console.log("mintWithUSDC: DOES NOT EXIST");
    } else {
      console.log("mintWithUSDC: EXISTS but reverts");
    }
  }
}
main().catch(console.error);
