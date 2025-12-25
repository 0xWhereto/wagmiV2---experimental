"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { SyntheticTokenHubABI } from "../abis";
import { getHubChainConfig } from "../config";
import type { Asset } from "./useGatewayVault";

// Hook to quote bridge tokens fee
export function useQuoteBridgeTokens(
  recipient: `0x${string}`,
  assets: Asset[],
  dstEid: number,
  options: `0x${string}`
) {
  const hubConfig = getHubChainConfig();
  const hubAddress = hubConfig?.contracts?.syntheticTokenHub as `0x${string}` | undefined;

  return useReadContract({
    address: hubAddress,
    abi: SyntheticTokenHubABI,
    functionName: "quoteBridgeTokens",
    args: [recipient, assets as readonly { tokenAddress: `0x${string}`; tokenAmount: bigint }[], dstEid, options],
    chainId: hubConfig?.chainId,
    query: {
      enabled:
        !!hubAddress &&
        hubAddress !== "0x0000000000000000000000000000000000000000" &&
        assets.length > 0,
    },
  });
}

// Hook to validate and prepare assets
export function useValidateAndPrepareAssets(
  assets: Asset[],
  dstEid: number,
  skipMinBridgeAmtCheck: boolean = false
) {
  const hubConfig = getHubChainConfig();
  const hubAddress = hubConfig?.contracts?.syntheticTokenHub as `0x${string}` | undefined;

  return useReadContract({
    address: hubAddress,
    abi: SyntheticTokenHubABI,
    functionName: "validateAndPrepareAssets",
    args: [assets as readonly { tokenAddress: `0x${string}`; tokenAmount: bigint }[], dstEid, skipMinBridgeAmtCheck],
    chainId: hubConfig?.chainId,
    query: {
      enabled:
        !!hubAddress &&
        hubAddress !== "0x0000000000000000000000000000000000000000" &&
        assets.length > 0,
    },
  });
}

// Hook to calculate bonuses for incoming assets
export function useCalculateBonuses(assets: Asset[], srcEid: number) {
  const hubConfig = getHubChainConfig();
  const hubAddress = hubConfig?.contracts?.syntheticTokenHub as `0x${string}` | undefined;

  return useReadContract({
    address: hubAddress,
    abi: SyntheticTokenHubABI,
    functionName: "calculateBonuses",
    args: [assets as readonly { tokenAddress: `0x${string}`; tokenAmount: bigint }[], srcEid],
    chainId: hubConfig?.chainId,
    query: {
      enabled:
        !!hubAddress &&
        hubAddress !== "0x0000000000000000000000000000000000000000" &&
        assets.length > 0,
    },
  });
}

// Hook to bridge tokens from hub to destination chain
export function useBridgeTokens() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const bridgeTokens = async (
    recipient: `0x${string}`,
    assets: Asset[],
    dstEid: number,
    options: `0x${string}`,
    value: bigint
  ) => {
    const hubConfig = getHubChainConfig();
    const hubAddress = hubConfig?.contracts?.syntheticTokenHub as `0x${string}`;

    if (!hubAddress || hubAddress === "0x0000000000000000000000000000000000000000") {
      throw new Error("SyntheticTokenHub not deployed");
    }

    writeContract({
      address: hubAddress,
      abi: SyntheticTokenHubABI,
      functionName: "bridgeTokens",
      args: [recipient, assets as readonly { tokenAddress: `0x${string}`; tokenAmount: bigint }[], dstEid, options],
      value,
      chainId: hubConfig?.chainId,
    });
  };

  return {
    bridgeTokens,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

