"use client";

import { useMemo, useEffect, useCallback } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { MAGICPOOL_ADDRESSES, MIM_TOKEN_ABI, STAKING_VAULT_ABI, WTOKEN_ABI, ERC20_ABI } from '@/lib/contracts/magicpool';

const HUB_CHAIN_ID = 146; // Sonic

/**
 * Hook for interacting with MIM stablecoin
 */
export function useMIM() {
  const { address } = useAccount();

  const mimAddress = MAGICPOOL_ADDRESSES.mimToken;
  const sUSDCAddress = MAGICPOOL_ADDRESSES.sUSDC;

  // Get user MIM balance
  const { data: mimBalance, refetch: refetchMIM } = useReadContract({
    address: mimAddress,
    abi: MIM_TOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: HUB_CHAIN_ID,
    query: { enabled: !!address },
  });

  // Get user sUSDC balance
  const { data: sUSDCBalance, refetch: refetchSUSDC } = useReadContract({
    address: sUSDCAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: HUB_CHAIN_ID,
    query: { enabled: !!address },
  });

  // Get sUSDC allowance for MIM contract
  const { data: sUSDCAllowance, refetch: refetchAllowance } = useReadContract({
    address: sUSDCAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, mimAddress] : undefined,
    chainId: HUB_CHAIN_ID,
    query: { enabled: !!address },
  });

  // Get backing ratio
  const { data: backingRatioRaw } = useReadContract({
    address: mimAddress,
    abi: MIM_TOKEN_ABI,
    functionName: 'backingRatio',
    chainId: HUB_CHAIN_ID,
  });

  // Write contracts
  const { writeContractAsync, isPending } = useWriteContract();

  // Approve sUSDC for MIM contract
  const approveSUSDC = useCallback(async (amount: bigint) => {
    return writeContractAsync({
      address: sUSDCAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [mimAddress, amount],
      chainId: HUB_CHAIN_ID,
    });
  }, [writeContractAsync, sUSDCAddress, mimAddress]);

  // Mint MIM with sUSDC
  const mintWithSUSDC = useCallback(async (amount: bigint) => {
    return writeContractAsync({
      address: mimAddress,
      abi: MIM_TOKEN_ABI,
      functionName: 'mintWithUSDC', // Contract function name
      args: [amount],
      chainId: HUB_CHAIN_ID,
    });
  }, [writeContractAsync, mimAddress]);

  // Redeem MIM for sUSDC
  const redeemForSUSDC = useCallback(async (amount: bigint) => {
    return writeContractAsync({
      address: mimAddress,
      abi: MIM_TOKEN_ABI,
      functionName: 'redeemForUSDC', // Contract function name
      args: [amount],
      chainId: HUB_CHAIN_ID,
    });
  }, [writeContractAsync, mimAddress]);

  const refetch = useCallback(() => {
    refetchMIM();
    refetchSUSDC();
    refetchAllowance();
  }, [refetchMIM, refetchSUSDC, refetchAllowance]);

  // Check if approval is needed
  const needsApproval = useCallback((amount: bigint) => {
    return (sUSDCAllowance || BigInt(0)) < amount;
  }, [sUSDCAllowance]);

  return {
    // Balances
    userMIMBalance: mimBalance ? formatUnits(mimBalance, 18) : '0', // MIM is 18 decimals
    userSUSDCBalance: sUSDCBalance ? formatUnits(sUSDCBalance, 6) : '0', // sUSDC is 6 decimals
    backingRatio: backingRatioRaw ? (Number(backingRatioRaw) / 1e18).toFixed(4) : '1.0000',
    
    // Allowance
    sUSDCAllowance: sUSDCAllowance || BigInt(0),
    needsApproval,
    
    // Actions
    approveSUSDC,
    mintWithSUSDC,
    redeemForSUSDC,
    
    // State
    isPending,
    refetch,
  };
}

/**
 * Hook for interacting with MIM Staking Vault (sMIM)
 */
