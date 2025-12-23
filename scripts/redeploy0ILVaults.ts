/**
 * Redeploy 0IL Vault components with correct MIM and StakingVault
 */

import { ethers } from "hardhat";

const CORRECT_ADDRESSES = {
  // Correct MIM and StakingVault
  mim: "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708",
  stakingVault: "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7",
  
  // Existing infrastructure
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  swethMimPool: "0x3EF336F976a215c7b7DF4A8Fb26de5b914479dBc", // sWETH/MIM pool
  oracleAdapter: "0x5C6604099cf19021CB77F3ED1F77F5F438666ff3",
  positionManager: "0x5826e10B513C891910032F15292B2F1b3041C3Df",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  
  // 1. Deploy V3LPVault first (needed by LeverageAMM)
  console.log("\n1. Deploying V3LPVault...");
  const V3LPVault = await ethers.getContractFactory("contracts/0IL/core/V3LPVault.sol:V3LPVault");
  const v3LPVault = await V3LPVault.deploy(
    CORRECT_ADDRESSES.positionManager,
    CORRECT_ADDRESSES.swethMimPool
  );
  await v3LPVault.deployed();
  console.log("   V3LPVault:", v3LPVault.address);
  
  // 2. Deploy LeverageAMM with all 5 args
  console.log("\n2. Deploying LeverageAMM...");
  const LeverageAMM = await ethers.getContractFactory("contracts/0IL/core/LeverageAMM.sol:LeverageAMM");
  const leverageAMM = await LeverageAMM.deploy(
    CORRECT_ADDRESSES.sWETH,           // _underlyingAsset
    CORRECT_ADDRESSES.mim,             // _mim
    CORRECT_ADDRESSES.stakingVault,    // _stakingVault
    v3LPVault.address,                 // _v3LPVault
    CORRECT_ADDRESSES.oracleAdapter    // _oracle
  );
  await leverageAMM.deployed();
  console.log("   LeverageAMM:", leverageAMM.address);
  
  // 3. Deploy new WToken (wETH)
  console.log("\n3. Deploying WToken (wETH)...");
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
  
  // 4. Set LeverageAMM as minter for MIM
  console.log("\n4. Configuring permissions...");
  const mim = new ethers.Contract(CORRECT_ADDRESSES.mim, [
    "function setMinter(address,uint256) external",
  ], deployer);
  
  await (await mim.setMinter(leverageAMM.address, ethers.constants.MaxUint256)).wait();
  console.log("   LeverageAMM set as MIM minter");
  
  // 5. Verify the new wETH contract
  console.log("\n5. Verifying wETH contract...");
  const wETHCheck = new ethers.Contract(wETH.address, [
    "function underlyingAsset() view returns (address)",
    "function leverageAMM() view returns (address)",
    "function v3LPVault() view returns (address)",
  ], deployer);
  
  console.log("   underlyingAsset:", await wETHCheck.underlyingAsset());
  console.log("   leverageAMM:", await wETHCheck.leverageAMM());
  console.log("   v3LPVault:", await wETHCheck.v3LPVault());
  
  console.log("\n============================================================");
  console.log("0IL VAULT COMPONENTS REDEPLOYED");
  console.log("============================================================\n");
  
  console.log("Updated Addresses:");
  console.log(JSON.stringify({
    leverageAMM: leverageAMM.address,
    v3LPVault: v3LPVault.address,
    wETH: wETH.address,
  }, null, 2));
  
  console.log("\n--- Frontend Config Update ---");
  console.log(`leverageAMM: "${leverageAMM.address}",`);
  console.log(`v3LPVault: "${v3LPVault.address}",`);
  console.log(`wETH: "${wETH.address}",`);
}

main().catch(console.error);

