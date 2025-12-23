/**
 * 0IL Fixed Contracts Package
 *
 * This package contains fixed versions of the 0IL protocol contracts
 * with bug fixes for:
 *
 * - BUG-003: sMIM withdrawal fails (fixed withdrawal logic)
 * - BUG-005: Weekly interest never initialized (constructor fix)
 *
 * Usage in your React app:
 *
 * ```typescript
 * import {
 *   FIXED_ADDRESSES,
 *   ABIS,
 *   useVaultStats,
 *   useVaultDeposit,
 *   useVaultWithdraw,
 *   useLeverageStats,
 * } from './contracts-fixed';
 * ```
 */

// Configuration
export {
  SONIC_CHAIN_ID,
  CURRENT_ADDRESSES,
  FIXED_ADDRESSES,
  ABIS,
  CONTRACTS,
  PROTOCOL_CONSTANTS,
  formatWad,
  formatPercent,
  parseWad,
  isValidAddress,
  checkDeployment,
} from './config';

// Types
export type {
  ContractName,
  AddressKey,
  VaultStats,
  LeverageStats,
} from './config';

// React Hooks
export {
  // MIMStakingVault hooks
  useVaultStats,
  useMaxWithdrawable,
  useVaultDeposit,
  useVaultWithdraw,

  // LeverageAMM hooks
  useLeverageStats,
  useWeeklyPaymentStatus,
  useRebalance,
  useWeeklyPayment,

  // Admin hooks
  useInitializeWeeklyPayment,
} from './hooks';