export function useMIMStaking() {
  const { address } = useAccount();

  const stakingVaultAddress = MAGICPOOL_ADDRESSES.stakingVault;
  const mimAddress = MAGICPOOL_ADDRESSES.mimToken;

  // Get user sMIM balance
  const { data: sMIMBalance, refetch: refetchSMIM } = useReadContract({
    address: stakingVaultAddress,
    abi: STAKING_VAULT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: HUB_CHAIN_ID,
    query: { enabled: !!address },
  });

  // Get user MIM balance
  const { data: mimBalance, refetch: refetchMIM } = useReadContract({
    address: mimAddress,
    abi: MIM_TOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: HUB_CHAIN_ID,
    query: { enabled: !!address },
  });

  // Get MIM allowance for staking vault
  const { data: mimAllowance, refetch: refetchAllowance } = useReadContract({
    address: mimAddress,
    abi: MIM_TOKEN_ABI,
    functionName: 'allowance',
    args: address ? [address, stakingVaultAddress] : undefined,
    chainId: HUB_CHAIN_ID,
    query: { enabled: !!address },
  });

  // Get vault stats
  const { data: totalAssets } = useReadContract({
    address: stakingVaultAddress,
    abi: STAKING_VAULT_ABI,
    functionName: 'totalAssets',
    chainId: HUB_CHAIN_ID,
  });

  const { data: totalBorrows } = useReadContract({
    address: stakingVaultAddress,
    abi: STAKING_VAULT_ABI,
    functionName: 'totalBorrows',
    chainId: HUB_CHAIN_ID,
  });

  const { data: borrowRateRaw } = useReadContract({
    address: stakingVaultAddress,
    abi: STAKING_VAULT_ABI,
    functionName: 'borrowRate',
    chainId: HUB_CHAIN_ID,
  });

  const { data: supplyRateRaw } = useReadContract({
    address: stakingVaultAddress,
    abi: STAKING_VAULT_ABI,
    functionName: 'supplyRate',
    chainId: HUB_CHAIN_ID,
  });

  const { data: utilizationRaw } = useReadContract({
    address: stakingVaultAddress,
    abi: STAKING_VAULT_ABI,
    functionName: 'utilizationRate',
    chainId: HUB_CHAIN_ID,
  });

  // Write contracts
  const { writeContractAsync, isPending } = useWriteContract();

  // Approve MIM for staking vault
  const approveMIM = useCallback(async (amount: bigint) => {
    return writeContractAsync({
      address: mimAddress,
      abi: MIM_TOKEN_ABI,
      functionName: 'approve',
      args: [stakingVaultAddress, amount],
      chainId: HUB_CHAIN_ID,
    });
  }, [writeContractAsync, mimAddress, stakingVaultAddress]);

  // Deposit MIM to get sMIM
  const deposit = useCallback(async (amount: bigint) => {
    return writeContractAsync({
      address: stakingVaultAddress,
      abi: STAKING_VAULT_ABI,
      functionName: 'deposit',
      args: [amount],
      chainId: HUB_CHAIN_ID,
    });
  }, [writeContractAsync, stakingVaultAddress]);

  // Withdraw sMIM to get MIM back
  const withdraw = useCallback(async (shares: bigint) => {
    return writeContractAsync({
      address: stakingVaultAddress,
      abi: STAKING_VAULT_ABI,
      functionName: 'withdraw',
      args: [shares],
      chainId: HUB_CHAIN_ID,
    });
  }, [writeContractAsync, stakingVaultAddress]);

  const refetch = useCallback(() => {
    refetchSMIM();
    refetchMIM();
    refetchAllowance();
  }, [refetchSMIM, refetchMIM, refetchAllowance]);

  // Check if approval is needed
  const needsApproval = useCallback((amount: bigint) => {
    return (mimAllowance || BigInt(0)) < amount;
  }, [mimAllowance]);

  // Parse stats
  const borrowAPR = borrowRateRaw ? (Number(borrowRateRaw) / 1e16) : 10; // Convert to percentage
  const supplyAPR = supplyRateRaw ? (Number(supplyRateRaw) / 1e16) : 0;
  const utilization = utilizationRaw ? (Number(utilizationRaw) / 1e16) : 0;

  return {
    // Balances
    userSMIMBalance: sMIMBalance ? formatUnits(sMIMBalance, 18) : '0', // sMIM is 18 decimals
    userMIMBalance: mimBalance ? formatUnits(mimBalance, 18) : '0', // MIM is 18 decimals
    
    // Vault stats
    totalAssets: totalAssets ? formatUnits(totalAssets, 18) : '0', // 18 decimals
    totalBorrows: totalBorrows ? formatUnits(totalBorrows, 18) : '0', // 18 decimals
    borrowAPR,
    supplyAPR,
    utilization,
    
    // Allowance
    mimAllowance: mimAllowance || BigInt(0),
    needsApproval,
    
    // Actions
    approveMIM,
    deposit,
    withdraw,
    
    // State
    isPending,
    refetch,
  };
}

