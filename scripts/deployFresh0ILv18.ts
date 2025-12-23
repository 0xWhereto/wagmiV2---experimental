import { ethers } from "hardhat";

const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";
const POOL = "0x4ed3B3e2AD7e19124D921fE2F6956e1C62Cbf190"; // 0.05% sWETH/MIM pool
const ORACLE = "0xeD77B9f54cc9ACb496916a4fED764869E927FFcb";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Deploy Fresh 0IL v18 ===\n");
  console.log("Deployer:", signer.address);

  // 1. Deploy V3LPVault
  console.log("\n1. Deploying V3LPVault...");
  const V3LPVault = await ethers.getContractFactory("V3LPVault");
  const v3Vault = await V3LPVault.deploy(POSITION_MANAGER, POOL, { gasLimit: 4000000 });
  await v3Vault.deployed();
  console.log("   V3LPVault:", v3Vault.address);

  // Configure layers
  console.log("   Configuring layers...");
  const layerConfigs = [
    { tickLower: 79440, tickUpper: 80640 },  // Innermost layer
    { tickLower: 78840, tickUpper: 81240 },
    { tickLower: 77640, tickUpper: 82440 },
    { tickLower: 74040, tickUpper: 86040 },  // Outermost layer
  ];
  for (const layer of layerConfigs) {
    await (await v3Vault.addLayer(layer.tickLower, layer.tickUpper, { gasLimit: 200000 })).wait();
    console.log(`     Added layer: [${layer.tickLower}, ${layer.tickUpper}]`);
  }

  // 2. Deploy LeverageAMM
  console.log("\n2. Deploying LeverageAMM...");
  const LeverageAMM = await ethers.getContractFactory("LeverageAMM");
  const leverageAMM = await LeverageAMM.deploy(
    SWETH,
    MIM,
    STAKING_VAULT,
    v3Vault.address,
    ORACLE,
    { gasLimit: 3500000 }
  );
  await leverageAMM.deployed();
  console.log("   LeverageAMM:", leverageAMM.address);

  // 3. Deploy WToken
  console.log("\n3. Deploying WToken...");
  const WToken = await ethers.getContractFactory("WToken");
  const wToken = await WToken.deploy(
    "Wagmi Zero-IL ETH",
    "wETH",
    SWETH,
    leverageAMM.address,
    v3Vault.address,
    { gasLimit: 3000000 }
  );
  await wToken.deployed();
  console.log("   WToken:", wToken.address);

  // 4. Configure V3LPVault operator
  console.log("\n4. Setting LeverageAMM as V3 operator...");
  await (await v3Vault.setOperator(leverageAMM.address, true)).wait();
  console.log("   Operator set:", await v3Vault.isOperator(leverageAMM.address));

  // 5. Set WToken in LeverageAMM
  console.log("\n5. Setting WToken in LeverageAMM...");
  await (await leverageAMM.setWToken(wToken.address)).wait();
  console.log("   WToken set:", await leverageAMM.wToken());

  // 6. Authorize borrower
  console.log("\n6. Authorizing LeverageAMM as borrower...");
  const stakingVault = new ethers.Contract(STAKING_VAULT, [
    "function setBorrower(address, bool) external",
    "function isBorrower(address) view returns (bool)"
  ], signer);
  await (await stakingVault.setBorrower(leverageAMM.address, true)).wait();
  console.log("   Authorized:", await stakingVault.isBorrower(leverageAMM.address));

  console.log("\n=== Deployment Complete (v18) ===");
  console.log("V3LPVault:", v3Vault.address);
  console.log("LeverageAMM:", leverageAMM.address);
  console.log("WToken:", wToken.address);
  console.log("\nUpdate frontend config.ts with these addresses!");
}
main().catch(console.error);
