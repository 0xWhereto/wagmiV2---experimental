"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther } from "viem";
import { GatewayVaultABI } from "../abis";
import { getChainConfig } from "../config";

export interface Asset {
  tokenAddress: `0x${string}`;
  tokenAmount: bigint;
}

export interface TokenDetail {
  onPause: boolean;
  decimalsDelta: number;
  syntheticTokenAddress: `0x${string}`;
  tokenAddress: `0x${string}`;
  tokenDecimals: number;
  tokenSymbol: string;
  tokenBalance: bigint;
}

// Hook to get all available tokens from GatewayVault
export function useAvailableTokens(chainId: number) {
  const chainConfig = getChainConfig(chainId);
  const gatewayAddress = (chainConfig?.contracts as Record<string, string> | undefined)?.gatewayVault as `0x${string}` | undefined;

  return useReadContract({
    address: gatewayAddress,
    abi: GatewayVaultABI,
    functionName: "getAllAvailableTokens",
    chainId,
    query: {
      enabled: !!gatewayAddress && gatewayAddress !== "0x0000000000000000000000000000000000000000",
    },
  });
}

// Hook to get token details by address
export function useTokenDetails(chainId: number, tokenAddress: `0x${string}`) {
  const chainConfig = getChainConfig(chainId);
  const gatewayAddress = (chainConfig?.contracts as Record<string, string> | undefined)?.gatewayVault as `0x${string}` | undefined;

  return useReadContract({
    address: gatewayAddress,
    abi: GatewayVaultABI,
    functionName: "getAllAvailableTokenByAddress",
    args: [tokenAddress],
    chainId,
    query: {
      enabled: !!gatewayAddress && gatewayAddress !== "0x0000000000000000000000000000000000000000",
    },
  });
}

// Hook to quote deposit fee
export function useQuoteDeposit(
  chainId: number,
  recipient: `0x${string}`,
  assets: Asset[],
  options: `0x${string}`
) {
  const chainConfig = getChainConfig(chainId);
  const gatewayAddress = (chainConfig?.contracts as Record<string, string> | undefined)?.gatewayVault as `0x${string}` | undefined;

  return useReadContract({
    address: gatewayAddress,
    abi: GatewayVaultABI,
    functionName: "quoteDeposit",
    args: [recipient, assets as readonly { tokenAddress: `0x${string}`; tokenAmount: bigint }[], options],
    chainId,
    query: {
      enabled:
        !!gatewayAddress &&
        gatewayAddress !== "0x0000000000000000000000000000000000000000" &&
        assets.length > 0,
    },
  });
}

// Hook to deposit tokens
export function useDeposit() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const deposit = async (
    chainId: number,
    recipient: `0x${string}`,
    assets: Asset[],
    options: `0x${string}`,
    value: bigint
  ) => {
    const chainConfig = getChainConfig(chainId);
    const gatewayAddress = (chainConfig?.contracts as Record<string, string> | undefined)?.gatewayVault as `0x${string}`;

    if (!gatewayAddress || gatewayAddress === "0x0000000000000000000000000000000000000000") {
      throw new Error("Gateway vault not deployed on this chain");
    }

    writeContract({
      address: gatewayAddress,
      abi: GatewayVaultABI,
      functionName: "deposit",
      args: [recipient, assets as readonly { tokenAddress: `0x${string}`; tokenAmount: bigint }[], options],
      value,
      chainId,
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

// Hook to perform cross-chain swap
export function useSwap() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const swap = async (
    chainId: number,
    swapParams: {
      from: `0x${string}`;
      to: `0x${string}`;
      syntheticTokenOut: `0x${string}`;
      gasLimit: bigint;
      dstEid: number;
      value: bigint;
      assets: Asset[];
      commands: `0x${string}`;
      inputs: `0x${string}`[];
      minimumAmountOut: bigint;
    },
    options: `0x${string}`,
    assets: Asset[],
    msgValue: bigint
  ) => {
    const chainConfig = getChainConfig(chainId);
    const gatewayAddress = (chainConfig?.contracts as Record<string, string> | undefined)?.gatewayVault as `0x${string}`;

    if (!gatewayAddress || gatewayAddress === "0x0000000000000000000000000000000000000000") {
      throw new Error("Gateway vault not deployed on this chain");
    }

    // Cast types for ABI compatibility
    const typedSwapParams = {
      ...swapParams,
      assets: swapParams.assets as readonly { tokenAddress: `0x${string}`; tokenAmount: bigint }[],
      inputs: swapParams.inputs as readonly `0x${string}`[],
    };

    writeContract({
      address: gatewayAddress,
      abi: GatewayVaultABI,
      functionName: "swap",
      args: [typedSwapParams, options, assets as readonly { tokenAddress: `0x${string}`; tokenAmount: bigint }[]],
      value: msgValue,
      chainId,
    });
  };

  return {
    swap,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

