import { ethers } from "hardhat";

const V3LP_VAULT = "0x1139d155D39b2520047178444C51D3D70204650F";
const LEVERAGE_AMM = "0x8CA24d00ffcF60e9ba7F67F9d41ccA28E22dF508";
const WETH_VAULT = "0xEA7681f28c62AbF83DeD17eEd88D48b3BD813Af7";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Debugging V3LPVault ===\n");

  const v3Vault = new ethers.Contract(V3LP_VAULT, [
    "function pool() view returns (address)",
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function positionManager() view returns (address)",
    "function layerCount() view returns (uint256)",
    "function layers(uint256) view returns (int24 tickLower, int24 tickUpper, uint256 tokenId)",
    "function owner() view returns (address)",
    "function operators(address) view returns (bool)",
    "function getTotalLiquidity() view returns (uint256, uint256)"
  ], signer);

  console.log("--- V3LPVault Config ---");
  
  try {
    const pool = await v3Vault.pool();
    console.log("Pool:", pool);
  } catch (e: any) {
    console.log("pool() error:", e.message?.slice(0, 100));
  }

  try {
    const token0 = await v3Vault.token0();
    console.log("Token0:", token0);
  } catch (e: any) {
    console.log("token0() error:", e.message?.slice(0, 100));
  }

  try {
    const token1 = await v3Vault.token1();
    console.log("Token1:", token1);
  } catch (e: any) {
    console.log("token1() error:", e.message?.slice(0, 100));
  }

  try {
    const pm = await v3Vault.positionManager();
    console.log("Position Manager:", pm);
  } catch (e: any) {
    console.log("positionManager() error:", e.message?.slice(0, 100));
  }

  try {
    const layerCount = await v3Vault.layerCount();
    console.log("Layer Count:", layerCount.toString());
    
    for (let i = 0; i < Number(layerCount); i++) {
      try {
        const layer = await v3Vault.layers(i);
        console.log(`Layer ${i}: tickLower=${layer.tickLower}, tickUpper=${layer.tickUpper}, tokenId=${layer.tokenId.toString()}`);
      } catch (e: any) {
        console.log(`Layer ${i} error:`, e.message?.slice(0, 100));
      }
    }
  } catch (e: any) {
    console.log("layerCount() error:", e.message?.slice(0, 100));
  }

  // Check LeverageAMM config
  console.log("\n--- LeverageAMM Config ---");
  const amm = new ethers.Contract(LEVERAGE_AMM, [
    "function v3Vault() view returns (address)",
    "function wToken() view returns (address)",
    "function stakingVault() view returns (address)",
    "function mim() view returns (address)",
    "function oracle() view returns (address)",
    "function closePosition(uint256 shares, uint256 totalShares) external returns (uint256)"
  ], signer);

  try {
    const v3VaultAddr = await amm.v3Vault();
    console.log("v3Vault:", v3VaultAddr);
    console.log("Matches V3LP_VAULT:", v3VaultAddr.toLowerCase() === V3LP_VAULT.toLowerCase());
  } catch (e: any) {
    console.log("v3Vault() error:", e.message?.slice(0, 100));
  }

  try {
    const wToken = await amm.wToken();
    console.log("wToken:", wToken);
    console.log("Matches WETH_VAULT:", wToken.toLowerCase() === WETH_VAULT.toLowerCase());
  } catch (e: any) {
    console.log("wToken() error:", e.message?.slice(0, 100));
  }

  try {
    const oracle = await amm.oracle();
    console.log("Oracle:", oracle);
  } catch (e: any) {
    console.log("oracle() error:", e.message?.slice(0, 100));
  }

  // Try to simulate closePosition
  console.log("\n--- Testing closePosition ---");
  try {
    const shares = ethers.BigNumber.from("1253372065806160");
    const totalShares = await (new ethers.Contract(WETH_VAULT, ["function totalSupply() view returns (uint256)"], signer)).totalSupply();
    
    console.log("Shares:", ethers.utils.formatUnits(shares, 18));
    console.log("Total Shares:", ethers.utils.formatUnits(totalShares, 18));
    
    // Try callStatic
    await amm.callStatic.closePosition(shares, totalShares, { from: WETH_VAULT });
    console.log("✅ closePosition simulation passed");
  } catch (e: any) {
    console.log("❌ closePosition failed:", e.reason || e.message?.slice(0, 400));
  }

  // Check if LeverageAMM is operator of V3LPVault
  console.log("\n--- Permissions ---");
  try {
    const isOperator = await v3Vault.operators(LEVERAGE_AMM);
    console.log("LeverageAMM is V3LPVault operator:", isOperator);
  } catch (e: any) {
    console.log("operators() error:", e.message?.slice(0, 100));
  }
}

main().catch(console.error);
