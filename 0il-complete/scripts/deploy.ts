/**
 * 0IL Complete Protocol Deployment Script
 *
 * Deploys all fixed contracts and sets up the complete protocol
 *
 * Run: npx hardhat run 0il-complete/scripts/deploy.ts --network sonic
 */

import { ethers } from 'hardhat';

// Configuration
const CONFIG = {
  // Existing infrastructure on Sonic
  sUSDC: '0x29219dd400f2Bf60E5a23d13Be72B486D4038894',
  sWETH: '0x50c42dEAcD8Fc9773493ED674b675bE577f2634b',

  // Uniswap V3 on Sonic
  positionManager: '0x5826e10B513C891910032F15292B2F1b3041C3Df',
  v3Factory: '0x3a1713B6C3734cfC883A3897647f3128Fe789f39',

  // Treasury - UPDATE THIS
  treasury: '0x0000000000000000000000000000000000000000',

  // Initial seed amounts
  initialSUSDC: ethers.utils.parseUnits('1000', 6), // 1000 sUSDC
};

interface DeployedContracts {
  mimToken: string;
  mimMinter: string;
  stakingVault: string;
  leverageAMM: string;
  v3LPVault: string;
  oracle: string;
  gateway: string;
}

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(`
  ╔═══════════════════════════════════════════════════════════════╗
  ║       0IL COMPLETE PROTOCOL DEPLOYMENT                        ║
  ║                                                               ║
  ║  All bugs fixed, 7-hour cycle for testing                     ║
  ╚═══════════════════════════════════════════════════════════════╝
  `);

  console.log(`Deployer: ${deployer.address}`);
  console.log(`Network: Sonic (Chain ID: 146)`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  // Verify treasury is set
  if (CONFIG.treasury === '0x0000000000000000000000000000000000000000') {
    console.error('ERROR: Please set the treasury address in CONFIG!');
    process.exit(1);
  }

  const deployed: DeployedContracts = {
    mimToken: '',
    mimMinter: '',
    stakingVault: '',
    leverageAMM: '',
    v3LPVault: '',
    oracle: '',
    gateway: '',
  };

  // ============ 1. Deploy MIM Token ============
  console.log('1. Deploying MIMTokenFixed...');
  const MIMToken = await ethers.getContractFactory('MIMTokenFixed');
  const mimToken = await MIMToken.deploy({ gasLimit: 3_000_000 });
  await mimToken.deployed();
  deployed.mimToken = mimToken.address;
  console.log(`   ✅ MIMTokenFixed: ${mimToken.address}`);

  // ============ 2. Deploy MIM Minter ============
  console.log('2. Deploying MIMMinterFixed...');
  const MIMMinter = await ethers.getContractFactory('MIMMinterFixed');
  const mimMinter = await MIMMinter.deploy(
    deployed.mimToken,
    CONFIG.sUSDC,
    CONFIG.positionManager,
    CONFIG.v3Factory,
    { gasLimit: 5_000_000 }
  );
  await mimMinter.deployed();
  deployed.mimMinter = mimMinter.address;
  console.log(`   ✅ MIMMinterFixed: ${mimMinter.address}`);

  // Set minter authorization
  console.log('   Setting minter authorization...');
  await mimToken.setMinter(mimMinter.address, true);
  console.log('   ✅ MIMMinter authorized');

  // ============ 3. Deploy Oracle ============
  console.log('3. Deploying SimpleOracleFixed...');
  const Oracle = await ethers.getContractFactory('SimpleOracleFixed');
  const oracle = await Oracle.deploy({ gasLimit: 3_000_000 });
  await oracle.deployed();
  deployed.oracle = oracle.address;
  console.log(`   ✅ SimpleOracleFixed: ${oracle.address}`);

  // ============ 4. Deploy Staking Vault ============
  console.log('4. Deploying MIMStakingVaultComplete...');
  const StakingVault = await ethers.getContractFactory('MIMStakingVaultComplete');
  const stakingVault = await StakingVault.deploy(
    deployed.mimToken,
    CONFIG.treasury,
    { gasLimit: 5_000_000 }
  );
  await stakingVault.deployed();
  deployed.stakingVault = stakingVault.address;
  console.log(`   ✅ MIMStakingVaultComplete: ${stakingVault.address}`);

  // Set staking vault as minter
  console.log('   Setting staking vault as minter...');
  await mimToken.setMinter(stakingVault.address, true);
  console.log('   ✅ StakingVault authorized');

  // ============ 5. Deploy V3 LP Vault ============
  console.log('5. Deploying V3LPVaultFixed...');
  // We need a pool address first - for now use placeholder
  // In production, create or find the MIM/sWETH pool
  const V3LPVault = await ethers.getContractFactory('V3LPVaultFixed');
  // Placeholder - would need actual pool
  // const v3LPVault = await V3LPVault.deploy(CONFIG.positionManager, poolAddress);
  console.log('   ⚠️  V3LPVault deployment skipped - needs pool address');

  // ============ 6. Deploy Leverage AMM ============
  console.log('6. Deploying LeverageAMMComplete...');
  const LeverageAMM = await ethers.getContractFactory('LeverageAMMComplete');
  // Would need v3LPVault address
  console.log('   ⚠️  LeverageAMM deployment skipped - needs V3LPVault');

  // ============ 7. Deploy Gateway ============
  console.log('7. Deploying GatewayVaultComplete...');
  const Gateway = await ethers.getContractFactory('GatewayVaultComplete');
  const gateway = await Gateway.deploy({ gasLimit: 3_000_000 });
  await gateway.deployed();
  deployed.gateway = gateway.address;
  console.log(`   ✅ GatewayVaultComplete: ${gateway.address}`);

  // Enable tokens on gateway
  console.log('   Enabling tokens on gateway...');
  await gateway.enableToken(CONFIG.sUSDC, ethers.utils.parseUnits('1', 6));
  await gateway.enableToken(CONFIG.sWETH, ethers.utils.parseUnits('0.001', 18));
  console.log('   ✅ Tokens enabled');

  // ============ Summary ============
  console.log(`
  ╔═══════════════════════════════════════════════════════════════╗
  ║                    DEPLOYMENT COMPLETE                         ║
  ╚═══════════════════════════════════════════════════════════════╝

  Deployed Contracts:
  ├── MIMTokenFixed:            ${deployed.mimToken}
  ├── MIMMinterFixed:           ${deployed.mimMinter}
  ├── MIMStakingVaultComplete:  ${deployed.stakingVault}
  ├── SimpleOracleFixed:        ${deployed.oracle}
  ├── GatewayVaultComplete:     ${deployed.gateway}
  ├── V3LPVaultFixed:           (needs pool - manual deploy)
  └── LeverageAMMComplete:      (needs V3LPVault - manual deploy)

  Configuration:
  ├── Cycle Duration: 7 hours (testing mode)
  ├── Treasury: ${CONFIG.treasury}
  └── Network: Sonic (146)

  Next Steps:
  1. Create MIM/sWETH V3 pool
  2. Deploy V3LPVaultFixed with pool address
  3. Deploy LeverageAMMComplete with V3LPVault
  4. Set up keeper bot with deployed addresses
  5. Initialize pool with seed liquidity
  `);

  // Save deployment info
  const fs = require('fs');
  fs.writeFileSync(
    '0il-complete/deployments.json',
    JSON.stringify(deployed, null, 2)
  );
  console.log('Deployment info saved to 0il-complete/deployments.json');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Deployment failed:', error);
    process.exit(1);
  });
