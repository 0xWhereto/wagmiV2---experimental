/**
 * Redeploy V3LPVault with correct sWETH/MIM pool
 */

import { ethers } from "hardhat";

const CORRECT_ADDRESSES = {
  positionManager: "0x5826e10B513C891910032F15292B2F1b3041C3Df",
  swethMimPool: "0x4ed3B3e2AD7e19124D921fE2F6956e1C62Cbf190", // NEW pool with NEW MIM
  leverageAMM: "0xa883C4f63b203D59769eE75900fBfE992A358f3D",
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  mim: "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708",
  stakingVault: "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7",
  oracleAdapter: "0x5C6604099cf19021CB77F3ED1F77F5F438666ff3",
  oldWETH: "0xa4E68DbaC9fB793F552e0188CE9a58Fe5F2eEC89",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  
  // 1. Deploy new V3LPVault with correct pool
  console.log("\n1. Deploying V3LPVault...");
  const V3LPVault = await ethers.getContractFactory("contracts/0IL/core/V3LPVault.sol:V3LPVault");
  const v3LPVault = await V3LPVault.deploy(
    CORRECT_ADDRESSES.positionManager,
    CORRECT_ADDRESSES.swethMimPool
  );
  await v3LPVault.deployed();
  console.log("   V3LPVault:", v3LPVault.address);
  
  // 2. Set LeverageAMM as operator
  console.log("\n2. Setting LeverageAMM as operator...");
  await (await v3LPVault.setOperator(CORRECT_ADDRESSES.leverageAMM, true)).wait();
  console.log("   Done");
  
  // 3. Configure layers
  console.log("\n3. Configuring layers...");
  try {
    await (await v3LPVault.configureLayers([10, 50, 100, 200], { gasLimit: 500000 })).wait();
    console.log("   Layers configured");
  } catch (e: any) {
    console.log("   Layers error:", e.message?.slice(0, 100));
  }
  
  // 4. Redeploy LeverageAMM with new V3LPVault
  console.log("\n4. Deploying new LeverageAMM...");
  const LeverageAMM = await ethers.getContractFactory("contracts/0IL/core/LeverageAMM.sol:LeverageAMM");
  const leverageAMM = await LeverageAMM.deploy(
    CORRECT_ADDRESSES.sWETH,
    CORRECT_ADDRESSES.mim,
    CORRECT_ADDRESSES.stakingVault,
    v3LPVault.address,
    CORRECT_ADDRESSES.oracleAdapter
  );
  await leverageAMM.deployed();
  console.log("   LeverageAMM:", leverageAMM.address);
  
  // 5. Update V3LPVault operator to new LeverageAMM
  console.log("\n5. Updating operator to new LeverageAMM...");
  await (await v3LPVault.setOperator(leverageAMM.address, true)).wait();
  console.log("   Done");
  
  // 6. Deploy new WToken
  console.log("\n6. Deploying WToken (wETH)...");
  const WToken = await ethers.getContractFactory("contracts/0IL/core/WToken.sol:WToken");
  const wETH = await WToken.deploy(
    "Zero-IL Wrapped ETH",
    "wETH",
    CORRECT_ADDRESSES.sWETH,
    leverageAMM.address,
    v3LPVault.address
  );
  await wETH.deployed();
  console.log("   wETH:", wETH.address);
  
  // 7. Set wToken in LeverageAMM
  console.log("\n7. Setting wToken in LeverageAMM...");
  await (await leverageAMM.setWToken(wETH.address)).wait();
  console.log("   Done");
  
  // 8. Set LeverageAMM as MIM minter
  console.log("\n8. Setting LeverageAMM as MIM minter...");
  const mim = new ethers.Contract(CORRECT_ADDRESSES.mim, [
    "function setMinter(address,uint256) external",
  ], deployer);
  await (await mim.setMinter(leverageAMM.address, ethers.constants.MaxUint256)).wait();
  console.log("   Done");
  
  // 9. Set LeverageAMM as borrower in StakingVault
  console.log("\n9. Setting LeverageAMM as borrower...");
  const vault = new ethers.Contract(CORRECT_ADDRESSES.stakingVault, [
    "function setBorrower(address,bool) external",
  ], deployer);
  await (await vault.setBorrower(leverageAMM.address, true)).wait();
  console.log("   Done");
  
  console.log("\n============================================================");
  console.log("0IL COMPONENTS REDEPLOYED (v3)");
  console.log("============================================================\n");
  
  console.log("Deployed Addresses:");
  console.log(JSON.stringify({
    swethMimPool: CORRECT_ADDRESSES.swethMimPool,
    v3LPVault: v3LPVault.address,
    leverageAMM: leverageAMM.address,
    wETH: wETH.address,
  }, null, 2));
  
  console.log("\n--- Frontend Config Update ---");
  console.log(`swethMimPool: "${CORRECT_ADDRESSES.swethMimPool}",`);
  console.log(`v3LPVault: "${v3LPVault.address}",`);
  console.log(`leverageAMM: "${leverageAMM.address}",`);
  console.log(`wETH: "${wETH.address}",`);
}

main().catch(console.error);


