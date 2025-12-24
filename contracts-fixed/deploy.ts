/**
 * Deployment Script for Fixed 0IL Contracts
 *
 * This script deploys the fixed versions of MIMStakingVault, LeverageAMM, and V3LPVault.
 *
 * Run: npx hardhat run contracts-fixed/deploy.ts --network sonic
 *
 * After deployment, update the addresses in config.ts
 */

import { ethers } from 'hardhat';

// Current deployment addresses (for reference and connection)
const CURRENT_ADDRESSES = {
  MIM: '0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708',
  V3LPVault: '0x1139d155D39b2520047178444C51D3D70204650F',
  SimpleOracle: '0xD8680463F66C7bF74C61A2634aF4d7094ee9F749',
  sWETH: '0x50c42dEAcD8Fc9773493ED674b675bE577f2634b',
  // Uniswap V3 infrastructure (Sonic)
  PositionManager: '0x0000000000000000000000000000000000000000', // TODO: Set Sonic V3 Position Manager
  MIM_WETH_Pool: '0x0000000000000000000000000000000000000000', // TODO: Set MIM/WETH pool address
  // Treasury address - UPDATE THIS before deployment
  Treasury: '0x0000000000000000000000000000000000000000', // TODO: Set your treasury address
};

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         0IL FIXED CONTRACTS DEPLOYMENT                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nDeployer: ${deployer.address}`);
  console.log(`Network: Sonic (Chain ID: 146)`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  // Verify treasury is set
  if (CURRENT_ADDRESSES.Treasury === '0x0000000000000000000000000000000000000000') {
    console.error('ERROR: Please set the Treasury address in CURRENT_ADDRESSES before deploying!');
    process.exit(1);
  }

  // ============ Deploy MIMStakingVaultFixed ============

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Deploying MIMStakingVaultFixed (sMIM)');
  console.log('═══════════════════════════════════════════════════════════\n');

  const MIMStakingVaultFixed = await ethers.getContractFactory('MIMStakingVaultFixed');
  const stakingVault = await MIMStakingVaultFixed.deploy(
    CURRENT_ADDRESSES.MIM,
    CURRENT_ADDRESSES.Treasury,
    { gasLimit: 5_000_000 }
  );

  await stakingVault.waitForDeployment();
  const stakingVaultAddress = await stakingVault.getAddress();

  console.log(`  ✅ MIMStakingVaultFixed deployed to: ${stakingVaultAddress}`);
  console.log(`     - MIM: ${CURRENT_ADDRESSES.MIM}`);
  console.log(`     - Treasury: ${CURRENT_ADDRESSES.Treasury}`);

  // ============ Deploy LeverageAMMFixed ============

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Deploying LeverageAMMFixed');
  console.log('═══════════════════════════════════════════════════════════\n');

  const LeverageAMMFixed = await ethers.getContractFactory('LeverageAMMFixed');
  const leverageAMM = await LeverageAMMFixed.deploy(
    CURRENT_ADDRESSES.sWETH, // underlying asset (sWETH for ETH vault)
    CURRENT_ADDRESSES.MIM,
    stakingVaultAddress, // Use the new staking vault
    CURRENT_ADDRESSES.V3LPVault,
    CURRENT_ADDRESSES.SimpleOracle,
    { gasLimit: 5_000_000 }
  );

  await leverageAMM.waitForDeployment();
  const leverageAMMAddress = await leverageAMM.getAddress();

  console.log(`  ✅ LeverageAMMFixed deployed to: ${leverageAMMAddress}`);
  console.log(`     - Underlying: ${CURRENT_ADDRESSES.sWETH}`);
  console.log(`     - MIM: ${CURRENT_ADDRESSES.MIM}`);
  console.log(`     - StakingVault: ${stakingVaultAddress}`);
  console.log(`     - V3LPVault: ${CURRENT_ADDRESSES.V3LPVault}`);
  console.log(`     - Oracle: ${CURRENT_ADDRESSES.SimpleOracle}`);

  // ============ Configuration ============

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Post-Deployment Configuration');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Set LeverageAMM as borrower in StakingVault
  console.log('  Setting LeverageAMMFixed as borrower...');
  const setBorrowerTx = await stakingVault.setBorrower(leverageAMMAddress, true);
  await setBorrowerTx.wait();
  console.log('  ✅ LeverageAMMFixed set as borrower');

  // Set treasury in LeverageAMM
  console.log('  Setting treasury in LeverageAMM...');
  const setTreasuryTx = await leverageAMM.setTreasury(CURRENT_ADDRESSES.Treasury);
  await setTreasuryTx.wait();
  console.log('  ✅ Treasury set');

  // ============ Deploy V3LPVaultFixed (Optional) ============

  let v3LPVaultAddress = CURRENT_ADDRESSES.V3LPVault; // Default to existing

  if (CURRENT_ADDRESSES.PositionManager !== '0x0000000000000000000000000000000000000000' &&
      CURRENT_ADDRESSES.MIM_WETH_Pool !== '0x0000000000000000000000000000000000000000') {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  Deploying V3LPVaultFixed');
    console.log('═══════════════════════════════════════════════════════════\n');

    const V3LPVaultFixed = await ethers.getContractFactory('V3LPVaultFixed');
    const v3LPVault = await V3LPVaultFixed.deploy(
      CURRENT_ADDRESSES.PositionManager,
      CURRENT_ADDRESSES.MIM_WETH_Pool,
      { gasLimit: 5_000_000 }
    );

    await v3LPVault.waitForDeployment();
    v3LPVaultAddress = await v3LPVault.getAddress();

    console.log(`  ✅ V3LPVaultFixed deployed to: ${v3LPVaultAddress}`);
    console.log(`     - PositionManager: ${CURRENT_ADDRESSES.PositionManager}`);
    console.log(`     - Pool: ${CURRENT_ADDRESSES.MIM_WETH_Pool}`);

    // Set default layers
    console.log('  Setting default layers...');
    const setLayersTx = await v3LPVault.setDefaultLayers();
    await setLayersTx.wait();
    console.log('  ✅ Default layers set');

    // Set LeverageAMM as operator
    console.log('  Setting LeverageAMMFixed as operator...');
    const setOperatorTx = await v3LPVault.setOperator(leverageAMMAddress, true);
    await setOperatorTx.wait();
    console.log('  ✅ LeverageAMMFixed set as operator');
  } else {
    console.log('\n  ⚠️  Skipping V3LPVaultFixed deployment (PositionManager/Pool not set)');
    console.log('      Using existing V3LPVault:', CURRENT_ADDRESSES.V3LPVault);
  }

  // ============ Verification ============

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Verification');
  console.log('═══════════════════════════════════════════════════════════\n');

  const isBorrower = await stakingVault.isBorrower(leverageAMMAddress);
  const lastPayment = await leverageAMM.lastWeeklyPayment();
  const treasury = await leverageAMM.treasury();

  console.log(`  LeverageAMM is borrower: ${isBorrower ? '✅' : '❌'}`);
  console.log(`  lastWeeklyPayment initialized: ${lastPayment > 0 ? '✅' : '❌'} (${lastPayment})`);
  console.log(`  Treasury: ${treasury}`);

  // ============ Summary ============

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  DEPLOYMENT COMPLETE');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('  New Contract Addresses:');
  console.log(`    MIMStakingVaultFixed: ${stakingVaultAddress}`);
  console.log(`    LeverageAMMFixed:     ${leverageAMMAddress}`);
  console.log(`    V3LPVaultFixed:       ${v3LPVaultAddress}`);

  console.log('\n  UPDATE config.ts with these addresses:');
  console.log(`
export const FIXED_ADDRESSES = {
  MIMStakingVaultFixed: '${stakingVaultAddress}',
  LeverageAMMFixed: '${leverageAMMAddress}',
  V3LPVaultFixed: '${v3LPVaultAddress}',
  // ... rest of addresses
};
`);

  console.log('\n  REMAINING STEPS:');
  console.log('  1. Update FIXED_ADDRESSES in config.ts');
  console.log('  2. Deploy new WToken pointing to LeverageAMMFixed');
  console.log('  3. Call setWToken() on LeverageAMMFixed');
  console.log('  4. Set LeverageAMMFixed as operator on V3LPVault');
  console.log('  5. Call setDefaultLayers() on V3LPVault (if not done)');
  console.log('  6. Seed liquidity in MIMStakingVaultFixed');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Deployment failed:', error);
    process.exit(1);
  });
