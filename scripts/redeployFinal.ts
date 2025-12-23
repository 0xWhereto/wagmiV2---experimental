import { ethers } from "hardhat";

const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const V3_VAULT = "0x825Bccfba2a8814996c5ea91701885Bd6A7025d6";
const NEW_ORACLE = "0xeD77B9f54cc9ACb496916a4fED764869E927FFcb";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Redeploy 0IL Stack (Final) ===\n");

  // 1. Deploy LeverageAMM
  console.log("1. Deploying LeverageAMM...");
  const LeverageAMM = await ethers.getContractFactory("LeverageAMM");
  const leverageAMM = await LeverageAMM.deploy(
    SWETH,
    MIM,
    STAKING_VAULT,
    V3_VAULT,
    NEW_ORACLE,
    { gasLimit: 3000000 }
  );
  await leverageAMM.deployed();
  console.log("   LeverageAMM:", leverageAMM.address);

  // 2. Deploy WToken
  console.log("2. Deploying WToken...");
  const WToken = await ethers.getContractFactory("WToken");
  const wToken = await WToken.deploy(
    "Wagmi Zero-IL ETH",
    "wETH",
    SWETH,
    leverageAMM.address,
    V3_VAULT,
    { gasLimit: 3000000 }
  );
  await wToken.deployed();
  console.log("   WToken:", wToken.address);

  // 3. Configure V3LPVault
  console.log("3. Setting LeverageAMM as V3 operator...");
  const V3LPVault = await ethers.getContractFactory("V3LPVault");
  const v3Vault = V3LPVault.attach(V3_VAULT);
  await (await v3Vault.setOperator(leverageAMM.address, true)).wait();

  // 4. Set WToken in LeverageAMM
  console.log("4. Setting WToken in LeverageAMM...");
  await (await leverageAMM.setWToken(wToken.address)).wait();

  // 5. Authorize borrower
  console.log("5. Authorizing LeverageAMM as borrower...");
  const stakingVault = new ethers.Contract(STAKING_VAULT, [
    "function setBorrower(address, bool) external",
    "function isBorrower(address) view returns (bool)"
  ], signer);
  await (await stakingVault.setBorrower(leverageAMM.address, true)).wait();
  console.log("   Authorized:", await stakingVault.isBorrower(leverageAMM.address));

  console.log("\n=== Deployment Complete ===");
  console.log("LeverageAMM:", leverageAMM.address);
  console.log("WToken:", wToken.address);
  console.log("Oracle:", NEW_ORACLE);
}
main().catch(console.error);