/**
 * Hook for interacting with WToken (wETH zero-IL vault)
 */
export function useWToken() {
  const { address } = useAccount();

  const wTokenAddress = MAGICPOOL_ADDRESSES.wETH;
  const sWETHAddress = MAGICPOOL_ADDRESSES.sWETH;

  // Get user wETH balance
  const { data: wETHBalance, refetch: refetchWETH } = useReadContract({
    address: wTokenAddress,
    abi: WTOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: HUB_CHAIN_ID,
    query: { enabled: !!address },
  });

  // Get user sWETH balance
  const { data: sWETHBalance, refetch: refetchSWETH } = useReadContract({
    address: sWETHAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: HUB_CHAIN_ID,
    query: { enabled: !!address },
  });

  // Get sWETH allowance for wToken
  const { data: sWETHAllowance, refetch: refetchAllowance } = useReadContract({
    address: sWETHAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, wTokenAddress] : undefined,
    chainId: HUB_CHAIN_ID,
    query: { enabled: !!address },
  });

  // Get wToken stats
  const { data: pricePerShareRaw } = useReadContract({
    address: wTokenAddress,
    abi: WTOKEN_ABI,
    functionName: 'pricePerShare',
    chainId: HUB_CHAIN_ID,
  });

  const { data: totalValueRaw } = useReadContract({
    address: wTokenAddress,
    abi: WTOKEN_ABI,
    functionName: 'getTotalValue',
    chainId: HUB_CHAIN_ID,
  });

  const { data: positionValueRaw } = useReadContract({
    address: wTokenAddress,
    abi: WTOKEN_ABI,
    functionName: 'getPositionValue',
    args: address ? [address] : undefined,
    chainId: HUB_CHAIN_ID,
    query: { enabled: !!address },
  });

  // Write contracts
  const { writeContractAsync, isPending } = useWriteContract();

  // Approve sWETH for wToken
  const approveSWETH = useCallback(async (amount: bigint) => {
    return writeContractAsync({
      address: sWETHAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [wTokenAddress, amount],
      chainId: HUB_CHAIN_ID,
    });
  }, [writeContractAsync, sWETHAddress, wTokenAddress]);

  // Deposit sWETH to get wETH
  const deposit = useCallback(async (amount: bigint, minShares: bigint = BigInt(0)) => {
    return writeContractAsync({
      address: wTokenAddress,
      abi: WTOKEN_ABI,
      functionName: 'deposit',
      args: [amount, minShares],
      chainId: HUB_CHAIN_ID,
    });
  }, [writeContractAsync, wTokenAddress]);

  // Withdraw wETH to get sWETH back
  const withdraw = useCallback(async (shares: bigint, minAssets: bigint = BigInt(0)) => {
    return writeContractAsync({
      address: wTokenAddress,
      abi: WTOKEN_ABI,
      functionName: 'withdraw',
      args: [shares, minAssets],
      chainId: HUB_CHAIN_ID,
    });
  }, [writeContractAsync, wTokenAddress]);

  const refetch = useCallback(() => {
    refetchWETH();
    refetchSWETH();
    refetchAllowance();
  }, [refetchWETH, refetchSWETH, refetchAllowance]);

  // Check if approval is needed
  const needsApproval = useCallback((amount: bigint) => {
    return (sWETHAllowance || BigInt(0)) < amount;
  }, [sWETHAllowance]);

  // Parse stats
  const pricePerShare = pricePerShareRaw ? formatUnits(pricePerShareRaw, 18) : '1.0';
  const totalValue = totalValueRaw ? formatUnits(totalValueRaw, 18) : '0';
  const positionValue = positionValueRaw ? formatUnits(positionValueRaw, 18) : '0';

  return {
    // Balances
    userWETHBalance: wETHBalance ? formatUnits(wETHBalance, 18) : '0',
    userSWETHBalance: sWETHBalance ? formatUnits(sWETHBalance, 18) : '0',
    
    // Stats
    pricePerShare,
    totalValue,
    positionValue,
    
    // Allowance
    sWETHAllowance: sWETHAllowance || BigInt(0),
    needsApproval,
    
    // Actions
    approveSWETH,
    deposit,
    withdraw,
    
    // State
    isPending,
    refetch,
  };
}
