/**
 * 0IL Protocol UI Simulator Test
 *
 * This script simulates user interactions through the UI to find bugs.
 * It tests both the frontend logic and contract interactions.
 *
 * Run: npx ts-node scripts/ui-simulator-test.ts
 */

import { ethers, providers, Wallet } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

// Ethers v5 compatibility
const formatUnits = ethers.utils.formatUnits;
const parseUnits = ethers.utils.parseUnits;

// ============ Configuration ============

const RPC_URL = 'https://rpc.soniclabs.com';
const CHAIN_ID = 146;

const ADDRESSES = {
  // Tokens
  MIM: '0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708',
  sUSDC: '0x29219dd400f2Bf60E5a23d13Be72B486D4038894',
  sWETH: '0x50c42dEAcD8Fc9773493ED674b675bE577f2634b',

  // 0IL Contracts
  sMIM: '0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7',
  V3LPVault: '0x1139d155D39b2520047178444C51D3D70204650F',
  LeverageAMM: '0x8CA24d00ffcF60e9ba7F67F9d41ccA28E22dF508',
  wETH: '0xEA7681f28c62AbF83DeD17eEd88D48b3BD813Af7',
  SimpleOracle: '0xD8680463F66C7bF74C61A2634aF4d7094ee9F749',

  // Swap
  SwapRouter: '0x8BbF9fF8CE8060B85DFe48d7b7E897d09418De9B',
};

// ABIs
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

const MIM_ABI = [
  ...ERC20_ABI,
  'function mintWithUSDC(uint256 usdcAmount) external',
  'function mint(address to, uint256 amount) external',
];

const SMIM_ABI = [
  ...ERC20_ABI,
  'function deposit(uint256 assets) external returns (uint256 shares)',
  'function withdraw(uint256 shares) external returns (uint256 assets)',
  'function totalAssets() view returns (uint256)',
  'function totalBorrows() view returns (uint256)',
  'function getCash() view returns (uint256)',
  'function utilizationRate() view returns (uint256)',
  'function borrowRate() view returns (uint256)',
  'function supplyRate() view returns (uint256)',
  'function convertToShares(uint256 assets) view returns (uint256)',
  'function convertToAssets(uint256 shares) view returns (uint256)',
];

const WTOKEN_ABI = [
  ...ERC20_ABI,
  'function deposit(uint256 amount, uint256 minShares) external returns (uint256 shares)',
  'function withdraw(uint256 shares, uint256 minUnderlying) external returns (uint256 underlying)',
  'function underlying() view returns (address)',
  'function leverageAMM() view returns (address)',
  'function getShareValue() view returns (uint256)',
];

const LEVERAGE_AMM_ABI = [
  'function getCurrentDTV() view returns (uint256)',
  'function getTotalLPValue() view returns (uint256)',
  'function getTotalDebt() view returns (uint256)',
  'function getEquity() view returns (uint256)',
  'function lastWeeklyPayment() view returns (uint256)',
  'function accumulatedFees() view returns (uint256)',
  'function isWeeklyPaymentDue() view returns (bool)',
  'function checkRebalance() view returns (bool needsRebalance, bool isDeleverage)',
];

const V3LP_VAULT_ABI = [
  'function getLayerCount() view returns (uint256)',
  'function getTotalAssets() view returns (uint256 amount0, uint256 amount1)',
  'function operator(address) view returns (bool)',
];

const ORACLE_ABI = [
  'function getPrice() view returns (uint256)',
];

// ============ Test Results ============

interface TestResult {
  name: string;
  category: 'UI' | 'CONTRACT' | 'INTEGRATION';
  status: 'PASS' | 'FAIL' | 'SKIP' | 'WARNING';
  message: string;
  details?: any;
  bug?: {
    id: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    description: string;
  };
}

const results: TestResult[] = [];

function logResult(result: TestResult) {
  results.push(result);
  const icon = result.status === 'PASS' ? '✅' :
               result.status === 'FAIL' ? '❌' :
               result.status === 'WARNING' ? '⚠️' : '⏭️';
  console.log(`  ${icon} [${result.category}] ${result.name}: ${result.message}`);
  if (result.bug) {
    console.log(`     🐛 ${result.bug.id} (${result.bug.severity}): ${result.bug.description}`);
  }
}

