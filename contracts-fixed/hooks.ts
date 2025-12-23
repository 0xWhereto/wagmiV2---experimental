/**
 * React Hooks for 0IL Fixed Contracts
 *
 * These hooks use wagmi/viem for interacting with the fixed contracts.
 * Import these into your React components.
 */

import { useReadContract, useWriteContract, useAccount, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { CONTRACTS, FIXED_ADDRESSES, ABIS, SONIC_CHAIN_ID, formatWad, formatPercent } from './config';

// ============ MIMStakingVault (sMIM) Hooks ============

/**
 * Read vault statistics
 */
export function useVaultStats() {
  const { data: totalAssets } = useReadContract({
    address: FIXED_ADDRESSES.MIMStakingVaultFixed as `0x${string}`,
    abi: ABIS.MIMStakingVaultFixed,
    functionName: 'totalAssets',
    chainId: SONIC_CHAIN_ID,
  });

  const { data: totalBorrows } = useReadContract({
    address: FIXED_ADDRESSES.MIMStakingVaultFixed as `0x${string}`,
    abi: ABIS.MIMStakingVaultFixed,
    functionName: 'totalBorrows',
    chainId: SONIC_CHAIN_ID,
  });

  const { data: liquidAssets } = useReadContract({
    address: FIXED_ADDRESSES.MIMStakingVaultFixed as `0x${string}`,
    abi: ABIS.MIMStakingVaultFixed,
    functionName: 'liquidAssets',
    chainId: SONIC_CHAIN_ID,
  });

  const { data: utilizationRate } = useReadContract({
    address: FIXED_ADDRESSES.MIMStakingVaultFixed as `0x${string}`,
    abi: ABIS.MIMStakingVaultFixed,
    functionName: 'utilizationRate',
    chainId: SONIC_CHAIN_ID,
  });

  const { data: borrowRate } = useReadContract({
    address: FIXED_ADDRESSES.MIMStakingVaultFixed as `0x${string}`,
    abi: ABIS.MIMStakingVaultFixed,
    functionName: 'borrowRate',
    chainId: SONIC_CHAIN_ID,
  });

  const { data: supplyRate } = useReadContract({
    address: FIXED_ADDRESSES.MIMStakingVaultFixed as `0x${string}`,
    abi: ABIS.MIMStakingVaultFixed,
    functionName: 'supplyRate',
    chainId: SONIC_CHAIN_ID,
  });

  const { data: withdrawableRatio } = useReadContract({
    address: FIXED_ADDRESSES.MIMStakingVaultFixed as `0x${string}`,
    abi: ABIS.MIMStakingVaultFixed,
    functionName: 'withdrawableRatio',
    chainId: SONIC_CHAIN_ID,
  });

  return {
    totalAssets: totalAssets as bigint | undefined,
    totalBorrows: totalBorrows as bigint | undefined,
    liquidAssets: liquidAssets as bigint | undefined,
    utilizationRate: utilizationRate as bigint | undefined,
    borrowRate: borrowRate as bigint | undefined,
    supplyRate: supplyRate as bigint | undefined,
    withdrawableRatio: withdrawableRatio as bigint | undefined,
    formatted: {
      totalAssets: totalAssets ? formatWad(totalAssets as bigint) : '0',
      totalBorrows: totalBorrows ? formatWad(totalBorrows as bigint) : '0',
      liquidAssets: liquidAssets ? formatWad(liquidAssets as bigint) : '0',
      utilizationRate: utilizationRate ? formatPercent(utilizationRate as bigint) : '0%',
      borrowRate: borrowRate ? formatPercent(borrowRate as bigint) : '0%',
      supplyRate: supplyRate ? formatPercent(supplyRate as bigint) : '0%',
      withdrawableRatio: withdrawableRatio ? formatPercent(withdrawableRatio as bigint) : '0%',
    },
  };
}

/**
 * Get user's max withdrawable amounts
 */
export function useMaxWithdrawable(userAddress?: `0x${string}`) {
  const { data: maxShares } = useReadContract({
    address: FIXED_ADDRESSES.MIMStakingVaultFixed as `0x${string}`,
    abi: ABIS.MIMStakingVaultFixed,
    functionName: 'maxWithdrawableShares',
    args: userAddress ? [userAddress] : undefined,
    chainId: SONIC_CHAIN_ID,
    query: { enabled: !!userAddress },
  });

  const { data: maxAssets } = useReadContract({
    address: FIXED_ADDRESSES.MIMStakingVaultFixed as `0x${string}`,
    abi: ABIS.MIMStakingVaultFixed,
    functionName: 'maxWithdrawableAssets',
    args: userAddress ? [userAddress] : undefined,
    chainId: SONIC_CHAIN_ID,
    query: { enabled: !!userAddress },
  });

  return {
    maxShares: maxShares as bigint | undefined,
    maxAssets: maxAssets as bigint | undefined,
    formatted: {
      maxShares: maxShares ? formatWad(maxShares as bigint) : '0',
      maxAssets: maxAssets ? formatWad(maxAssets as bigint) : '0',
    },
  };
}

/**
 * Deposit MIM into vault
 */
export function useVaultDeposit() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const deposit = (amount: bigint) => {
    writeContract({
      address: FIXED_ADDRESSES.MIMStakingVaultFixed as `0x${string}`,
      abi: ABIS.MIMStakingVaultFixed,
      functionName: 'deposit',
      args: [amount],
      chainId: SONIC_CHAIN_ID,
    });
  };

  return {
    deposit,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Withdraw from vault (uses fixed withdrawal logic)
 */
export function useVaultWithdraw() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const withdraw = (shares: bigint) => {
    writeContract({
      address: FIXED_ADDRESSES.MIMStakingVaultFixed as `0x${string}`,
      abi: ABIS.MIMStakingVaultFixed,
      functionName: 'withdraw',
      args: [shares],
      chainId: SONIC_CHAIN_ID,
    });
  };

  const withdrawExact = (assets: bigint) => {
    writeContract({
      address: FIXED_ADDRESSES.MIMStakingVaultFixed as `0x${string}`,
      abi: ABIS.MIMStakingVaultFixed,
      functionName: 'withdrawExact',
      args: [assets],
      chainId: SONIC_CHAIN_ID,
    });
  };

  return {
    withdraw,
    withdrawExact,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

// ============ LeverageAMM Hooks ============

/**
 * Read leverage position statistics
 */
export function useLeverageStats() {
  const { data: totalLPValue } = useReadContract({
    address: FIXED_ADDRESSES.LeverageAMMFixed as `0x${string}`,
    abi: ABIS.LeverageAMMFixed,
    functionName: 'getTotalLPValue',
    chainId: SONIC_CHAIN_ID,
  });

  const { data: totalDebt } = useReadContract({
    address: FIXED_ADDRESSES.LeverageAMMFixed as `0x${string}`,
    abi: ABIS.LeverageAMMFixed,
    functionName: 'getTotalDebt',
    chainId: SONIC_CHAIN_ID,
  });

  const { data: currentDTV } = useReadContract({
    address: FIXED_ADDRESSES.LeverageAMMFixed as `0x${string}`,
    abi: ABIS.LeverageAMMFixed,
    functionName: 'getCurrentDTV',
    chainId: SONIC_CHAIN_ID,
  });

  const { data: equity } = useReadContract({
    address: FIXED_ADDRESSES.LeverageAMMFixed as `0x${string}`,
    abi: ABIS.LeverageAMMFixed,
    functionName: 'getEquity',
    chainId: SONIC_CHAIN_ID,
  });

  const { data: rebalanceCheck } = useReadContract({
    address: FIXED_ADDRESSES.LeverageAMMFixed as `0x${string}`,
    abi: ABIS.LeverageAMMFixed,
    functionName: 'checkRebalance',
    chainId: SONIC_CHAIN_ID,
  });

  const { data: accumulatedFees } = useReadContract({
    address: FIXED_ADDRESSES.LeverageAMMFixed as `0x${string}`,
    abi: ABIS.LeverageAMMFixed,
    functionName: 'accumulatedFees',
    chainId: SONIC_CHAIN_ID,
  });

  const { data: pendingWTokenFees } = useReadContract({
    address: FIXED_ADDRESSES.LeverageAMMFixed as `0x${string}`,
    abi: ABIS.LeverageAMMFixed,
    functionName: 'pendingWTokenFees',
    chainId: SONIC_CHAIN_ID,
  });

  const [needsRebalance, isDeleverage] = (rebalanceCheck as [boolean, boolean]) || [false, false];

  return {
    totalLPValue: totalLPValue as bigint | undefined,
    totalDebt: totalDebt as bigint | undefined,
    currentDTV: currentDTV as bigint | undefined,
    equity: equity as bigint | undefined,
    needsRebalance,
    isDeleverage,
    accumulatedFees: accumulatedFees as bigint | undefined,
    pendingWTokenFees: pendingWTokenFees as bigint | undefined,
    formatted: {
      totalLPValue: totalLPValue ? formatWad(totalLPValue as bigint) : '0',
      totalDebt: totalDebt ? formatWad(totalDebt as bigint) : '0',
      currentDTV: currentDTV ? formatPercent(currentDTV as bigint) : '0%',
      equity: equity ? formatWad(equity as bigint) : '0',
      accumulatedFees: accumulatedFees ? formatWad(accumulatedFees as bigint) : '0',
      pendingWTokenFees: pendingWTokenFees ? formatWad(pendingWTokenFees as bigint) : '0',
    },
  };
}

/**
 * Check weekly payment status
 */
export function useWeeklyPaymentStatus() {
  const { data: isPaymentDue } = useReadContract({
    address: FIXED_ADDRESSES.LeverageAMMFixed as `0x${string}`,
    abi: ABIS.LeverageAMMFixed,
    functionName: 'isWeeklyPaymentDue',
    chainId: SONIC_CHAIN_ID,
  });

  const { data: lastWeeklyPayment } = useReadContract({
    address: FIXED_ADDRESSES.LeverageAMMFixed as `0x${string}`,
    abi: ABIS.LeverageAMMFixed,
    functionName: 'lastWeeklyPayment',
    chainId: SONIC_CHAIN_ID,
  });

  const { data: expectedInterest } = useReadContract({
    address: FIXED_ADDRESSES.LeverageAMMFixed as `0x${string}`,
    abi: ABIS.LeverageAMMFixed,
    functionName: 'getExpectedWeeklyInterest',
    chainId: SONIC_CHAIN_ID,
  });

  const { data: canPayFull } = useReadContract({
    address: FIXED_ADDRESSES.LeverageAMMFixed as `0x${string}`,
    abi: ABIS.LeverageAMMFixed,
    functionName: 'canPayFullInterest',
    chainId: SONIC_CHAIN_ID,
  });

  const [canPay, shortfall] = (canPayFull as [boolean, bigint]) || [false, BigInt(0)];

  return {
    isPaymentDue: isPaymentDue as boolean | undefined,
    lastWeeklyPayment: lastWeeklyPayment as bigint | undefined,
    expectedInterest: expectedInterest as bigint | undefined,
    canPay,
    shortfall,
    formatted: {
      lastWeeklyPayment: lastWeeklyPayment
        ? new Date(Number(lastWeeklyPayment as bigint) * 1000).toLocaleString()
        : 'Not initialized',
      expectedInterest: expectedInterest ? formatWad(expectedInterest as bigint, 6) : '0',
      shortfall: shortfall ? formatWad(shortfall, 6) : '0',
    },
  };
}

/**
 * Trigger rebalance
 */
export function useRebalance() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const rebalance = () => {
    writeContract({
      address: FIXED_ADDRESSES.LeverageAMMFixed as `0x${string}`,
      abi: ABIS.LeverageAMMFixed,
      functionName: 'rebalance',
      chainId: SONIC_CHAIN_ID,
    });
  };

  return {
    rebalance,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Collect fees and pay weekly interest
 */
export function useWeeklyPayment() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const collectFees = () => {
    writeContract({
      address: FIXED_ADDRESSES.LeverageAMMFixed as `0x${string}`,
      abi: ABIS.LeverageAMMFixed,
      functionName: 'collectAllFees',
      chainId: SONIC_CHAIN_ID,
    });
  };

  const payWeeklyInterest = () => {
    writeContract({
      address: FIXED_ADDRESSES.LeverageAMMFixed as `0x${string}`,
      abi: ABIS.LeverageAMMFixed,
      functionName: 'payWeeklyInterest',
      chainId: SONIC_CHAIN_ID,
    });
  };

  return {
    collectFees,
    payWeeklyInterest,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

// ============ Admin Hooks ============

/**
 * Initialize weekly payment (for owner only)
 * This fixes BUG-005 on deployed contracts
 */
export function useInitializeWeeklyPayment() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const initialize = () => {
    writeContract({
      address: FIXED_ADDRESSES.LeverageAMMFixed as `0x${string}`,
      abi: ABIS.LeverageAMMFixed,
      functionName: 'initializeWeeklyPayment',
      chainId: SONIC_CHAIN_ID,
    });
  };

  return {
    initialize,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}
