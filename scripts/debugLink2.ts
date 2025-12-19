import { ethers } from "hardhat";
import { EndpointId } from "@layerzerolabs/lz-definitions";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  const hubAbi = [
    "function manualLinkRemoteToken(address _syntheticTokenAddress, uint32 _srcEid, address _remoteTokenAddress, address _gatewayVault, int8 _decimalsDelta, uint256 _minBridgeAmt) external",
    "function owner() view returns (address)",
  ];
  
  const hub = new ethers.Contract(HUB_ADDRESS, hubAbi, deployer);

  const owner = await hub.owner();
  console.log(`Hub owner: ${owner}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Is owner: ${owner.toLowerCase() === deployer.address.toLowerCase()}`);

  // Try to call staticly to get revert reason
  const params = {
    syntheticToken: "0xFEad3E66D07cEA78003504Bb8d9158D5016F0109",
    eid: EndpointId.ARBITRUM_V2_MAINNET,
    remoteToken: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    gateway: "0x7d4877d3c814f09f71fB779402D94f7fB45CA50c",
    decimalDelta: 0,
    minBridge: 0,
  };

  try {
    console.log("\nTrying callStatic...");
    await hub.callStatic.manualLinkRemoteToken(
      params.syntheticToken,
      params.eid,
      params.remoteToken,
      params.gateway,
      params.decimalDelta,
      params.minBridge
    );
    console.log("callStatic succeeded");
  } catch (e: any) {
    console.log("Revert reason:", e.reason || e.message);
    if (e.errorArgs) console.log("Error args:", e.errorArgs);
    if (e.data) console.log("Error data:", e.data);
  }
}

main().catch(console.error);
