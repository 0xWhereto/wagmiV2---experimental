import { ethers } from "hardhat";

const GETTERS_ADDRESS = "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e";
const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

// New gateway addresses
const NEW_GATEWAYS = {
  arbitrum: "0x7d4877d3c814f09f71fB779402D94f7fB45CA50c",
  base: "0x46102e4227f3ef07c08b19fC07A1ad79a427329D",
  ethereum: "0x9cbc0a8E6AB21780498A6B2f9cdE7D487B7E5095",
};

const EIDS = {
  arbitrum: 30110,
  base: 30184,
  ethereum: 30101,
};

async function main() {
  const [deployer] = await ethers.getSigners();

  const gettersAbi = [
    "function getGatewayVaultByEid(uint32 _eid) view returns (address)",
  ];
  const getters = new ethers.Contract(GETTERS_ADDRESS, gettersAbi, deployer);

  console.log("=== Gateway Vault Mappings on Hub ===\n");

  for (const [chain, eid] of Object.entries(EIDS)) {
    try {
      const gateway = await getters.getGatewayVaultByEid(eid);
      const newGateway = NEW_GATEWAYS[chain as keyof typeof NEW_GATEWAYS];
      console.log(`${chain.toUpperCase()} (EID ${eid}):`);
      console.log(`  Current gateway: ${gateway}`);
      console.log(`  New gateway:     ${newGateway}`);
      console.log(`  Match: ${gateway.toLowerCase() === newGateway.toLowerCase() ? "✅ YES" : "❌ NO"}`);
    } catch (e: any) {
      console.log(`${chain}: Error - ${e.message?.substring(0, 80)}`);
    }
    console.log();
  }
}

main().catch(console.error);
