import { ethers } from "hardhat";
import { EndpointId } from "@layerzerolabs/lz-definitions";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

// Old sBTC that's not linked
const sBTC = "0x2F0324268031E6413280F3B5ddBc4A97639A284a";

// WBTC addresses
const WBTC = {
  arbitrum: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
  ethereum: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
};

const NEW_GATEWAYS = {
  arbitrum: { address: "0x7d4877d3c814f09f71fB779402D94f7fB45CA50c", eid: EndpointId.ARBITRUM_V2_MAINNET },
  ethereum: { address: "0x9cbc0a8E6AB21780498A6B2f9cdE7D487B7E5095", eid: EndpointId.ETHEREUM_V2_MAINNET },
};

const hubAbi = [
  "function manualLinkRemoteToken(address _syntheticTokenAddress, uint32 _srcEid, address _remoteTokenAddress, address _gatewayVault, int8 _decimalsDelta, uint256 _minBridgeAmt) external",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  const hub = new ethers.Contract(HUB_ADDRESS, hubAbi, deployer);

  console.log("Linking sBTC to WBTC...\n");

  // Link to Arbitrum
  console.log("Linking sBTC -> WBTC on Arbitrum...");
  try {
    const tx = await hub.manualLinkRemoteToken(
      sBTC,
      NEW_GATEWAYS.arbitrum.eid,
      WBTC.arbitrum,
      NEW_GATEWAYS.arbitrum.address,
      0, // decimals: 8 - 8 = 0
      0, // min bridge amount
      { gasLimit: 300000 }
    );
    await tx.wait();
    console.log("✅ sBTC linked to WBTC on Arbitrum");
  } catch (e: any) {
    console.log("❌ Arbitrum:", e.reason || e.message?.substring(0, 100));
  }

  // Link to Ethereum
  console.log("\nLinking sBTC -> WBTC on Ethereum...");
  try {
    const tx = await hub.manualLinkRemoteToken(
      sBTC,
      NEW_GATEWAYS.ethereum.eid,
      WBTC.ethereum,
      NEW_GATEWAYS.ethereum.address,
      0,
      0,
      { gasLimit: 300000 }
    );
    await tx.wait();
    console.log("✅ sBTC linked to WBTC on Ethereum");
  } catch (e: any) {
    console.log("❌ Ethereum:", e.reason || e.message?.substring(0, 100));
  }

  console.log("\nDone!");
}

main().catch(console.error);
