import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

// New gateway addresses
const GATEWAYS = {
  arbitrum: "0x7d4877d3c814f09f71fB779402D94f7fB45CA50c",
  ethereum: "0x9cbc0a8E6AB21780498A6B2f9cdE7D487B7E5095",
};

const EIDS = {
  arbitrum: 30110,
  ethereum: 30101,
};

// sBTC synthetic token address
const sBTC_ADDRESS = "0x2F0324268031E6413280F3B5ddBc4A97639A284a";

// WBTC on each chain
const WBTC = {
  arbitrum: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
  ethereum: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Linking WBTC with account:", deployer.address);

  const hubAbi = [
    "function manualLinkRemoteToken(address _syntheticTokenAddress, uint32 _srcEid, address _remoteTokenAddress, address _gatewayVault, int8 _decimalsDelta, uint256 _minBridgeAmt) external",
  ];
  const hub = new ethers.Contract(HUB_ADDRESS, hubAbi, deployer);

  // WBTC has 8 decimals, sBTC has 8 decimals, so delta = 0
  const decimalsDelta = 0;
  const minBridgeAmt = ethers.utils.parseUnits("0.00001", 8); // 0.00001 BTC

  for (const chain of ["arbitrum", "ethereum"] as const) {
    const gateway = GATEWAYS[chain];
    const eid = EIDS[chain];
    const wbtc = WBTC[chain];

    console.log(`\nLinking WBTC on ${chain.toUpperCase()}:`);
    console.log(`  sBTC: ${sBTC_ADDRESS}`);
    console.log(`  Remote WBTC: ${wbtc}`);
    console.log(`  Gateway: ${gateway}`);
    console.log(`  EID: ${eid}`);

    try {
      const tx = await hub.manualLinkRemoteToken(
        sBTC_ADDRESS,
        eid,
        wbtc,
        gateway,
        decimalsDelta,
        minBridgeAmt,
        { gasLimit: 500000 }
      );
      console.log(`  TX: ${tx.hash}`);
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        console.log(`  ✅ SUCCESS - WBTC linked on ${chain}, gateway updated!`);
      } else {
        console.log(`  ❌ Transaction failed`);
      }
    } catch (e: any) {
      console.log(`  ❌ Error: ${e.reason || e.message?.substring(0, 150)}`);
    }
  }
}

main().catch(console.error);
