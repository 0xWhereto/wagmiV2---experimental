import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const NEW_GATEWAY = "0x2d603F7B0d06Bd5f6232Afe1991aF3D103d68071";
const ARB_EID = 30110;

// New synthetic tokens on Sonic
const NEW_TOKENS = {
  sUSDC: "0x162996118D8075Cb7857BE331001d281474A5D8d",
  sWETH: "0x8CCb2Ef7d93716E0A5e4f392e320631a6A5e3476",
  sWBTC: "0x1B5494Dd4E8b78807ED8Bdd3666149f72A4A96bB",
};

// Remote tokens on Arbitrum
const USDC = ethers.utils.getAddress("0xaf88d065e77c8cc2239327c5edb3a432268e5831");
const WETH = ethers.utils.getAddress("0x82af49447d8a07e3bd95bd0d56f35241523fbab1");
const WBTC = ethers.utils.getAddress("0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=== Link New Tokens ===");
  console.log("Owner:", deployer.address);
  
  const hub = await ethers.getContractAt("SyntheticTokenHub", HUB_ADDRESS);
  
  const links = [
    { name: "sUSDC_new", synth: NEW_TOKENS.sUSDC, remote: USDC, minBridge: "1000000" },
    { name: "sWETH_new", synth: NEW_TOKENS.sWETH, remote: WETH, minBridge: "100000000000000" },
    { name: "sWBTC_new", synth: NEW_TOKENS.sWBTC, remote: WBTC, minBridge: "10000" },
  ];
  
  for (const link of links) {
    console.log(`\nLinking ${link.name} (${link.synth}) to ${link.remote}...`);
    try {
      const tx = await hub.manualLinkRemoteToken(
        link.synth,       // _syntheticTokenAddress
        ARB_EID,          // _srcEid
        link.remote,      // _remoteTokenAddress
        NEW_GATEWAY,      // _gatewayVault
        0,                // _decimalsDelta
        link.minBridge    // _minBridgeAmt
      );
      console.log("TX:", tx.hash);
      await tx.wait();
      console.log("✓ Linked!");
    } catch (e: any) {
      console.log("✗ Error:", e.reason || e.message?.slice(0, 100));
    }
  }
  
  console.log("\n=== Done! ===");
  console.log("New sUSDC:", NEW_TOKENS.sUSDC);
  console.log("New sWETH:", NEW_TOKENS.sWETH);
  console.log("New sWBTC:", NEW_TOKENS.sWBTC);
}

main().catch(console.error);
