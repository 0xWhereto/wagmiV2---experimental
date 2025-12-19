import { ethers } from "hardhat";
import { EndpointId } from "@layerzerolabs/lz-definitions";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  const hubAbi = [
    "function getStorageSlotData(uint256 slot) view returns (bytes32)",
  ];
  
  const hub = new ethers.Contract(HUB_ADDRESS, hubAbi, deployer);

  // Check if WBTC on Arbitrum is already linked to any synthetic
  const srcEid = EndpointId.ARBITRUM_V2_MAINNET;
  const wbtc = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";

  // _syntheticAddressByRemoteAddress[eid][remoteAddress] at slot 8
  const eidSlot = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["uint32", "uint256"], [srcEid, 8])
  );
  const finalSlot = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["address", "bytes32"], [wbtc, eidSlot])
  );
  
  const data = await hub.getStorageSlotData(finalSlot);
  const linked = "0x" + data.slice(26);
  console.log(`WBTC on Arbitrum already linked to: ${ethers.utils.getAddress(linked)}`);
  
  // Check Ethereum too
  const ethEid = EndpointId.ETHEREUM_V2_MAINNET;
  const ethWbtc = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
  
  const eidSlot2 = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["uint32", "uint256"], [ethEid, 8])
  );
  const finalSlot2 = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["address", "bytes32"], [ethWbtc, eidSlot2])
  );
  
  const data2 = await hub.getStorageSlotData(finalSlot2);
  const linked2 = "0x" + data2.slice(26);
  console.log(`WBTC on Ethereum already linked to: ${ethers.utils.getAddress(linked2)}`);
}

main().catch(console.error);
