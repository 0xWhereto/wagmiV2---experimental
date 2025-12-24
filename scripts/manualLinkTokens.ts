import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const NEW_GATEWAY = "0x2d603F7B0d06Bd5f6232Afe1991aF3D103d68071";
const ARB_EID = 30110;

// Existing synthetic tokens on Hub
const sUSDC = ethers.utils.getAddress("0xa1b52ebc6e37d057e4df26b72ed89b05d60e9bd4");
const sWETH = ethers.utils.getAddress("0x50c42deacd8fc9773493ed674b675be577f2634b");
const sWBTC = ethers.utils.getAddress("0xe04496b766afbf58b968dae4c067ce6e9ec65ec5");

// Remote tokens on Arbitrum
const USDC = ethers.utils.getAddress("0xaf88d065e77c8cc2239327c5edb3a432268e5831");
const WETH = ethers.utils.getAddress("0x82af49447d8a07e3bd95bd0d56f35241523fbab1");
const WBTC = ethers.utils.getAddress("0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=== Manual Link Tokens to Hub ===");
  console.log("Owner:", deployer.address);
  
  const hub = await ethers.getContractAt("SyntheticTokenHub", HUB_ADDRESS);
  
  // Check if tokens exist
  console.log("\nChecking synthetic tokens...");
  for (const [name, addr] of [["sUSDC", sUSDC], ["sWETH", sWETH], ["sWBTC", sWBTC]]) {
    const code = await ethers.provider.getCode(addr);
    console.log(`${name} at ${addr}: ${code !== "0x" ? "EXISTS" : "NOT DEPLOYED"}`);
  }
  
  // Link tokens
  const tokens = [
    { name: "USDC", synth: sUSDC, remote: USDC, decimals: 6, synthDecimals: 6, minBridge: "1000000" },
    { name: "WETH", synth: sWETH, remote: WETH, decimals: 18, synthDecimals: 18, minBridge: "100000000000000" },
    { name: "WBTC", synth: sWBTC, remote: WBTC, decimals: 8, synthDecimals: 8, minBridge: "10000" },
  ];
  
  for (const token of tokens) {
    console.log(`\nLinking ${token.name}...`);
    try {
      // decimalsDelta = synthDecimals - remoteDecimals
      const decimalsDelta = token.synthDecimals - token.decimals;
      
      const tx = await hub.manualLinkRemoteToken(
        token.synth,      // _syntheticTokenAddress
        ARB_EID,          // _srcEid
        token.remote,     // _remoteTokenAddress
        NEW_GATEWAY,      // _gatewayVault
        decimalsDelta,    // _decimalsDelta
        token.minBridge   // _minBridgeAmt
      );
      console.log("TX:", tx.hash);
      await tx.wait();
      console.log(`✓ ${token.name} linked!`);
    } catch (e: any) {
      console.log(`✗ ${token.name} failed:`, e.reason || e.message?.slice(0, 80));
    }
  }
  
  console.log("\n✓ Done!");
}

main().catch(console.error);