// ============ UI Simulation Tests ============

async function testUIBalanceDisplay(provider: providers.JsonRpcProvider, wallet: Wallet) {
  console.log('\n📱 UI SIMULATION: Balance Display Tests');
  console.log('─'.repeat(50));

  const mim = new ethers.Contract(ADDRESSES.MIM, ERC20_ABI, provider);
  const smim = new ethers.Contract(ADDRESSES.sMIM, ERC20_ABI, provider);
  const sWETH = new ethers.Contract(ADDRESSES.sWETH, ERC20_ABI, provider);
  const wETH = new ethers.Contract(ADDRESSES.wETH, ERC20_ABI, provider);

  // Test 1: Check decimal handling
  try {
    const mimDecimals = await mim.decimals();
    const smimDecimals = await smim.decimals();

    if (Number(mimDecimals) !== Number(smimDecimals)) {
      logResult({
        name: 'Decimal Consistency Check',
        category: 'UI',
        status: 'WARNING',
        message: `MIM: ${mimDecimals} decimals, sMIM: ${smimDecimals} decimals`,
        bug: {
          id: 'UI-BUG-001',
          severity: 'MEDIUM',
          description: 'Decimal mismatch between MIM and sMIM could cause display issues',
        },
      });
    } else {
      logResult({
        name: 'Decimal Consistency Check',
        category: 'UI',
        status: 'PASS',
        message: `Both use ${mimDecimals} decimals`,
      });
    }
  } catch (e: any) {
    logResult({
      name: 'Decimal Consistency Check',
      category: 'UI',
      status: 'FAIL',
      message: e.message,
    });
  }

  // Test 2: Check balance formatting
  try {
    const mimBalance = await mim.balanceOf(wallet.address);
    const smimBalance = await smim.balanceOf(wallet.address);
    const wETHBalance = await wETH.balanceOf(wallet.address);

    logResult({
      name: 'Balance Fetch Test',
      category: 'UI',
      status: 'PASS',
      message: `MIM: ${formatUnits(mimBalance, 6)}, sMIM: ${formatUnits(smimBalance, 18)}, wETH: ${formatUnits(wETHBalance, 18)}`,
    });
  } catch (e: any) {
    logResult({
      name: 'Balance Fetch Test',
      category: 'UI',
      status: 'FAIL',
      message: e.message,
      bug: {
        id: 'UI-BUG-002',
        severity: 'HIGH',
        description: 'Cannot fetch user balances for display',
      },
    });
  }
}

