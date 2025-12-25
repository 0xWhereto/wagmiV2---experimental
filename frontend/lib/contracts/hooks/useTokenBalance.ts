"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ERC20ABI } from "../abis";

// Hook to get token balance
export function useTokenBalance(
  tokenAddress: `0x${string}` | undefined,
  userAddress: `0x${string}` | undefined,
  chainId?: number
) {
  return useReadContract({
    address: tokenAddress,
    abi: ERC20ABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    chainId,
    query: {
      enabled: !!tokenAddress && !!userAddress,
    },
  });
}

// Hook to get token decimals
export function useTokenDecimals(tokenAddress: `0x${string}` | undefined, chainId?: number) {
  return useReadContract({
    address: tokenAddress,
    abi: ERC20ABI,
    functionName: "decimals",
    chainId,
    query: {
      enabled: !!tokenAddress,
    },
  });
}

// Hook to get token symbol
export function useTokenSymbol(tokenAddress: `0x${string}` | undefined, chainId?: number) {
  return useReadContract({
    address: tokenAddress,
    abi: ERC20ABI,
    functionName: "symbol",
    chainId,
    query: {
      enabled: !!tokenAddress,
    },
  });
}

// Hook to get token allowance
export function useTokenAllowance(
  tokenAddress: `0x${string}` | undefined,
  ownerAddress: `0x${string}` | undefined,
  spenderAddress: `0x${string}` | undefined,
  chainId?: number
) {
  return useReadContract({
    address: tokenAddress,
    abi: ERC20ABI,
    functionName: "allowance",
    args: ownerAddress && spenderAddress ? [ownerAddress, spenderAddress] : undefined,
    chainId,
    query: {
      enabled: !!tokenAddress && !!ownerAddress && !!spenderAddress,
    },
  });
}

// Hook to approve token spending
export function useApproveToken() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const approve = async (
    tokenAddress: `0x${string}`,
    spenderAddress: `0x${string}`,
    amount: bigint,
    chainId?: number
  ) => {
    writeContract({
      address: tokenAddress,
      abi: ERC20ABI,
      functionName: "approve",
      args: [spenderAddress, amount],
      chainId,
    });
  };

  return {
    approve,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}



