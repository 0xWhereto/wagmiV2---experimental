import { ethers } from "hardhat";

const TEST_MIM = "0x9dEb5301967DD118D9F37181EB971d1136a72635";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Check MIM Balances ===\n");
  console.log("Signer:", signer.address);
  
  const mim = new ethers.Contract(TEST_MIM, [
    "function balanceOf(address) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function name() view returns (string)"
  ], signer);
  
  const decimals = await mim.decimals();
  const name = await mim.name();
  const balance = await mim.balanceOf(signer.address);
  const totalSupply = await mim.totalSupply();
  
  console.log("Token:", name);
  console.log("Decimals:", decimals);
  console.log("Balance (raw):", balance.toString());
  console.log("Balance (formatted):", ethers.utils.formatUnits(balance, decimals));
  console.log("Total Supply:", ethers.utils.formatUnits(totalSupply, decimals));
}
main().catch(console.error);