async function testUIVaultStats(provider: providers.JsonRpcProvider) {
  console.log('\n📊 UI SIMULATION: Vault Statistics Display');
  console.log('─'.repeat(50));

  const smim = new ethers.Contract(ADDRESSES.sMIM, SMIM_ABI, provider);
  const leverageAMM = new ethers.Contract(ADDRESSES.LeverageAMM, LEVERAGE_AMM_ABI, provider);
  const v3Vault = new ethers.Contract(ADDRESSES.V3LPVault, V3LP_VAULT_ABI, provider);

  // Test 1: sMIM Vault Stats
  try {
    const totalAssets = await smim.totalAssets();
    const totalBorrows = await smim.totalBorrows();
    const cash = await smim.getCash();
    const utilization = await smim.utilizationRate();
    const borrowRate = await smim.borrowRate();
    const supplyRate = await smim.supplyRate();

    logResult({
      name: 'sMIM Vault Stats',
      category: 'UI',
      status: 'PASS',
      message: `Assets: ${formatUnits(totalAssets, 6)} | Borrows: ${formatUnits(totalBorrows, 6)} | Cash: ${formatUnits(cash, 6)}`,
      details: {
        utilizationRate: `${Number(utilization) / 1e16}%`,
        borrowRate: `${Number(borrowRate) / 1e16}%`,
        supplyRate: `${Number(supplyRate) / 1e16}%`,
      },
    });
  } catch (e: any) {
    logResult({
      name: 'sMIM Vault Stats',
      category: 'UI',
      status: 'FAIL',
      message: e.message,
      bug: {
        id: 'UI-BUG-003',
        severity: 'HIGH',
        description: 'Cannot fetch sMIM vault statistics for display',
      },
    });
  }

  // Test 2: LeverageAMM Stats
  try {
    const currentDTV = await leverageAMM.getCurrentDTV();
    const lpValue = await leverageAMM.getTotalLPValue();
    const debt = await leverageAMM.getTotalDebt();
    const equity = await leverageAMM.getEquity();
    const lastPayment = await leverageAMM.lastWeeklyPayment();

    logResult({
      name: 'LeverageAMM Stats',
      category: 'UI',
      status: 'PASS',
      message: `DTV: ${Number(currentDTV) / 1e16}% | LP: ${formatUnits(lpValue, 18)} | Debt: ${formatUnits(debt, 18)}`,
      details: {
        equity: formatUnits(equity, 18),
        lastPayment: lastPayment.toString() === '0' ? 'NOT INITIALIZED' : new Date(Number(lastPayment) * 1000).toISOString(),
      },
    });

    // Check for BUG-005
    if (lastPayment.toString() === '0') {
      logResult({
        name: 'Weekly Payment Init Check',
        category: 'CONTRACT',
        status: 'FAIL',
        message: 'lastWeeklyPayment is 0 (not initialized)',
        bug: {
          id: 'BUG-005',
          severity: 'CRITICAL',
          description: 'Weekly payment timer never initialized - fee cycle broken',
        },
      });
    }
  } catch (e: any) {
    logResult({
      name: 'LeverageAMM Stats',
      category: 'UI',
      status: 'FAIL',
      message: e.message,
    });
  }

  // Test 3: V3LPVault Layer Configuration
  try {
    const layerCount = await v3Vault.getLayerCount();

    if (Number(layerCount) === 0) {
      logResult({
        name: 'V3LPVault Layer Check',
        category: 'CONTRACT',
        status: 'FAIL',
        message: 'No layers configured',
        bug: {
          id: 'BUG-007',
          severity: 'CRITICAL',
          description: 'V3LPVault has no layers - deposits will fail',
        },
      });
    } else {
      logResult({
        name: 'V3LPVault Layer Check',
        category: 'CONTRACT',
        status: 'PASS',
        message: `${layerCount} layers configured`,
      });
    }
  } catch (e: any) {
    logResult({
      name: 'V3LPVault Layer Check',
      category: 'CONTRACT',
      status: 'FAIL',
      message: e.message,
    });
  }
}

async function testUIDepositFlow(provider: providers.JsonRpcProvider, wallet: Wallet) {
  console.log('\n💰 UI SIMULATION: Deposit Flow Tests');
  console.log('─'.repeat(50));

  const smim = new ethers.Contract(ADDRESSES.sMIM, SMIM_ABI, wallet);
  const mim = new ethers.Contract(ADDRESSES.MIM, MIM_ABI, wallet);

  // Test 1: Share calculation preview
  try {
    const testAmount = parseUnits('1', 6); // 1 MIM
    const expectedShares = await smim.convertToShares(testAmount);

    logResult({
      name: 'Share Preview Calculation',
      category: 'UI',
      status: 'PASS',
      message: `1 MIM = ${formatUnits(expectedShares, 18)} sMIM shares`,
    });

    // Check for extreme ratio
    const ratio = Number(expectedShares) / Number(testAmount);
    if (ratio < 0.01 || ratio > 1e15) {
      logResult({
        name: 'Share Ratio Sanity Check',
        category: 'UI',
        status: 'WARNING',
        message: `Ratio ${ratio} may indicate decimal mismatch`,
        bug: {
          id: 'UI-BUG-004',
          severity: 'MEDIUM',
          description: 'Share to asset ratio may cause display confusion',
        },
      });
    }
  } catch (e: any) {
    logResult({
      name: 'Share Preview Calculation',
      category: 'UI',
      status: 'FAIL',
      message: e.message,
    });
  }

  // Test 2: Check approval flow
  try {
    const allowance = await mim.allowance(wallet.address, ADDRESSES.sMIM);
    logResult({
      name: 'Approval Check',
      category: 'UI',
      status: 'PASS',
      message: `Current allowance: ${formatUnits(allowance, 6)} MIM`,
    });
  } catch (e: any) {
    logResult({
      name: 'Approval Check',
      category: 'UI',
      status: 'FAIL',
      message: e.message,
    });
  }
}

