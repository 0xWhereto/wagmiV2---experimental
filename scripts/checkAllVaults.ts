import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

// All V3LPVaults we've deployed
const ALL_V3LP_VAULTS = [
  { name: "v7", address: "0xd612B7C469b246bE3Ee736205bD22eE260Cb4540" },
  { name: "v8a", address: "0xAc2fCBDdaDe5BD1920909054B03Ad4641f971b8E" },
  { name: "v8b", address: "0x31dd8EC6773f29e361d77e51B7eEDaCaB72A2999" },
  { name: "v8c", address: "0x9a63d16Ecdf83af6bF56fF7e9cF78284d9CEA0a0" },
  { name: "v9 (current)", address: "0x1139d155D39b2520047178444C51D3D70204650F" },
];

async function main() {
  const [signer] = await ethers.getSigners();
  
  const sWETH = new ethers.Contract(SWETH, [
    "function balanceOf(address) view returns (uint256)",
  ], signer);
  
  const mim = new ethers.Contract(MIM, [
    "function balanceOf(address) view returns (uint256)",
  ], signer);
  
  console.log("=== Checking all V3LPVaults for stuck tokens ===\n");
  
  let totalSWETH = ethers.BigNumber.from(0);
  let totalMIM = ethers.BigNumber.from(0);
  
  for (const vault of ALL_V3LP_VAULTS) {
    try {
      const sWETHBal = await sWETH.balanceOf(vault.address);
      const mimBal = await mim.balanceOf(vault.address);
      
      if (sWETHBal.gt(0) || mimBal.gt(0)) {
        console.log(`${vault.name} (${vault.address}):`);
        console.log(`  sWETH: ${ethers.utils.formatEther(sWETHBal)}`);
        console.log(`  MIM: ${ethers.utils.formatEther(mimBal)}`);
        
        totalSWETH = totalSWETH.add(sWETHBal);
        totalMIM = totalMIM.add(mimBal);
        
        // Check if we're owner
        const v3LPVault = new ethers.Contract(vault.address, [
          "function owner() view returns (address)",
          "function getLayerCount() view returns (uint256)",
          "function layers(uint256) view returns (int24,int24,uint256,uint256,uint128)",
        ], signer);
        
        const owner = await v3LPVault.owner();
        console.log(`  Owner: ${owner}`);
        console.log(`  We own it: ${owner.toLowerCase() === signer.address.toLowerCase()}`);
        
        const layerCount = await v3LPVault.getLayerCount();
        let totalLiquidity = ethers.BigNumber.from(0);
        for (let i = 0; i < layerCount.toNumber(); i++) {
          const layer = await v3LPVault.layers(i);
          totalLiquidity = totalLiquidity.add(layer[4]);
        }
        console.log(`  Total liquidity: ${totalLiquidity.toString()}`);
        console.log("");
      }
    } catch (e) {
      // Skip if contract doesn't exist
    }
  }
  
  console.log("=== TOTALS ===");
  console.log(`Total sWETH stuck: ${ethers.utils.formatEther(totalSWETH)}`);
  console.log(`Total MIM stuck: ${ethers.utils.formatEther(totalMIM)}`);
  
  // Check user's current balance
  console.log("\n=== User Balance ===");
  console.log(`sWETH: ${ethers.utils.formatEther(await sWETH.balanceOf(signer.address))}`);
  console.log(`MIM: ${ethers.utils.formatEther(await mim.balanceOf(signer.address))}`);
}

main().catch(console.error);

