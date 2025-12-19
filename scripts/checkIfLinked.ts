import { ethers } from "hardhat";
import { EndpointId } from "@layerzerolabs/lz-definitions";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  const hubAbi = [
    "function getStorageSlotData(uint256 slot) view returns (bytes32)",
  ];
  
  const hub = new ethers.Contract(HUB_ADDRESS, hubAbi, deployer);

  // Check _syntheticAddressByRemoteAddress[srcEid][remoteTokenAddress]
  // Slot 8 is SYNTHETIC_BY_REMOTE_MAP_SLOT
  const srcEid = EndpointId.ARBITRUM_V2_MAINNET; // 30110
  const remoteToken = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"; // WETH on Arbitrum

  // Calculate nested mapping slot
  // _syntheticAddressByRemoteAddress[eid][remoteAddress]
  const eidSlot = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["uint32", "uint256"], [srcEid, 8])
  );
  const finalSlot = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["address", "bytes32"], [remoteToken, eidSlot])
  );
  
  const data = await hub.getStorageSlotData(finalSlot);
  const linkedSynthetic = "0x" + data.slice(26);
  console.log(`WETH on Arbitrum (${srcEid}) already linked to: ${ethers.utils.getAddress(linkedSynthetic)}`);
  
  // Check for old sWETH
  const oldSWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
  console.log(`Old sWETH: ${oldSWETH}`);
  
  // Also check the old gateway
  // Slot 10 is GATEWAY_VAULT_MAP_SLOT
  const gatewaySlot = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["uint32", "uint256"], [srcEid, 10])
  );
  const gatewayData = await hub.getStorageSlotData(gatewaySlot);
  const gateway = "0x" + gatewayData.slice(26);
  console.log(`Gateway for Arbitrum (${srcEid}): ${ethers.utils.getAddress(gateway)}`);
}

main().catch(console.error);