async function testUIWithdrawFlow(provider: providers.JsonRpcProvider, wallet: Wallet) {
  console.log('\n💸 UI SIMULATION: Withdraw Flow Tests');
  console.log('─'.repeat(50));

  const smim = new ethers.Contract(ADDRESSES.sMIM, SMIM_ABI, provider);

  // Test 1: Check if withdrawal would fail
  try {
    const userShares = await smim.balanceOf(wallet.address);
    const cash = await smim.getCash();
    const totalAssets = await smim.totalAssets();
    const totalSupply = await smim.totalSupply();

    if (Number(userShares) > 0) {
      const assetsForShares = await smim.convertToAssets(userShares);

      if (Number(assetsForShares) > Number(cash)) {
        logResult({
          name: 'Withdrawal Feasibility Check',
          category: 'CONTRACT',
          status: 'FAIL',
          message: `User has ${formatUnits(userShares, 18)} shares worth ${formatUnits(assetsForShares, 6)} MIM but only ${formatUnits(cash, 6)} MIM available`,
          bug: {
            id: 'BUG-003',
            severity: 'CRITICAL',
            description: 'User cannot withdraw full balance - insufficient liquidity',
          },
        });
      } else {
        logResult({
          name: 'Withdrawal Feasibility Check',
          category: 'CONTRACT',
          status: 'PASS',
          message: `Sufficient liquidity for withdrawal`,
        });
      }
    } else {
      logResult({
        name: 'Withdrawal Feasibility Check',
        category: 'UI',
        status: 'SKIP',
        message: 'User has no sMIM balance',
      });
    }

    // Calculate withdrawable ratio
    const withdrawableRatio = Number(cash) / Number(totalAssets) * 100;
    logResult({
      name: 'Withdrawable Ratio',
      category: 'UI',
      status: withdrawableRatio < 50 ? 'WARNING' : 'PASS',
      message: `${withdrawableRatio.toFixed(2)}% of total assets are withdrawable`,
    });

  } catch (e: any) {
    logResult({
      name: 'Withdrawal Feasibility Check',
      category: 'CONTRACT',
      status: 'FAIL',
      message: e.message,
    });
  }
}

