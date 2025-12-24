import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Network
  rpcUrl: process.env.RPC_URL || 'https://rpc.soniclabs.com',
  chainId: 146,

  // Keeper wallet
  privateKey: process.env.PRIVATE_KEY || '',

  // Contract addresses - UPDATE AFTER DEPLOYMENT
  contracts: {
    stakingVault: process.env.STAKING_VAULT || '0x0000000000000000000000000000000000000000',
    leverageAMM: process.env.LEVERAGE_AMM || '0x0000000000000000000000000000000000000000',
    v3LPVault: process.env.V3LP_VAULT || '0x0000000000000000000000000000000000000000',
  },

  // Keeper settings
  keeper: {
    // Check interval in ms (every 5 minutes)
    checkInterval: 5 * 60 * 1000,

    // Cycle duration (7 hours for testing, would be 7 days in production)
    cycleDuration: 7 * 60 * 60, // 7 hours in seconds

    // Gas settings
    maxGasPrice: '100', // gwei
    gasLimit: 500000,

    // Retry settings
    maxRetries: 3,
    retryDelay: 30000, // 30 seconds
  },

  // API settings
  api: {
    port: process.env.PORT || 3002,
    corsOrigins: ['http://localhost:3000', 'http://localhost:4000'],
  },

  // Database
  db: {
    path: process.env.DB_PATH || './data/keeper.json',
  },
};

// Contract ABIs
export const ABIS = {
  stakingVault: [
    'function isCyclePaymentDue() view returns (bool)',
    'function timeUntilNextCycle() view returns (uint256)',
    'function processCyclePayment()',
    'function getCash() view returns (uint256)',
    'function totalBorrows() view returns (uint256)',
    'function utilizationRate() view returns (uint256)',
    'function borrowRate() view returns (uint256)',
    'function supplyRate() view returns (uint256)',
    'function lastCyclePayment() view returns (uint256)',
  ],
  leverageAMM: [
    'function isCyclePaymentDue() view returns (bool)',
    'function checkRebalance() view returns (bool needsRebalance, bool isDeleverage)',
    'function getCurrentDTV() view returns (uint256)',
    'function getTotalLPValue() view returns (uint256)',
    'function totalDebt() view returns (uint256)',
    'function accumulatedFees() view returns (uint256)',
    'function getExpectedCycleInterest() view returns (uint256)',
    'function canPayFullInterest() view returns (bool canPay, uint256 shortfall)',
    'function processCyclePayment()',
    'function rebalance()',
    'function collectAllFees() returns (uint256, uint256)',
    'function lastCyclePayment() view returns (uint256)',
  ],
  v3LPVault: [
    'function getTotalAssets() view returns (uint256, uint256)',
    'function getPendingFees() view returns (uint256, uint256)',
    'function collectFees() returns (uint256, uint256)',
    'function getLayerCount() view returns (uint256)',
  ],
};
