import { ethers } from "hardhat";
import { EndpointId } from "@layerzerolabs/lz-definitions";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const GETTERS = "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e";

// Old tokens (1-4)
const OLD_TOKENS = {
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  sUSDT: "0x72dFC771E515423E5B0CD2acf703d0F7eb30bdEa",
  sUSDC: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B",
  sBTC: "0x2F0324268031E6413280F3B5ddBc4A97639A284a",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  
  const gettersAbi = [
    "function getGatewayVaultByEid(uint32 eid) view returns (address)",
    "function getRemoteAddressBySyntheticAddress(uint32 eid, address synthetic) view returns (address)",
  ];
  
  const getters = new ethers.Contract(GETTERS, gettersAbi, deployer);

  const eids = [
    { name: "Arbitrum", eid: EndpointId.ARBITRUM_V2_MAINNET },
    { name: "Ethereum", eid: EndpointId.ETHEREUM_V2_MAINNET },
  ];

  console.log("=== Current Gateway Mappings ===");
  for (const { name, eid } of eids) {
    try {
      const gateway = await getters.getGatewayVaultByEid(eid);
      console.log(`${name} (${eid}): ${gateway}`);
    } catch (e) {
      console.log(`${name}: Error reading gateway`);
    }
  }

  console.log("\n=== Token Linkages (Arbitrum) ===");
  for (const [name, addr] of Object.entries(OLD_TOKENS)) {
    try {
      const remote = await getters.getRemoteAddressBySyntheticAddress(EndpointId.ARBITRUM_V2_MAINNET, addr);
      console.log(`${name} (${addr}): ${remote}`);
    } catch (e) {
      console.log(`${name}: Not linked`);
    }
  }
}

main().catch(console.error);
