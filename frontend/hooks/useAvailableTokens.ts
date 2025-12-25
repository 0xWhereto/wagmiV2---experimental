"use client";

import { useReadContract } from "wagmi";
import { getChainConfig, CHAIN_CONFIG } from "@/lib/contracts/config";

// GatewayVault ABI for reading available tokens
const gatewayVaultAbi = [
  {
    name: "getAvailableTokenLength",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getAllAvailableTokens",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "onPause", type: "bool" },
          { name: "decimalsDelta", type: "int8" },
          { name: "syntheticTokenAddress", type: "address" },
          { name: "tokenAddress", type: "address" },
          { name: "tokenDecimals", type: "uint8" },
          { name: "tokenSymbol", type: "string" },
          { name: "tokenBalance", type: "uint256" },
        ],
      },
    ],
  },
] as const;

export interface AvailableToken {
  onPause: boolean;
  decimalsDelta: number;
  syntheticTokenAddress: string;
  tokenAddress: string;
  tokenDecimals: number;
  tokenSymbol: string;
  tokenBalance: bigint;
}

// Get gateway vault address for a chain
function getGatewayVaultAddress(chainId: number): `0x${string}` | null {
  const config = getChainConfig(chainId);
  if (!config || config.isHubChain) return null;
  return (config.contracts as { gatewayVault?: string }).gatewayVault as `0x${string}` || null;
}

/**
 * Hook to get available (linked) tokens from a GatewayVault
 */
export function useAvailableTokens(chainId: number) {
  const gatewayAddress = getGatewayVaultAddress(chainId);
  
  const { data: tokenCount, isLoading: countLoading } = useReadContract({
    address: gatewayAddress || undefined,
    abi: gatewayVaultAbi,
    functionName: "getAvailableTokenLength",
    chainId,
    query: {
      enabled: !!gatewayAddress,
    },
  });

  const { data: tokens, isLoading: tokensLoading, error } = useReadContract({
    address: gatewayAddress || undefined,
    abi: gatewayVaultAbi,
    functionName: "getAllAvailableTokens",
    chainId,
    query: {
      enabled: !!gatewayAddress,
    },
  });

  const availableTokens: AvailableToken[] = tokens ? 
    (tokens as any[]).map((t: any) => ({
      onPause: t.onPause,
      decimalsDelta: t.decimalsDelta,
      syntheticTokenAddress: t.syntheticTokenAddress,
      tokenAddress: t.tokenAddress,
      tokenDecimals: t.tokenDecimals,
      tokenSymbol: t.tokenSymbol,
      tokenBalance: t.tokenBalance,
    })) : [];

  return {
    tokenCount: tokenCount ? Number(tokenCount) : 0,
    tokens: availableTokens,
    isLoading: countLoading || tokensLoading,
    error,
    gatewayAddress,
  };
}

/**
 * Check if a specific token is available for bridging
 */
export function useIsTokenAvailable(chainId: number, tokenAddress: string) {
  const { tokens, isLoading } = useAvailableTokens(chainId);
  
  const isAvailable = tokens.some(
    t => t.tokenAddress.toLowerCase() === tokenAddress.toLowerCase() && !t.onPause
  );
  
  return { isAvailable, isLoading };
}



