import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  
  const vault = new ethers.Contract("0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7", [
    "function mim() view returns (address)",
    "function convertToShares(uint256) view returns (uint256)",
    "function deposit(uint256) returns (uint256)", // Only takes 1 arg
  ], signer);
  
  console.log("mim:", await vault.mim());
  console.log("convertToShares(1 MIM):", ethers.utils.formatEther(await vault.convertToShares(ethers.utils.parseEther("1"))));
  
  // Test deposit
  const mim = new ethers.Contract("0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708", [
    "function approve(address,uint256) returns (bool)",
    "function balanceOf(address) view returns (uint256)",
  ], signer);
  
  const bal = await mim.balanceOf(signer.address);
  console.log("MIM balance:", ethers.utils.formatEther(bal));
  
  // Approve
  await (await mim.approve(vault.address, ethers.constants.MaxUint256)).wait();
  console.log("Approved");
  
  // Deposit 1 MIM (only 1 argument!)
  const tx = await vault.deposit(ethers.utils.parseEther("1"), { gasLimit: 500000 });
  await tx.wait();
  console.log("Deposit succeeded!");
  
  const vaultBal = await new ethers.Contract(vault.address, ["function balanceOf(address) view returns (uint256)"], signer).balanceOf(signer.address);
  console.log("sMIM balance:", ethers.utils.formatEther(vaultBal));
}

main().catch(console.error);

