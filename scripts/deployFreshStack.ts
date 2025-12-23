import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const ORACLE = "0xD8680463F66C7bF74C61A2660aF4d7094ee9F749";
const POOL = "0x4ed3B3e2AD7e19124D921fE2F6956e1C62Cbf190"; // sWETH/MIM pool
const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Deploying Fresh 0IL Stack v13 ===\n");

  // 1. Deploy fresh V3LPVault
  console.log("Deploying V3LPVault...");
  const V3LPVault = await ethers.getContractFactory("V3LPVault");
  const v3Vault = await V3LPVault.deploy(POOL, POSITION_MANAGER);
  await v3Vault.deployed();
  console.log("V3LPVault:", v3Vault.address);

  // 2. Configure layers on V3LPVault
  // Get current tick from pool
  const pool = new ethers.Contract(POOL, [
    "function slot0() view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)"
  ], signer);
  const [, currentTick] = await pool.slot0();
  console.log("Current tick:", currentTick);

  // Add layers around current tick (Curve-style concentrated liquidity)
  const tickSpacing = 10; // For 0.05% fee pool
  const baseTick = Math.floor(currentTick / tickSpacing) * tickSpacing;
  
  const layers = [
    { tickLower: baseTick - 60, tickUpper: baseTick + 60 },  // ±0.6% - tight
    { tickLower: baseTick - 300, tickUpper: baseTick + 300 }, // ±3% - medium
    { tickLower: baseTick - 600, tickUpper: baseTick + 600 }, // ±6% - wide
  ];

  console.log("Adding layers...");
  for (const layer of layers) {
    await (await v3Vault.addLayer(layer.tickLower, layer.tickUpper)).wait();
    console.log(`  Added layer: ${layer.tickLower} to ${layer.tickUpper}`);
  }

  // 3. Deploy LeverageAMM
  console.log("\nDeploying LeverageAMM...");
  const LeverageAMM = await ethers.getContractFactory("LeverageAMM");
  const amm = await LeverageAMM.deploy(SWETH, MIM, STAKING_VAULT, v3Vault.address, ORACLE);
  await amm.deployed();
  console.log("LeverageAMM:", amm.address);

  // 4. Deploy WToken
  console.log("\nDeploying WToken...");
  const WToken = await ethers.getContractFactory("WToken");
  const wToken = await WToken.deploy("wETH Zero-IL", "wETH", SWETH, amm.address, v3Vault.address);
  await wToken.deployed();
  console.log("WToken:", wToken.address);

  // 5. Configure permissions
  console.log("\nConfiguring permissions...");
  await (await amm.setWToken(wToken.address)).wait();
  
  const stakingVault = new ethers.Contract(STAKING_VAULT, [
    "function setBorrower(address, bool) external"
  ], signer);
  await (await stakingVault.setBorrower(amm.address, true)).wait();
  await (await v3Vault.setOperator(amm.address, true)).wait();

  // Revoke old LeverageAMM
  const OLD_AMM = "0x7bFddcb8fD2A4A7621f4505Ba896a99B2DeD5a3E";
  const OLD_V3 = "0x1139d155D39b2520047178444C51D3D70204650F";
  try {
    await (await stakingVault.setBorrower(OLD_AMM, false)).wait();
    const oldV3 = new ethers.Contract(OLD_V3, ["function setOperator(address, bool) external"], signer);
    await (await oldV3.setOperator(OLD_AMM, false)).wait();
  } catch {}

  console.log("\n=== Deployment Complete ===");
  console.log("\nNew addresses:");
  console.log(`  v3LPVault: "${v3Vault.address}",`);
  console.log(`  leverageAMM: "${amm.address}",`);
  console.log(`  wETH: "${wToken.address}",`);
}

main().catch(console.error);
