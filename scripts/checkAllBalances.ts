import { ethers } from "hardhat";

const TOKENS = {
  sUSDC: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B",
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  sWBTC: "0x20Ca9a180b6ae1f0Ba5B6750F47b1061C49E8aFE",
  MIM: "0x9dEb5301967DD118D9F37181EB971d1136a72635",
  sMIM: "0xdeF5851B6C14559c47bf7cC98BACBeC9D31eb968",
  wETH: "0xbEd139f379B85B68f44EEd84d519d6608C090361",
};

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== All Token Balances ===");
  console.log("Wallet:", signer.address, "\n");
  
  for (const [name, addr] of Object.entries(TOKENS)) {
    try {
      const token = new ethers.Contract(addr, [
        "function balanceOf(address) view returns (uint256)",
        "function decimals() view returns (uint8)"
      ], signer);
      
      const balance = await token.balanceOf(signer.address);
      const decimals = await token.decimals();
      const formatted = ethers.utils.formatUnits(balance, decimals);
      
      if (parseFloat(formatted) > 0) {
        console.log(`${name}: ${formatted}`);
      } else {
        console.log(`${name}: 0`);
      }
    } catch (e) {
      console.log(`${name}: Error reading`);
    }
  }
  
  // Check Hub for bridgeable tokens
  console.log("\n=== Hub Synthetic Token Info ===");
  const hub = new ethers.Contract(HUB, [
    "function getSyntheticTokenByRemote(uint32 eid, address token) view returns (address)"
  ], signer);
  
  // Arbitrum EID = 30110
  const arbUSDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  const arbWETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
  const arbWBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
  
  try {
    const sUSDCAddr = await hub.getSyntheticTokenByRemote(30110, arbUSDC);
    console.log("sUSDC from Arb USDC:", sUSDCAddr);
  } catch (e) {
    console.log("Could not query hub");
  }
}
main().catch(console.error);
