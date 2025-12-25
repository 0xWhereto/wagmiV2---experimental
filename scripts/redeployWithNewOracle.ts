/**
 * Redeploy 0IL stack with new SimpleOracle
 */

import { ethers } from "hardhat";

const ADDRESSES = {
  // Existing
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  mim: "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708",
  stakingVault: "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7",
  swethMimPool: "0x4ed3B3e2AD7e19124D921fE2F6956e1C62Cbf190",
  positionManager: "0x5826e10B513C891910032F15292B2F1b3041C3Df",
  
  // New oracle
  simpleOracle: "0xD8680463F66C7bF74C61A2660aF4d7094ee9F749",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  
  // 1. Deploy V3LPVault
  console.log("\n1. Deploying V3LPVault...");
  const V3LPVault = await ethers.getContractFactory("contracts/0IL/core/V3LPVault.sol:V3LPVault");
  const v3LPVault = await V3LPVault.deploy(
    ADDRESSES.positionManager,
    ADDRESSES.swethMimPool
  );
  await v3LPVault.deployed();
  console.log("   V3LPVault:", v3LPVault.address);
  
  // 2. Configure layers
  console.log("\n2. Configuring V3LPVault layers...");
  await (await v3LPVault.configureLayers(
    [10, 50, 100, 200],  // tickRanges
    [4000, 3000, 2000, 1000]  // weights (sum to 10000)
  )).wait();
  console.log("   Layers configured");
  
  // 3. Deploy LeverageAMM with new oracle
  console.log("\n3. Deploying LeverageAMM...");
  const LeverageAMM = await ethers.getContractFactory("contracts/0IL/core/LeverageAMM.sol:LeverageAMM");
  const leverageAMM = await LeverageAMM.deploy(
    ADDRESSES.sWETH,
    ADDRESSES.mim,
    ADDRESSES.stakingVault,
    v3LPVault.address,
    ADDRESSES.simpleOracle  // NEW ORACLE!
  );
  await leverageAMM.deployed();
  console.log("   LeverageAMM:", leverageAMM.address);
  
  // 4. Set LeverageAMM as V3LPVault operator
  console.log("\n4. Setting LeverageAMM as V3LPVault operator...");
  await (await v3LPVault.setOperator(leverageAMM.address, true)).wait();
  console.log("   Done");
  
  // 5. Deploy WToken
  console.log("\n5. Deploying WToken (wETH)...");
  const WToken = await ethers.getContractFactory("contracts/0IL/core/WToken.sol:WToken");
  const wETH = await WToken.deploy(
    "Zero-IL Wrapped ETH",
    "wETH",
    ADDRESSES.sWETH,
    leverageAMM.address,
    v3LPVault.address
  );
  await wETH.deployed();
  console.log("   wETH:", wETH.address);
  
  // 6. Set wToken in LeverageAMM
  console.log("\n6. Setting wToken in LeverageAMM...");
  await (await leverageAMM.setWToken(wETH.address)).wait();
  console.log("   Done");
  
  // 7. Set LeverageAMM as MIM minter
  console.log("\n7. Setting LeverageAMM as MIM minter...");
  const mim = new ethers.Contract(ADDRESSES.mim, [
    "function setMinter(address,uint256) external",
  ], deployer);
  await (await mim.setMinter(leverageAMM.address, ethers.constants.MaxUint256)).wait();
  console.log("   Done");
  
  // 8. Set LeverageAMM as borrower in StakingVault
  console.log("\n8. Setting LeverageAMM as borrower...");
  const vault = new ethers.Contract(ADDRESSES.stakingVault, [
    "function setBorrower(address,bool) external",
  ], deployer);
  await (await vault.setBorrower(leverageAMM.address, true)).wait();
  console.log("   Done");
  
  // 9. Verify oracle returns correct price
  console.log("\n9. Verifying oracle...");
  const ammPrice = await leverageAMM.getPrice();
  console.log("   LeverageAMM.getPrice():", ethers.utils.formatEther(ammPrice), "MIM per sWETH");
  
  console.log("\n============================================================");
  console.log("0IL PROTOCOL v8 DEPLOYED");
  console.log("============================================================\n");
  
  console.log("Deployed Addresses:");
  console.log(JSON.stringify({
    simpleOracle: ADDRESSES.simpleOracle,
    v3LPVault: v3LPVault.address,
    leverageAMM: leverageAMM.address,
    wETH: wETH.address,
  }, null, 2));
  
  console.log("\n--- Frontend Config Update ---");
  console.log(`oracleAdapter: "${ADDRESSES.simpleOracle}",`);
  console.log(`v3LPVault: "${v3LPVault.address}",`);
  console.log(`leverageAMM: "${leverageAMM.address}",`);
  console.log(`wETH: "${wETH.address}",`);
}

main().catch(console.error);


