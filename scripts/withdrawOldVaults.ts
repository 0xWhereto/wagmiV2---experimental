import { ethers } from "hardhat";

const OLD_VAULTS = [
  { name: "v7", wETH: "0xB96651342aE83BfCf509659D16Fd41712B0c58b3" },
  { name: "v8a", wETH: "0xed5Ae4CA461E1871fdBa61766a5215c3ea16d9CA" },
  { name: "v8c", wETH: "0x1A7c1D401048B93AA541aDb5511bE2C22813F1B8" },
];

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Withdrawing from old vaults for:", signer.address);
  
  const sWETH = new ethers.Contract("0x5E501C482952c1F2D58a4294F9A97759968c5125", [
    "function balanceOf(address) view returns (uint256)",
  ], signer);
  
  const sWETHBefore = await sWETH.balanceOf(signer.address);
  console.log("\nsWETH balance before:", ethers.utils.formatEther(sWETHBefore));
  
  let totalWithdrawn = ethers.BigNumber.from(0);
  
  for (const vault of OLD_VAULTS) {
    try {
      const wETH = new ethers.Contract(vault.wETH, [
        "function balanceOf(address) view returns (uint256)",
        "function withdraw(uint256,uint256) external returns (uint256)",
      ], signer);
      
      const balance = await wETH.balanceOf(signer.address);
      
      if (balance.gt(0)) {
        console.log(`\n${vault.name}: Withdrawing ${ethers.utils.formatEther(balance)} wETH...`);
        
        try {
          const tx = await wETH.withdraw(balance, 0, { gasLimit: 2000000 });
          await tx.wait();
          console.log(`  ✓ Withdrawn!`);
          totalWithdrawn = totalWithdrawn.add(balance);
        } catch (e: any) {
          console.log(`  ✗ Failed: ${e.reason || e.message?.slice(0, 100)}`);
        }
      }
    } catch (e: any) {
      console.log(`${vault.name}: Skip - ${e.message?.slice(0, 50)}`);
    }
  }
  
  const sWETHAfter = await sWETH.balanceOf(signer.address);
  console.log("\n=== Results ===");
  console.log("sWETH balance after:", ethers.utils.formatEther(sWETHAfter));
  console.log("sWETH received:", ethers.utils.formatEther(sWETHAfter.sub(sWETHBefore)));
}

main().catch(console.error);


