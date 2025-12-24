/**
 * 0IL Protocol Fixed Contracts Configuration
 *
 * This file provides contract addresses and ABIs for the fixed versions
 * of MIMStakingVault and LeverageAMM contracts.
 *
 * DEPLOYMENT NOTE: After deploying the fixed contracts, update the addresses below.
 */

import MIMStakingVaultFixedABI from './abis/MIMStakingVaultFixed.json';
import LeverageAMMFixedABI from './abis/LeverageAMMFixed.json';
import V3LPVaultFixedABI from './abis/V3LPVaultFixed.json';

// ============ Chain Configuration ============

export const SONIC_CHAIN_ID = 146;

// ============ Current Deployed Addresses (Before Fix) ============

export const CURRENT_ADDRESSES = {
  // These are the currently deployed contracts (with bugs)
  MIM: '0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708',
  sMIM: '0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7',
  V3LPVault: '0x1139d155D39b2520047178444C51D3D70204650F',
  LeverageAMM: '0x8CA24d00ffcF60e9ba7F67F9d41ccA28E22dF508',
  wETH: '0xEA7681f28c62AbF83DeD17eEd88D48b3BD813Af7',
  SimpleOracle: '0xD8680463F66C7bF74C61A2634aF4d7094ee9F749',
  sUSDC: '0x29219dd400f2Bf60E5a23d13Be72B486D4038894',
  sWETH: '0x50c42dEAcD8Fc9773493ED674b675bE577f2634b',
} as const;

// ============ Fixed Contract Addresses ============
// UPDATE THESE AFTER DEPLOYING THE FIXED CONTRACTS

export const FIXED_ADDRESSES = {
  // After deploying fixed contracts, update these addresses:
  MIMStakingVaultFixed: '0x0000000000000000000000000000000000000000', // TODO: Update after deployment
  LeverageAMMFixed: '0x0000000000000000000000000000000000000000', // TODO: Update after deployment
  V3LPVaultFixed: '0x0000000000000000000000000000000000000000', // TODO: Update after deployment

  // These remain the same (no changes needed):
  MIM: CURRENT_ADDRESSES.MIM,
  V3LPVault: CURRENT_ADDRESSES.V3LPVault,
  wETH: CURRENT_ADDRESSES.wETH,
  SimpleOracle: CURRENT_ADDRESSES.SimpleOracle,
  sUSDC: CURRENT_ADDRESSES.sUSDC,
  sWETH: CURRENT_ADDRESSES.sWETH,
} as const;

// ============ ABIs ============

export const ABIS = {
  MIMStakingVaultFixed: MIMStakingVaultFixedABI.abi,
  LeverageAMMFixed: LeverageAMMFixedABI.abi,
  V3LPVaultFixed: V3LPVaultFixedABI.abi,
} as const;

// ============ Contract Configurations ============

export const CONTRACTS = {
  MIMStakingVaultFixed: {
    address: FIXED_ADDRESSES.MIMStakingVaultFixed,
    abi: ABIS.MIMStakingVaultFixed,
    chainId: SONIC_CHAIN_ID,
  },
  LeverageAMMFixed: {
    address: FIXED_ADDRESSES.LeverageAMMFixed,
    abi: ABIS.LeverageAMMFixed,
    chainId: SONIC_CHAIN_ID,
  },
  V3LPVaultFixed: {
    address: FIXED_ADDRESSES.V3LPVaultFixed,
    abi: ABIS.V3LPVaultFixed,
    chainId: SONIC_CHAIN_ID,
  },
} as const;

// ============ Protocol Constants ============

export const PROTOCOL_CONSTANTS = {
  // MIMStakingVault Constants
  WAD: BigInt('1000000000000000000'), // 1e18
  SECONDS_PER_YEAR: 31_536_000,
  SECONDS_PER_WEEK: 604_800,
  BASE_RATE: BigInt('100000000000000000'), // 0.10e18 (10%)
  MULTIPLIER: BigInt('120000000000000000'), // 0.12e18
  JUMP_MULTIPLIER: BigInt('1000000000000000000'), // 1.00e18
  KINK: BigInt('800000000000000000'), // 0.80e18 (80%)
  MAX_UTILIZATION: BigInt('900000000000000000'), // 0.90e18 (90%)
  PROTOCOL_FEE: BigInt('150000000000000000'), // 0.15e18 (15%)

  // LeverageAMM Constants
  TARGET_DTV: BigInt('500000000000000000'), // 0.50e18 (50%)
  MIN_DTV: BigInt('400000000000000000'), // 0.40e18 (40%)
  MAX_DTV: BigInt('600000000000000000'), // 0.60e18 (60%)
  LIQUIDATION_DTV: BigInt('660000000000000000'), // 0.66e18 (66%)
  REBALANCE_REWARD: BigInt('1000000000000000'), // 0.001e18 (0.1%)
} as const;

// ============ Type Definitions ============

export type ContractName = keyof typeof CONTRACTS;
export type AddressKey = keyof typeof FIXED_ADDRESSES;

export interface VaultStats {
  totalAssets: bigint;
  totalBorrows: bigint;
  totalReserves: bigint;
  utilizationRate: bigint;
  borrowRate: bigint;
  supplyRate: bigint;
  liquidAssets: bigint;
  withdrawableRatio: bigint;
}

export interface LeverageStats {
  totalLPValue: bigint;
  totalDebt: bigint;
  currentDTV: bigint;
  equity: bigint;
  needsRebalance: boolean;
  isDeleverage: boolean;
  accumulatedFees: bigint;
  pendingWTokenFees: bigint;
}

export interface V3LPVaultStats {
  totalToken0: bigint;
  totalToken1: bigint;
  pendingFee0: bigint;
  pendingFee1: bigint;
  layerCount: number;
}

export interface LiquidityLayer {
  tickLower: number;
  tickUpper: number;
  weight: bigint;
  tokenId: bigint;
  liquidity: bigint;
}

// ============ Helper Functions ============

/**
 * Format WAD value (1e18) to human readable number
 */
export function formatWad(value: bigint, decimals: number = 4): string {
  const divisor = BigInt(10 ** (18 - decimals));
  const scaled = Number(value / divisor) / (10 ** decimals);
  return scaled.toFixed(decimals);
}

/**
 * Format percentage from WAD (1e18 = 100%)
 */
export function formatPercent(value: bigint, decimals: number = 2): string {
  const percent = Number(value) / 1e16; // Convert to percentage
  return `${percent.toFixed(decimals)}%`;
}

/**
 * Parse human readable number to WAD
 */
export function parseWad(value: string | number): bigint {
  return BigInt(Math.floor(Number(value) * 1e18));
}

/**
 * Check if address is valid (not zero address)
 */
export function isValidAddress(address: string): boolean {
  return address !== '0x0000000000000000000000000000000000000000';
}

// ============ Deployment Check ============

export function checkDeployment(): { ready: boolean; missing: string[] } {
  const missing: string[] = [];

  if (!isValidAddress(FIXED_ADDRESSES.MIMStakingVaultFixed)) {
    missing.push('MIMStakingVaultFixed');
  }
  if (!isValidAddress(FIXED_ADDRESSES.LeverageAMMFixed)) {
    missing.push('LeverageAMMFixed');
  }
  if (!isValidAddress(FIXED_ADDRESSES.V3LPVaultFixed)) {
    missing.push('V3LPVaultFixed');
  }

  return {
    ready: missing.length === 0,
    missing,
  };
}
