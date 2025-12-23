import { ethers } from "hardhat";

const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";
const POOL = "0x4ed3B3e2AD7e19124D921fE2F6956e1C62Cbf190";
const ORACLE = "0xeD77B9f54cc9ACb496916a4fED764869E927FFcb";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Deploy Clean 0IL v20 ===\n");

  // 1. Deploy fresh V3LPVault
  console.log("1. Deploying V3LPVault...");
  const V3LPVault = await ethers.getContractFactory("V3LPVault");
  const v3Vault = await V3LPVault.deploy(POSITION_MANAGER, POOL, { gasLimit: 4000000 });
  await v3Vault.deployed();
  console.log("   V3LPVault:", v3Vault.address);

  console.log("   Setting default layers...");
  await (await v3Vault.setDefaultLayers({ gasLimit: 500000 })).wait();

  // 2. Deploy LeverageAMM
  console.log("2. Deploying LeverageAMM...");
  const LeverageAMM = await ethers.getContractFactory("LeverageAMM");
  const leverageAMM = await LeverageAMM.deploy(SWETH, MIM, STAKING_VAULT, v3Vault.address, ORACLE, { gasLimit: 3500000 });
  await leverageAMM.deployed();
  console.log("   LeverageAMM:", leverageAMM.address);

  // 3. Deploy WToken
  console.log("3. Deploying WToken...");
  const WToken = await ethers.getContractFactory("WToken");
  const wToken = await WToken.deploy("Wagmi Zero-IL ETH", "wETH", SWETH, leverageAMM.address, v3Vault.address, { gasLimit: 3000000 });
  await wToken.deployed();
  console.log("   WToken:", wToken.address);

  // 4. Configure
  console.log("4. Configuring...");
  await (await v3Vault.setOperator(leverageAMM.address, true)).wait();
  await (await leverageAMM.setWToken(wToken.address)).wait();
  
  const stakingVault = new ethers.Contract(STAKING_VAULT, [
    "function setBorrower(address, bool) external"
  ], signer);
  await (await stakingVault.setBorrower(leverageAMM.address, true)).wait();

  console.log("\n=== Deployment Complete (v20) ===");
  console.log("V3LPVault:", v3Vault.address);
  console.log("LeverageAMM:", leverageAMM.address);
  console.log("WToken:", wToken.address);
}
main().catch(console.error);
