import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const WTOKEN = "0xb268a59ED33e968AB9a4eE28173644dd55B0c6BF";
const V3_VAULT = "0x825Bccfba2a8814996c5ea91701885Bd6A7025d6";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Debug V17 Deposit ===\n");
  
  const v3Vault = new ethers.Contract(V3_VAULT, [
    "function pool() view returns (address)",
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function layers(uint256) view returns (int24,int24,uint256,uint128)",
    "function isOperator(address) view returns (bool)"
  ], signer);
  
  console.log("V3LPVault pool:", await v3Vault.pool());
  console.log("token0:", await v3Vault.token0());
  console.log("token1:", await v3Vault.token1());
  console.log("Is LeverageAMM operator:", await v3Vault.isOperator("0x9cD4a897f49590d3E524d1abB828cB6673d54B8D"));
  
  // Check layers
  console.log("\nLayers:");
  for (let i = 0; i < 4; i++) {
    try {
      const layer = await v3Vault.layers(i);
      console.log(`  Layer ${i}: tickLower=${layer[0]}, tickUpper=${layer[1]}, tokenId=${layer[2].toString()}, liquidity=${layer[3].toString()}`);
    } catch {
      console.log(`  Layer ${i}: not exists`);
      break;
    }
  }
  
  // Try static call to deposit to get error message
  const wToken = new ethers.Contract(WTOKEN, [
    "function deposit(uint256) external"
  ], signer);
  
  const sweth = new ethers.Contract(SWETH, [
    "function approve(address,uint256) returns (bool)",
    "function allowance(address,address) view returns (uint256)"
  ], signer);
  
  const depositAmount = ethers.utils.parseEther("0.0005");
  
  // Ensure approval
  const allowance = await sweth.allowance(signer.address, WTOKEN);
  if (allowance.lt(depositAmount)) {
    console.log("\nApproving...");
    await (await sweth.approve(WTOKEN, ethers.constants.MaxUint256)).wait();
  }
  
  console.log("\nSimulating deposit...");
  try {
    await wToken.callStatic.deposit(depositAmount, { gasLimit: 2000000 });
    console.log("Simulation SUCCESS");
  } catch (err: any) {
    console.log("Simulation FAILED:");
    console.log("  Error:", err.reason || err.message);
    if (err.error?.message) {
      console.log("  Inner:", err.error.message);
    }
    if (err.errorArgs) {
      console.log("  Args:", err.errorArgs);
    }
  }
}
main().catch(console.error);
