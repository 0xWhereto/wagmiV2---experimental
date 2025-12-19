import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

// Remote tokens on Arbitrum
const ARB_TOKENS = {
  WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  WBTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
  USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
};

async function main() {
  const [deployer] = await ethers.getSigners();

  const hubAbi = [
    "function getSyntheticByRemoteAddress(uint32 srcEid, address remoteAddress) view returns (address)",
  ];
  const hub = new ethers.Contract(HUB_ADDRESS, hubAbi, deployer);

  console.log("Checking if Arbitrum (EID 30110) tokens are already linked...\n");

  for (const [name, addr] of Object.entries(ARB_TOKENS)) {
    try {
      const synthetic = await hub.getSyntheticByRemoteAddress(30110, addr);
      console.log(`${name} (${addr}) -> ${synthetic}`);
      if (synthetic !== ethers.constants.AddressZero) {
        console.log(`  Already linked!`);
      }
    } catch (e: any) {
      console.log(`${name}: Error - ${e.message?.substring(0, 80)}`);
    }
  }

  console.log("\n\nChecking Ethereum (EID 30101)...\n");
  const ETH_TOKENS = {
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  };

  for (const [name, addr] of Object.entries(ETH_TOKENS)) {
    try {
      const synthetic = await hub.getSyntheticByRemoteAddress(30101, addr);
      console.log(`${name} (${addr}) -> ${synthetic}`);
      if (synthetic !== ethers.constants.AddressZero) {
        console.log(`  Already linked!`);
      }
    } catch (e: any) {
      console.log(`${name}: Error - ${e.message?.substring(0, 80)}`);
    }
  }
}

main().catch(console.error);
