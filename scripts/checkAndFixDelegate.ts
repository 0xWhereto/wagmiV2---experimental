import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const SONIC_ENDPOINT = "0xe1844c5D63a9543023008D332Bd3d2e6f1FE1043";

async function main() {
  console.log("=== CHECKING DELEGATE ===\n");
  
  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);
  
  const hub = await ethers.getContractAt("SyntheticTokenHub", HUB);
  
  // Check endpoint on Hub
  const hubEndpoint = await hub.endpoint();
  console.log(`Hub's endpoint: ${hubEndpoint}`);
  
  // Try to set delegate via Hub's setDelegate if it exists
  const hubAbi = [
    "function setDelegate(address _delegate)",
    "function endpoint() view returns (address)",
  ];
  
  const hubContract = new ethers.Contract(HUB, hubAbi, signer);
  
  console.log("\nTrying to set delegate...");
  try {
    const tx = await hubContract.setDelegate(signer.address);
    await tx.wait();
    console.log("✅ Delegate set!");
  } catch (e: any) {
    console.log(`Error: ${e.reason || e.message?.slice(0, 100)}`);
  }
}

main().catch(console.error);
