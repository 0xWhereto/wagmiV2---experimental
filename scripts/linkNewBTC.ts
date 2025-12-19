import { ethers } from "hardhat";
import { EndpointId } from "@layerzerolabs/lz-definitions";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

// Use the newest sBTC (index 11)
const sBTC = "0xcb84ade32Bb4E9053F9cA8D641bfD35Cb7Fe1f0c";
const WBTC_ARB = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
const GATEWAY_ARB = "0x7d4877d3c814f09f71fB779402D94f7fB45CA50c";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  // First verify this sBTC is registered
  const hubReadAbi = [
    "function getStorageSlotData(uint256 slot) view returns (bytes32)",
  ];
  const hubRead = new ethers.Contract(HUB_ADDRESS, hubReadAbi, deployer);
  
  const slot = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [sBTC, 7])
  );
  const indexData = await hubRead.getStorageSlotData(slot);
  const index = ethers.BigNumber.from(indexData).toNumber();
  console.log(`sBTC index: ${index}`);
  
  if (index === 0) {
    console.log("Token not registered!");
    return;
  }
  
  // Check if WBTC is already linked to this sBTC
  const eid = EndpointId.ARBITRUM_V2_MAINNET;
  const eidSlot = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["uint32", "uint256"], [eid, 8])
  );
  const wbtcSlot = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["address", "bytes32"], [WBTC_ARB, eidSlot])
  );
  const linkedData = await hubRead.getStorageSlotData(wbtcSlot);
  const linked = ethers.utils.getAddress("0x" + linkedData.slice(26));
  console.log(`WBTC on Arbitrum linked to: ${linked}`);
  
  if (linked !== ethers.constants.AddressZero) {
    console.log("WBTC already linked!");
    return;
  }
  
  // Now try to link
  const hubWriteAbi = [
    "function manualLinkRemoteToken(address, uint32, address, address, int8, uint256) external",
  ];
  const hubWrite = new ethers.Contract(HUB_ADDRESS, hubWriteAbi, deployer);
  
  console.log("\nLinking sBTC -> WBTC on Arbitrum...");
  const tx = await hubWrite.manualLinkRemoteToken(
    sBTC,
    eid,
    WBTC_ARB,
    GATEWAY_ARB,
    0,
    0,
    { gasLimit: 500000 }
  );
  console.log("Tx:", tx.hash);
  const receipt = await tx.wait();
  console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
}

main().catch((e) => console.log("Error:", e.message?.substring(0, 200)));
