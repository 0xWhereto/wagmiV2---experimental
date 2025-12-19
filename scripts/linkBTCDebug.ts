import { ethers } from "hardhat";
import { EndpointId } from "@layerzerolabs/lz-definitions";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const sBTC = "0x2F0324268031E6413280F3B5ddBc4A97639A284a";
const WBTC_ARB = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
const GATEWAY_ARB = "0x7d4877d3c814f09f71fB779402D94f7fB45CA50c";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  const hubAbi = [
    "function manualLinkRemoteToken(address, uint32, address, address, int8, uint256) external",
    "function owner() view returns (address)",
  ];
  
  const hub = new ethers.Contract(HUB_ADDRESS, hubAbi, deployer);

  // Encode the call data
  const calldata = hub.interface.encodeFunctionData("manualLinkRemoteToken", [
    sBTC,
    EndpointId.ARBITRUM_V2_MAINNET,
    WBTC_ARB,
    GATEWAY_ARB,
    0,
    0,
  ]);
  
  console.log("Call data:", calldata);
  console.log("\nSending transaction...");
  
  try {
    const tx = await deployer.sendTransaction({
      to: HUB_ADDRESS,
      data: calldata,
      gasLimit: 500000,
    });
    console.log("Tx hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
    console.log("Gas used:", receipt.gasUsed.toString());
  } catch (e: any) {
    console.log("Error:", e.message);
    if (e.receipt) {
      console.log("Receipt status:", e.receipt.status);
    }
  }
}

main().catch(console.error);
