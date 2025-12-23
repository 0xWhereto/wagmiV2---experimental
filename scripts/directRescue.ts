import { ethers } from "hardhat";

const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";
const V7_V3LP_VAULT = "0xd612B7C469b246bE3Ee736205bD22eE260Cb4540";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Direct rescue with:", signer.address);
  
  // Get position IDs from V3LPVault
  const v3LPVault = new ethers.Contract(V7_V3LP_VAULT, [
    "function layers(uint256) view returns (int24,int24,uint256,uint256,uint128)",
    "function getLayerCount() view returns (uint256)",
    "function owner() view returns (address)",
  ], signer);
  
  const owner = await v3LPVault.owner();
  console.log("V3LPVault owner:", owner);
  
  const layerCount = await v3LPVault.getLayerCount();
  console.log("Layer count:", layerCount.toString());
  
  // Get all token IDs
  const tokenIds = [];
  for (let i = 0; i < layerCount.toNumber(); i++) {
    const layer = await v3LPVault.layers(i);
    tokenIds.push(layer[3].toNumber());
    console.log(`  Layer ${i}: tokenId=${layer[3]}, liquidity=${ethers.utils.formatUnits(layer[4], 0)}`);
  }
  
  // Check who owns these NFTs
  const positionManager = new ethers.Contract(POSITION_MANAGER, [
    "function ownerOf(uint256) view returns (address)",
    "function positions(uint256) view returns (uint96,address,address,address,uint24,int24,int24,uint128,uint256,uint256,uint128,uint128)",
  ], signer);
  
  console.log("\nNFT Ownership:");
  for (const tokenId of tokenIds) {
    if (tokenId > 0) {
      try {
        const nftOwner = await positionManager.ownerOf(tokenId);
        console.log(`  Token ${tokenId}: owned by ${nftOwner}`);
        console.log(`    Is V3LPVault: ${nftOwner.toLowerCase() === V7_V3LP_VAULT.toLowerCase()}`);
        
        const pos = await positionManager.positions(tokenId);
        console.log(`    Liquidity: ${pos[7].toString()}`);
        console.log(`    tokensOwed0: ${pos[10].toString()}`);
        console.log(`    tokensOwed1: ${pos[11].toString()}`);
      } catch (e: any) {
        console.log(`  Token ${tokenId}: error - ${e.message?.slice(0, 50)}`);
      }
    }
  }
  
  // Check token balances in V3LPVault
  const sWETH = new ethers.Contract(SWETH, [
    "function balanceOf(address) view returns (uint256)",
  ], signer);
  const mim = new ethers.Contract(MIM, [
    "function balanceOf(address) view returns (uint256)",
  ], signer);
  
  console.log("\nTokens in V3LPVault:");
  console.log("  sWETH:", ethers.utils.formatEther(await sWETH.balanceOf(V7_V3LP_VAULT)));
  console.log("  MIM:", ethers.utils.formatEther(await mim.balanceOf(V7_V3LP_VAULT)));
}

main().catch(console.error);