async function testUI0ILVaultFlow(provider: providers.JsonRpcProvider, wallet: Wallet) {
  console.log('\n🔷 UI SIMULATION: 0IL Vault (wETH) Flow Tests');
  console.log('─'.repeat(50));

  const wETH = new ethers.Contract(ADDRESSES.wETH, WTOKEN_ABI, provider);
  const sWETH = new ethers.Contract(ADDRESSES.sWETH, ERC20_ABI, provider);
  const leverageAMM = new ethers.Contract(ADDRESSES.LeverageAMM, LEVERAGE_AMM_ABI, provider);
  const v3Vault = new ethers.Contract(ADDRESSES.V3LPVault, V3LP_VAULT_ABI, provider);

  // Test 1: Check underlying asset
  try {
    const underlying = await wETH.underlying();
    logResult({
      name: 'Underlying Asset Check',
      category: 'UI',
      status: underlying.toLowerCase() === ADDRESSES.sWETH.toLowerCase() ? 'PASS' : 'FAIL',
      message: `Underlying: ${underlying}`,
    });
  } catch (e: any) {
    logResult({
      name: 'Underlying Asset Check',
      category: 'UI',
      status: 'FAIL',
      message: e.message,
    });
  }

  // Test 2: Check share value display
  try {
    const shareValue = await wETH.getShareValue();
    logResult({
      name: 'Share Value Display',
      category: 'UI',
      status: 'PASS',
      message: `1 wETH share = ${formatUnits(shareValue, 18)} sWETH`,
    });
  } catch (e: any) {
    logResult({
      name: 'Share Value Display',
      category: 'UI',
      status: 'FAIL',
      message: e.message,
    });
  }

  // Test 3: Check if deposit would work
  try {
    const layerCount = await v3Vault.getLayerCount();
    const isOperator = await v3Vault.operator(ADDRESSES.LeverageAMM);

    if (Number(layerCount) === 0) {
      logResult({
        name: 'Deposit Precondition: Layers',
        category: 'CONTRACT',
        status: 'FAIL',
        message: 'V3LPVault has no layers - deposit will fail',
        bug: {
          id: 'BUG-007',
          severity: 'CRITICAL',
          description: 'setDefaultLayers() was never called on V3LPVault',
        },
      });
    } else {
      logResult({
        name: 'Deposit Precondition: Layers',
        category: 'CONTRACT',
        status: 'PASS',
        message: `${layerCount} layers configured`,
      });
    }

    if (!isOperator) {
      logResult({
        name: 'Deposit Precondition: Operator',
        category: 'CONTRACT',
        status: 'FAIL',
        message: 'LeverageAMM is not set as operator on V3LPVault',
        bug: {
          id: 'BUG-008',
          severity: 'CRITICAL',
          description: 'LeverageAMM cannot call addLiquidity on V3LPVault',
        },
      });
    } else {
      logResult({
        name: 'Deposit Precondition: Operator',
        category: 'CONTRACT',
        status: 'PASS',
        message: 'LeverageAMM is operator',
      });
    }
  } catch (e: any) {
    logResult({
      name: 'Deposit Preconditions',
      category: 'CONTRACT',
      status: 'FAIL',
      message: e.message,
    });
  }

  // Test 4: Check rebalance status for UI
  try {
    const [needsRebalance, isDeleverage] = await leverageAMM.checkRebalance();
    const currentDTV = await leverageAMM.getCurrentDTV();

    logResult({
      name: 'Rebalance Status Display',
      category: 'UI',
      status: needsRebalance ? 'WARNING' : 'PASS',
      message: needsRebalance
        ? `Rebalance needed (${isDeleverage ? 'deleverage' : 'add leverage'}) - DTV: ${Number(currentDTV) / 1e16}%`
        : `DTV healthy at ${Number(currentDTV) / 1e16}%`,
    });
  } catch (e: any) {
    logResult({
      name: 'Rebalance Status Display',
      category: 'UI',
      status: 'FAIL',
      message: e.message,
    });
  }
}

async function testUIOraclePrice(provider: providers.JsonRpcProvider) {
  console.log('\n📈 UI SIMULATION: Price Display Tests');
  console.log('─'.repeat(50));

  const oracle = new ethers.Contract(ADDRESSES.SimpleOracle, ORACLE_ABI, provider);

  try {
    const price = await oracle.getPrice();
    const priceInUSD = Number(price) / 1e18;

    logResult({
      name: 'Oracle Price Fetch',
      category: 'UI',
      status: 'PASS',
      message: `sWETH price: $${priceInUSD.toFixed(2)}`,
    });

    // Sanity check
    if (priceInUSD < 100 || priceInUSD > 10000) {
      logResult({
        name: 'Oracle Price Sanity',
        category: 'UI',
        status: 'WARNING',
        message: `Price $${priceInUSD.toFixed(2)} seems unusual for ETH`,
      });
    }
  } catch (e: any) {
    logResult({
      name: 'Oracle Price Fetch',
      category: 'UI',
      status: 'FAIL',
      message: e.message,
      bug: {
        id: 'UI-BUG-005',
        severity: 'HIGH',
        description: 'Cannot fetch oracle price for UI display',
      },
    });
  }
}

