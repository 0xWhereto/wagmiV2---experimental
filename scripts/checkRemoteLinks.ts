import { ethers } from "hardhat";

const GETTERS_ADDRESS = "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e";

async function main() {
  const [deployer] = await ethers.getSigners();

  const gettersAbi = [
    "function getSyntheticAddressByRemoteAddress(uint32 _eid, address _remoteAddress) view returns (address)",
    "function getRemoteTokenInfo(address syntheticToken, uint32 eid) view returns (address remoteAddress, int8 decimalsDelta, uint256 minBridgeAmt)",
  ];
  const getters = new ethers.Contract(GETTERS_ADDRESS, gettersAbi, deployer);

  const ARB_EID = 30110;
  const ETH_EID = 30101;

  const TOKENS = {
    arbitrum: {
      WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
      WBTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
      USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    },
    ethereum: {
      WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
      USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    },
  };

  console.log("=== Checking if remote tokens are already linked ===\n");

  console.log("ARBITRUM (EID 30110):");
  for (const [name, addr] of Object.entries(TOKENS.arbitrum)) {
    try {
      const synthetic = await getters.getSyntheticAddressByRemoteAddress(ARB_EID, addr);
      console.log(`  ${name}: ${synthetic}`);
      if (synthetic !== ethers.constants.AddressZero) {
        console.log(`    ALREADY LINKED to synthetic: ${synthetic}`);
      } else {
        console.log(`    Not linked`);
      }
    } catch (e: any) {
      console.log(`  ${name}: Error - ${e.message?.substring(0, 80)}`);
    }
  }

  console.log("\nETHEREUM (EID 30101):");
  for (const [name, addr] of Object.entries(TOKENS.ethereum)) {
    try {
      const synthetic = await getters.getSyntheticAddressByRemoteAddress(ETH_EID, addr);
      console.log(`  ${name}: ${synthetic}`);
      if (synthetic !== ethers.constants.AddressZero) {
        console.log(`    ALREADY LINKED`);
      } else {
        console.log(`    Not linked`);
      }
    } catch (e: any) {
      console.log(`  ${name}: Error - ${e.message?.substring(0, 80)}`);
    }
  }
}

main().catch(console.error);
