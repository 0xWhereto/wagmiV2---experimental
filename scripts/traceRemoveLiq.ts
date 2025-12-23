import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const V3_VAULT = "0x5EA5C83154DeBf9AfFd3FAbCBcDeE4692b744077";
const LEVERAGE_AMM = "0xAD097f466c9eE7a556F00c43616B1c5f53d1E379";
const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Trace removeLiquidity ===\n");
  
  const V3LPVault = await ethers.getContractFactory("V3LPVault");
  const v3Vault = V3LPVault.attach(V3_VAULT);
  
  const positionManager = new ethers.Contract(POSITION_MANAGER, [
    "function positions(uint256) view returns (uint96,address,address,address,uint24,int24,int24,uint128,uint256,uint256,uint128,uint128)"
  ], signer);
  
  // Check layers
  console.log("Checking layers...");
  const layerCount = await v3Vault.getLayerCount();
  for (let i = 0; i < layerCount; i++) {
    const layer = await v3Vault.layers(i);
    const tokenId = layer[3].toNumber();
    const trackedLiquidity = layer[4];
    
    console.log(`\nLayer ${i}: tokenId=${tokenId}, tracked liquidity=${trackedLiquidity.toString()}`);
    
    if (tokenId > 0) {
      const pos = await positionManager.positions(tokenId);
      const actualLiquidity = pos[7];
      console.log(`  Actual liquidity: ${actualLiquidity.toString()}`);
      console.log(`  Match: ${trackedLiquidity.toString() === actualLiquidity.toString()}`);
    }
  }
  
  // Try calling removeLiquidity as the owner
  console.log("\n\nTesting removeLiquidity as owner...");
  
  const sweth = new ethers.Contract(SWETH, ["function balanceOf(address) view returns (uint256)"], signer);
  const mim = new ethers.Contract(MIM, ["function balanceOf(address) view returns (uint256)"], signer);
  
  const swethBefore = await sweth.balanceOf(signer.address);
  const mimBefore = await mim.balanceOf(signer.address);
  
  try {
    // Simulate as owner
    const result = await v3Vault.callStatic.removeLiquidity(10000, 0, 0, { gasLimit: 2000000 });
    console.log("Simulation SUCCESS!");
    console.log("Would receive sWETH:", ethers.utils.formatEther(result[0]));
    console.log("Would receive MIM:", ethers.utils.formatEther(result[1]));
    
    // Actually call it
    const tx = await v3Vault.removeLiquidity(10000, 0, 0, { gasLimit: 2000000 });
    await tx.wait();
    console.log("Actual call SUCCESS!");
    
    const swethAfter = await sweth.balanceOf(signer.address);
    const mimAfter = await mim.balanceOf(signer.address);
    console.log("Received sWETH:", ethers.utils.formatEther(swethAfter.sub(swethBefore)));
    console.log("Received MIM:", ethers.utils.formatEther(mimAfter.sub(mimBefore)));
  } catch (err: any) {
    console.log("FAILED:", err.reason || err.message);
    if (err.data) {
      console.log("Error data:", err.data);
    }
  }
}
main().catch(console.error);
