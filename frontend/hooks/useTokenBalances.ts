"use client";

import { useAccount, useBalance, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { getTokensForChain, type Token } from "@/lib/tokens/tokenList";

// ERC20 ABI for balanceOf
const erc20Abi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

export interface TokenBalance {
  symbol: string;
  balance: string;           // Raw balance in wei (for contract calls)
  balanceFormatted: string;  // Formatted for display (rounded to 4 decimals)
  balanceRaw: string;        // Full precision balance as decimal string (for MAX button)
  balanceUsd: string;
  decimals: number;
}

// Mock prices (in production, fetch from price API)
const TOKEN_PRICES: Record<string, number> = {
  // Native & Major
  ETH: 3200, WETH: 3200, USDC: 1, USDT: 1, DAI: 1, WBTC: 95000,
  ARB: 1.2, S: 0.5, WAGMI: 0.85, USDbC: 1, cbETH: 3400, wstETH: 3600, 
  GMX: 45, LINK: 15, ANON: 0.01,
  // Synthetic tokens (same price as underlying)
  sWETH: 3200, sUSDT: 1, sUSDC: 1, sDAI: 1, sWBTC: 95000,
};

// Hook to get native token balance
export function useNativeBalance() {
  const { address, isConnected } = useAccount();
  
  const { data, isLoading, refetch } = useBalance({
    address: address,
    query: {
      enabled: isConnected && !!address,
    },
  });

  return {
    balance: data?.value?.toString() || "0",
    balanceFormatted: data?.formatted || "0",
    symbol: data?.symbol || "ETH",
    decimals: data?.decimals || 18,
    isLoading,
    refetch,
  };
}

// Hook to get a single token balance
export function useTokenBalance(tokenAddress: `0x${string}` | undefined, chainId?: number) {
  const { address, isConnected } = useAccount();
  
  const { data, isLoading, refetch } = useBalance({
    address: address,
    token: tokenAddress,
    chainId: chainId,
    query: {
      enabled: isConnected && !!address && !!tokenAddress,
    },
  });

  return {
    balance: data?.value?.toString() || "0",
    balanceFormatted: data?.formatted || "0",
    symbol: data?.symbol || "",
    decimals: data?.decimals || 18,
    isLoading,
    refetch,
  };
}

// Hook to get all token balances for a chain
export function useAllTokenBalances(chainId: number): {
  balances: Record<string, TokenBalance>;
  isLoading: boolean;
  refetch: () => void;
} {
  const { address, isConnected } = useAccount();
  const tokens = getTokensForChain(chainId);
  
  // Get native balance
  const { data: nativeData, isLoading: nativeLoading, refetch: refetchNative } = useBalance({
    address: address,
    chainId: chainId,
    query: {
      enabled: isConnected && !!address,
    },
  });

  // Filter tokens with addresses (ERC20 tokens)
  const erc20Tokens = tokens.filter(t => t.address && t.address !== "0x0000000000000000000000000000000000000000");
  
  // Create contract read calls for each token
  const contracts = erc20Tokens.map(token => ({
    address: token.address as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf" as const,
    args: [address as `0x${string}`],
    chainId: chainId,
  }));

  const { data: balanceData, isLoading: tokensLoading, refetch: refetchTokens } = useReadContracts({
    contracts,
    query: {
      enabled: isConnected && !!address && contracts.length > 0,
    },
  });

  // Build balances object
  const balances: Record<string, TokenBalance> = {};

  // Add native token balance
  const nativeToken = tokens.find(t => !t.address || t.address === "0x0000000000000000000000000000000000000000");
  if (nativeToken && nativeData) {
    const price = TOKEN_PRICES[nativeToken.symbol] || 0;
    const formatted = parseFloat(nativeData.formatted || "0");
    balances[nativeToken.symbol] = {
      symbol: nativeToken.symbol,
      balance: nativeData.value?.toString() || "0",
      balanceFormatted: formatted.toFixed(4),
      balanceRaw: nativeData.formatted || "0", // Full precision for MAX button
      balanceUsd: (formatted * price).toFixed(2),
      decimals: nativeData.decimals || 18,
    };
  }

  // Add ERC20 token balances
  if (balanceData) {
    erc20Tokens.forEach((token, index) => {
      const result = balanceData[index];
      if (result && result.status === "success" && result.result !== undefined) {
        const balance = result.result as bigint;
        const decimals = token.decimals || 18;
        const rawFormatted = formatUnits(balance, decimals); // Full precision string
        const formatted = parseFloat(rawFormatted);
        const price = TOKEN_PRICES[token.symbol] || 0;
        
        balances[token.symbol] = {
          symbol: token.symbol,
          balance: balance.toString(),
          balanceFormatted: formatted > 0 ? (formatted < 0.0001 ? "<0.0001" : formatted.toFixed(4)) : "0",
          balanceRaw: rawFormatted, // Full precision for MAX button
          balanceUsd: (formatted * price).toFixed(2),
          decimals,
        };
      } else {
        // Token not found or error - show 0 balance
        balances[token.symbol] = {
          symbol: token.symbol,
          balance: "0",
          balanceFormatted: "0",
          balanceRaw: "0",
          balanceUsd: "0.00",
          decimals: token.decimals || 18,
        };
      }
    });
  }

  // For tokens without balance data yet, show 0
  tokens.forEach(token => {
    if (!balances[token.symbol]) {
      balances[token.symbol] = {
        symbol: token.symbol,
        balance: "0",
        balanceFormatted: "0",
        balanceRaw: "0",
        balanceUsd: "0.00",
        decimals: token.decimals || 18,
      };
    }
  });

  const refetch = () => {
    refetchNative();
    refetchTokens();
  };

  return {
    balances,
    isLoading: nativeLoading || tokensLoading,
    refetch,
  };
}

// Get balance for a specific token symbol
export function getBalanceForToken(
  balances: Record<string, TokenBalance>,
  symbol: string
): TokenBalance {
  return balances[symbol] || {
    symbol,
    balance: "0",
    balanceFormatted: "0",
    balanceRaw: "0",
    balanceUsd: "0.00",
    decimals: 18,
  };
}