async function testUIWeeklyFeeDisplay(provider: providers.JsonRpcProvider) {
  console.log('\n📅 UI SIMULATION: Weekly Fee Display Tests');
  console.log('─'.repeat(50));

  const leverageAMM = new ethers.Contract(ADDRESSES.LeverageAMM, LEVERAGE_AMM_ABI, provider);

  try {
    const isPaymentDue = await leverageAMM.isWeeklyPaymentDue();
    const lastPayment = await leverageAMM.lastWeeklyPayment();
    const accumulatedFees = await leverageAMM.accumulatedFees();

    logResult({
      name: 'Weekly Payment Status',
      category: 'UI',
      status: 'PASS',
      message: `Due: ${isPaymentDue} | Last: ${lastPayment.toString() === '0' ? 'NEVER' : new Date(Number(lastPayment) * 1000).toLocaleDateString()} | Fees: ${formatUnits(accumulatedFees, 18)} MIM`,
    });

    // Check if always due (BUG-005 symptom)
    if (lastPayment.toString() === '0') {
      logResult({
        name: 'Fee Cycle Status',
        category: 'CONTRACT',
        status: 'FAIL',
        message: 'Fee cycle never started due to uninitialized lastWeeklyPayment',
        bug: {
          id: 'BUG-005',
          severity: 'CRITICAL',
          description: 'isWeeklyPaymentDue() always returns true since lastWeeklyPayment = 0',
        },
      });
    }

    if (Number(accumulatedFees) === 0) {
      logResult({
        name: 'Fee Accumulation',
        category: 'CONTRACT',
        status: 'WARNING',
        message: 'No fees accumulated - likely due to no active positions',
        bug: {
          id: 'BUG-006',
          severity: 'HIGH',
          description: 'No trading fees generated - sMIM stakers earn 0% yield',
        },
      });
    }
  } catch (e: any) {
    logResult({
      name: 'Weekly Payment Status',
      category: 'UI',
      status: 'FAIL',
      message: e.message,
    });
  }
}

// ============ Main Test Runner ============

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         0IL PROTOCOL - UI SIMULATOR TEST                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nTime: ${new Date().toISOString()}`);
  console.log(`Network: Sonic (Chain ID: ${CHAIN_ID})`);

  // Setup
  const provider = new providers.JsonRpcProvider(RPC_URL);

  if (!process.env.PRIVATE_KEY) {
    console.error('\n❌ ERROR: PRIVATE_KEY not found in .env file');
    process.exit(1);
  }

  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  console.log(`Wallet: ${wallet.address}`);

  // Run all UI simulation tests
  await testUIBalanceDisplay(provider, wallet);
  await testUIVaultStats(provider);
  await testUIDepositFlow(provider, wallet);
  await testUIWithdrawFlow(provider, wallet);
  await testUI0ILVaultFlow(provider, wallet);
  await testUIOraclePrice(provider);
  await testUIWeeklyFeeDisplay(provider);

  // ============ Summary ============

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARNING').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;

  console.log(`  ✅ PASSED:   ${passed}`);
  console.log(`  ❌ FAILED:   ${failed}`);
  console.log(`  ⚠️  WARNINGS: ${warnings}`);
  console.log(`  ⏭️  SKIPPED:  ${skipped}`);
  console.log(`  📊 TOTAL:    ${results.length}`);

  // List all bugs found
  const bugs = results.filter(r => r.bug);
  if (bugs.length > 0) {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    BUGS DISCOVERED                         ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const critical = bugs.filter(r => r.bug!.severity === 'CRITICAL');
    const high = bugs.filter(r => r.bug!.severity === 'HIGH');
    const medium = bugs.filter(r => r.bug!.severity === 'MEDIUM');
    const low = bugs.filter(r => r.bug!.severity === 'LOW');

    if (critical.length > 0) {
      console.log('  🔴 CRITICAL:');
      critical.forEach(r => console.log(`     - ${r.bug!.id}: ${r.bug!.description}`));
    }

    if (high.length > 0) {
      console.log('  🟠 HIGH:');
      high.forEach(r => console.log(`     - ${r.bug!.id}: ${r.bug!.description}`));
    }

    if (medium.length > 0) {
      console.log('  🟡 MEDIUM:');
      medium.forEach(r => console.log(`     - ${r.bug!.id}: ${r.bug!.description}`));
    }

    if (low.length > 0) {
      console.log('  🟢 LOW:');
      low.forEach(r => console.log(`     - ${r.bug!.id}: ${r.bug!.description}`));
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  UI SIMULATOR TEST COMPLETE');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Return exit code based on critical failures
  const criticalBugs = bugs.filter(r => r.bug!.severity === 'CRITICAL');
  if (criticalBugs.length > 0) {
    console.log(`\n⚠️  ${criticalBugs.length} CRITICAL bugs found - review required!\n`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
