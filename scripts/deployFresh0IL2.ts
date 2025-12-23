import { ethers } from "hardhat";

// Existing infrastructure (DO NOT CHANGE)
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7"; // Correct sMIM vault
const SIMPLE_ORACLE = "0xB09aEeBe0E3DFca9F8fEA8F050F7D4b5f70DcF20";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const SWETH_MIM_POOL = "0x4ed3B3e2AD7e19124D921fE2F6956e1C62Cbf190";
const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";
const EXISTING_V3_VAULT = "0x825Bccfba2a8814996c5ea91701885Bd6A7025d6"; // Already deployed
const EXISTING_AMM = "0x45b825A072e0eE39c524c79964a534C9806e2E17"; // Already deployed

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Deploy Fresh 0IL Stack v16 ===");
  console.log("Deployer:", signer.address);
  console.log("");

  // Check pool exists
  const pool = new ethers.Contract(SWETH_MIM_POOL, [
    "function slot0() view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)",
    "function token0() view returns (address)",
    "function token1() view returns (address)"
  ], signer);

  console.log("Checking pool...");
  const [sqrtPrice, tick] = await pool.slot0();
  console.log("Pool sqrtPriceX96:", sqrtPrice.toString());
  console.log("Pool tick:", tick);
  console.log("Pool token0:", await pool.token0());
  console.log("Pool token1:", await pool.token1());

  // 1. Use existing V3LPVault or deploy new one
  console.log("\n1. Using existing V3LPVault...");
  const V3LPVault = await ethers.getContractFactory("V3LPVault");
  const v3Vault = V3LPVault.attach(EXISTING_V3_VAULT);
  console.log("   V3LPVault:", v3Vault.address);

  // 2. Deploy LeverageAMM with correct StakingVault
  console.log("2. Deploying LeverageAMM...");
  const LeverageAMM = await ethers.getContractFactory("LeverageAMM");
  const leverageAMM = await LeverageAMM.deploy(
    SWETH,           // underlying
    MIM,             // mim
    STAKING_VAULT,   // staking vault (correct address)
    v3Vault.address, // v3LPVault
    SIMPLE_ORACLE,   // oracle
    { gasLimit: 3000000 }
  );
  await leverageAMM.deployed();
  console.log("   LeverageAMM:", leverageAMM.address);

  // 3. Deploy WToken (name, symbol, underlying, leverageAMM, v3LPVault)
  console.log("3. Deploying WToken...");
  const WToken = await ethers.getContractFactory("WToken");
  const wToken = await WToken.deploy(
    "Wagmi Zero-IL ETH",  // name
    "wETH",               // symbol
    SWETH,                // underlying asset
    leverageAMM.address,  // leverageAMM
    v3Vault.address,      // v3LPVault
    { gasLimit: 3000000 }
  );
  await wToken.deployed();
  console.log("   WToken:", wToken.address);

  // 4. Configure V3LPVault
  console.log("4. Configuring V3LPVault...");
  await (await v3Vault.setOperator(leverageAMM.address, true)).wait();
  console.log("   LeverageAMM set as operator");

  await (await v3Vault.setDefaultLayers()).wait();
  console.log("   Default layers set");

  // 5. Configure LeverageAMM
  console.log("5. Configuring LeverageAMM...");
  await (await leverageAMM.setWToken(wToken.address)).wait();
  console.log("   WToken set");

  // 6. Authorize LeverageAMM as borrower
  console.log("6. Authorizing LeverageAMM as borrower...");
  const stakingVault = new ethers.Contract(STAKING_VAULT, [
    "function setBorrower(address, bool) external",
    "function isBorrower(address) view returns (bool)"
  ], signer);
  
  await (await stakingVault.setBorrower(leverageAMM.address, true)).wait();
  console.log("   LeverageAMM authorized:", await stakingVault.isBorrower(leverageAMM.address));

  // Print summary
  console.log("\n=== Deployment Summary (v16) ===");
  console.log("V3LPVault:", v3Vault.address);
  console.log("LeverageAMM:", leverageAMM.address);
  console.log("WToken:", wToken.address);
}

main().catch(console.error);
