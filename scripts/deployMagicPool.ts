import hardhat, { ethers } from "hardhat";

/**
 * Deploy MagicPool contracts on Sonic (Hub chain)
 * - MIMToken
 * - MIMMinter (handles minting + V3 LP)
 * - StakingVault (sMIM)
 * - ZeroILVault (wETH and wBTC)
 * - ZeroILStrategy (for each vault)
 */

// Sonic contract addresses
const SONIC_CONTRACTS = {
  // Existing deployed contracts
  sUSDC: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B",
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  sWBTC: "0x2F0324268031E6413280F3B5ddBc4A97639A284a",
  
  // Uniswap V3 contracts
  positionManager: "0x5826e10B513C891910032F15292B2F1b3041C3Df",
  v3Factory: "0x3a1713B6C3734cfC883A3897647f3128Fe789f39",
};

// Initial prices in USD (6 decimals)
const INITIAL_PRICES = {
  sWETH: 3400_000000, // $3400
  sWBTC: 97000_000000, // $97000
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = hardhat.network.name;

  console.log(`\n========================================`);
  console.log(`Deploying MagicPool contracts to ${network}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(await deployer.getBalance())} S`);
  console.log(`========================================\n`);

  // 1. Deploy MIMToken
  console.log("1. Deploying MIMToken...");
  const MIMToken = await ethers.getContractFactory("MIMToken");
  const mimToken = await MIMToken.deploy({ gasLimit: 2000000 });
  await mimToken.deployed();
  console.log(`   ✅ MIMToken deployed to: ${mimToken.address}`);

  // 2. Deploy MIMMinter
  console.log("\n2. Deploying MIMMinter...");
  const MIMMinter = await ethers.getContractFactory("MIMMinter");
  const mimMinter = await MIMMinter.deploy(
    mimToken.address,
    SONIC_CONTRACTS.sUSDC,
    SONIC_CONTRACTS.positionManager,
    SONIC_CONTRACTS.v3Factory,
    { gasLimit: 3000000 }
  );
  await mimMinter.deployed();
  console.log(`   ✅ MIMMinter deployed to: ${mimMinter.address}`);

  // 3. Authorize MIMMinter to mint MIM
  console.log("\n3. Setting MIMMinter as authorized minter...");
  const setMinterTx = await mimToken.setMinter(mimMinter.address, true);
  await setMinterTx.wait();
  console.log(`   ✅ MIMMinter authorized`);

  // 4. Deploy StakingVault (sMIM)
  console.log("\n4. Deploying StakingVault (sMIM)...");
  const StakingVault = await ethers.getContractFactory("StakingVault");
  const stakingVault = await StakingVault.deploy(mimToken.address, { gasLimit: 4000000 });
  await stakingVault.deployed();
  console.log(`   ✅ StakingVault deployed to: ${stakingVault.address}`);

  // 5. Deploy Zero IL Vault for sWETH
  console.log("\n5. Deploying ZeroILVault for sWETH...");
  const ZeroILVault = await ethers.getContractFactory("ZeroILVault");
  const wethVault = await ZeroILVault.deploy(
    SONIC_CONTRACTS.sWETH,
    "Wrapped sWETH Zero IL",
    "wsWETH",
    stakingVault.address,
    mimToken.address,
    INITIAL_PRICES.sWETH,
    { gasLimit: 4000000 }
  );
  await wethVault.deployed();
  console.log(`   ✅ ZeroILVault (sWETH) deployed to: ${wethVault.address}`);

  // 6. Deploy Zero IL Vault for sWBTC
  console.log("\n6. Deploying ZeroILVault for sWBTC...");
  const wbtcVault = await ZeroILVault.deploy(
    SONIC_CONTRACTS.sWBTC,
    "Wrapped sWBTC Zero IL",
    "wsWBTC",
    stakingVault.address,
    mimToken.address,
    INITIAL_PRICES.sWBTC,
    { gasLimit: 4000000 }
  );
  await wbtcVault.deployed();
  console.log(`   ✅ ZeroILVault (sWBTC) deployed to: ${wbtcVault.address}`);

  // 7. Deploy Zero IL Strategy for sWETH
  console.log("\n7. Deploying ZeroILStrategy for sWETH...");
  const ZeroILStrategy = await ethers.getContractFactory("ZeroILStrategy");
  const wethStrategy = await ZeroILStrategy.deploy(
    SONIC_CONTRACTS.positionManager,
    SONIC_CONTRACTS.v3Factory,
    SONIC_CONTRACTS.sWETH,
    mimToken.address,
    { gasLimit: 3000000 }
  );
  await wethStrategy.deployed();
  console.log(`   ✅ ZeroILStrategy (sWETH) deployed to: ${wethStrategy.address}`);

  // 8. Deploy Zero IL Strategy for sWBTC
  console.log("\n8. Deploying ZeroILStrategy for sWBTC...");
  const wbtcStrategy = await ZeroILStrategy.deploy(
    SONIC_CONTRACTS.positionManager,
    SONIC_CONTRACTS.v3Factory,
    SONIC_CONTRACTS.sWBTC,
    mimToken.address,
    { gasLimit: 3000000 }
  );
  await wbtcStrategy.deployed();
  console.log(`   ✅ ZeroILStrategy (sWBTC) deployed to: ${wbtcStrategy.address}`);

  // 9. Configure vaults with strategies
  console.log("\n9. Configuring vaults with strategies...");
  
  const setWethStrategyTx = await wethVault.setStrategy(wethStrategy.address);
  await setWethStrategyTx.wait();
  console.log(`   ✅ sWETH vault strategy set`);
  
  const setWbtcStrategyTx = await wbtcVault.setStrategy(wbtcStrategy.address);
  await setWbtcStrategyTx.wait();
  console.log(`   ✅ sWBTC vault strategy set`);

  // 10. Configure strategies with vaults
  console.log("\n10. Configuring strategies with vaults...");
  
  const setWethVaultTx = await wethStrategy.setVault(wethVault.address);
  await setWethVaultTx.wait();
  console.log(`   ✅ sWETH strategy vault set`);
  
  const setWbtcVaultTx = await wbtcStrategy.setVault(wbtcVault.address);
  await setWbtcVaultTx.wait();
  console.log(`   ✅ sWBTC strategy vault set`);

  // 11. Authorize vaults as borrowers in StakingVault
  console.log("\n11. Authorizing vaults as borrowers...");
  
  const authWethTx = await stakingVault.setBorrower(wethVault.address, true);
  await authWethTx.wait();
  console.log(`   ✅ sWETH vault authorized as borrower`);
  
  const authWbtcTx = await stakingVault.setBorrower(wbtcVault.address, true);
  await authWbtcTx.wait();
  console.log(`   ✅ sWBTC vault authorized as borrower`);

  // Summary
  console.log(`\n========================================`);
  console.log(`MAGICPOOL DEPLOYMENT COMPLETE`);
  console.log(`========================================`);
  console.log(`Network: ${network}`);
  console.log(`\nCore Contracts:`);
  console.log(`  MIMToken:        ${mimToken.address}`);
  console.log(`  MIMMinter:       ${mimMinter.address}`);
  console.log(`  StakingVault:    ${stakingVault.address}`);
  console.log(`\nZero IL Vaults:`);
  console.log(`  wethVault:       ${wethVault.address}`);
  console.log(`  wbtcVault:       ${wbtcVault.address}`);
  console.log(`\nZero IL Strategies:`);
  console.log(`  wethStrategy:    ${wethStrategy.address}`);
  console.log(`  wbtcStrategy:    ${wbtcStrategy.address}`);
  console.log(`========================================\n`);

  // Return addresses for config update
  return {
    mimToken: mimToken.address,
    mimMinter: mimMinter.address,
    stakingVault: stakingVault.address,
    wethVault: wethVault.address,
    wbtcVault: wbtcVault.address,
    wethStrategy: wethStrategy.address,
    wbtcStrategy: wbtcStrategy.address,
  };
}

main()
  .then((addresses) => {
    console.log("Deployment addresses for config:");
    console.log(JSON.stringify(addresses, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

