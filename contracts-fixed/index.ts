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
  V3LPVaultStats,
  LiquidityLayer,
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

  // V3LPVault hooks (FIXED - proper position amount calculation)
  useV3LPVaultStats,
  useV3LPVaultLayer,
  useV3LPVaultAddLiquidity,
  useV3LPVaultRemoveLiquidity,
  useV3LPVaultCollectFees,
  useV3LPVaultRebalance,
  useV3LPVaultSetDefaultLayers,

  // Admin hooks
  useInitializeWeeklyPayment,
} from './hooks';
