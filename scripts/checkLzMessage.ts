import { ethers } from "hardhat";

// Check the link token message status
const LINK_TX = "0xd1d18a70bd129071b7ac91eff917634d01057557b01f60c5863f9691619e5fe9";

async function main() {
  console.log("=== CHECKING LZ MESSAGE STATUS ===\n");
  console.log("Link TX: " + LINK_TX);
  console.log("\nCheck on LayerZero Scan:");
  console.log("https://layerzeroscan.com/tx/" + LINK_TX);
  
  // Also check if WETH, USDC, USDT are already linked (would cause revert)
  const HUB_GETTERS = "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e";
  const ARBITRUM_EID = 30110;
  
  const hubGetters = await ethers.getContractAt("SyntheticTokenHubGetters", HUB_GETTERS);
  
  const tokens = [
    { name: "WETH", address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1" },
    { name: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" },
    { name: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
    { name: "WBTC", address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f" },
  ];
  
  console.log("\n--- Checking existing links on Hub ---");
  for (const t of tokens) {
    try {
      const synthetic = await hubGetters.getSyntheticAddressByRemoteAddress(ARBITRUM_EID, t.address);
      if (synthetic === ethers.constants.AddressZero) {
        console.log(`${t.name}: NOT linked`);
      } else {
        console.log(`${t.name}: linked to ${synthetic}`);
      }
    } catch (e) {
      console.log(`${t.name}: error`);
    }
  }
}

main().catch(console.error);
