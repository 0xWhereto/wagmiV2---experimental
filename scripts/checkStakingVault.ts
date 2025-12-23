import { ethers } from "hardhat";

const STAKING_VAULT = "0xBdBAd1ae9B2Ba67A1E0d8E6DD8eEcf4a7A52c8d5";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Check Staking Vault ===\n");

  // Check if it's a contract
  const code = await ethers.provider.getCode(STAKING_VAULT);
  console.log("Contract code length:", code.length);
  console.log("Is a contract:", code.length > 2);

  // Try to get storage
  const slot0 = await ethers.provider.getStorageAt(STAKING_VAULT, 0);
  console.log("Storage slot 0:", slot0);

  // Try calling some basic functions
  const contract = new ethers.Contract(STAKING_VAULT, [
    "function owner() view returns (address)",
    "function mim() view returns (address)",
    "function totalSupply() view returns (uint256)"
  ], signer);

  try {
    const owner = await contract.owner();
    console.log("Owner:", owner);
  } catch (e: any) {
    console.log("owner() failed:", e.message?.slice(0, 100));
  }

  try {
    const mim = await contract.mim();
    console.log("MIM:", mim);
  } catch (e: any) {
    console.log("mim() failed:", e.message?.slice(0, 100));
  }

  try {
    const totalSupply = await contract.totalSupply();
    console.log("Total supply:", ethers.utils.formatUnits(totalSupply, 18));
  } catch (e: any) {
    console.log("totalSupply() failed:", e.message?.slice(0, 100));
  }
}
main().catch(console.error);
