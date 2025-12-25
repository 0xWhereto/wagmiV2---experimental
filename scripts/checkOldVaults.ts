import { ethers } from "hardhat";

const USER = "0x4151E05ABe56192e2A6775612C2020509Fd50637";

// All old wETH vault addresses from previous deployments
const OLD_VAULTS = [
  { name: "v6", wETH: "0xdfb56F502E4Cde40BAF15Ab4d429FE991053Ade3" },
  { name: "v7", wETH: "0xB96651342aE83BfCf509659D16Fd41712B0c58b3" },
  { name: "v8a", wETH: "0xed5Ae4CA461E1871fdBa61766a5215c3ea16d9CA" },
  { name: "v8b", wETH: "0xa4E68DbaC9fB793F552e0188CE9a58Fe5F2eEC89" },
  { name: "v8c", wETH: "0x1A7c1D401048B93AA541aDb5511bE2C22813F1B8" },
  { name: "v9 (current)", wETH: "0xEA7681f28c62AbF83DeD17eEd88D48b3BD813Af7" },
];

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("Checking user:", USER);
  console.log("Signer:", signer.address);
  console.log("\n=== Old Vault Balances ===\n");
  
  for (const vault of OLD_VAULTS) {
    try {
      const wETH = new ethers.Contract(vault.wETH, [
        "function balanceOf(address) view returns (uint256)",
        "function totalSupply() view returns (uint256)",
        "function withdraw(uint256,uint256) external returns (uint256)",
        "function withdrawalsPaused() view returns (bool)",
      ], signer);
      
      const balance = await wETH.balanceOf(USER);
      const totalSupply = await wETH.totalSupply();
      
      if (balance.gt(0)) {
        console.log(`${vault.name} (${vault.wETH}):`);
        console.log(`  Balance: ${ethers.utils.formatEther(balance)} wETH`);
        console.log(`  Total Supply: ${ethers.utils.formatEther(totalSupply)} wETH`);
        
        try {
          const paused = await wETH.withdrawalsPaused();
          console.log(`  Withdrawals paused: ${paused}`);
        } catch (e) {
          console.log(`  Withdrawals paused: unknown`);
        }
        console.log("");
      }
    } catch (e: any) {
      // Skip if contract doesn't exist or has issues
    }
  }
  
  // Check sWETH balance
  const sWETH = new ethers.Contract("0x5E501C482952c1F2D58a4294F9A97759968c5125", [
    "function balanceOf(address) view returns (uint256)",
  ], signer);
  
  const sWETHBalance = await sWETH.balanceOf(USER);
  console.log("Current sWETH balance:", ethers.utils.formatEther(sWETHBalance));
}

main().catch(console.error);


