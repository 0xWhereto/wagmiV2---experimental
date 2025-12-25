"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { usePublicClient, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { UniswapV3FactoryABI, UniswapV3PoolABI, ERC20ABI } from "../abis";
import { getHubChainConfig } from "../config";
import { getTokensForChain } from "@/lib/tokens/tokenList";

const HUB_CHAIN_ID = 146;
const hubConfig = getHubChainConfig();
const FACTORY = (hubConfig?.contracts as any)?.uniswapV3Factory as `0x${string}` || "0x0000000000000000000000000000000000000000";

// Known pool configurations to check
export const KNOWN_POOL_PAIRS = [
  { token0Symbol: "sWETH", token1Symbol: "sUSDC", fees: [500, 3000] },
  { token0Symbol: "sWETH", token1Symbol: "sUSDT", fees: [500, 3000] },
  { token0Symbol: "sUSDC", token1Symbol: "sUSDT", fees: [100, 500] },
  { token0Symbol: "sWBTC", token1Symbol: "sWETH", fees: [500, 3000] },
  { token0Symbol: "sWBTC", token1Symbol: "sUSDC", fees: [500, 3000] },
  // MIM pools (0.01% for stablecoin peg, 0.05% for volatile pairs)
  { token0Symbol: "MIM", token1Symbol: "sUSDC", fees: [100, 500, 3000] }, // 0.01% is the main peg pool
  { token0Symbol: "MIM", token1Symbol: "sWETH", fees: [100, 500, 3000] }, // 0IL sWETH vault pool
  { token0Symbol: "MIM", token1Symbol: "sWBTC", fees: [100, 500, 3000] }, // 0IL sWBTC vault pool
] as const;

// Token prices for TVL calculation (would use oracle in production)
const TOKEN_PRICES: Record<string, number> = {
  sWETH: 3370,
  sUSDC: 1,
  sUSDT: 1,
  sWBTC: 95000,
  sDAI: 1,
  MIM: 1,
  sMIM: 1,
};

export interface PoolData {
  address: `0x${string}`;
  token0Symbol: string;
  token1Symbol: string;
  token0Address: `0x${string}`;
  token1Address: `0x${string}`;
  token0Decimals: number;
  token1Decimals: number;
  fee: number;
  sqrtPriceX96: bigint;
  tick: number;
  liquidity: bigint;
  token0Balance: bigint;
  token1Balance: bigint;
  tvlUsd: number;
  volume24h: number; // Mock for now
  apy: number; // Mock for now
}

export interface PoolStats {
  totalTvlUsd: number;
  totalVolume24h: number;
  userLiquidityUsd: number;
}

// Fetch all known pools
export function useAllPools() {
  const [pools, setPools] = useState<PoolData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const publicClient = usePublicClient({ chainId: HUB_CHAIN_ID });
  const hubTokens = getTokensForChain(HUB_CHAIN_ID);

  const fetchPools = useCallback(async () => {
    if (!publicClient || FACTORY === "0x0000000000000000000000000000000000000000") {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const foundPools: PoolData[] = [];

      for (const pair of KNOWN_POOL_PAIRS) {
        const token0 = hubTokens.find(t => t.symbol === pair.token0Symbol);
        const token1 = hubTokens.find(t => t.symbol === pair.token1Symbol);

        if (!token0?.address || !token1?.address) continue;

        // Sort tokens by address
        const [sortedToken0, sortedToken1] = token0.address.toLowerCase() < token1.address.toLowerCase()
          ? [token0, token1]
          : [token1, token0];

        for (const fee of pair.fees) {
          try {
            // Get pool address
            const poolAddress = await publicClient.readContract({
              address: FACTORY,
              abi: UniswapV3FactoryABI,
              functionName: "getPool",
              args: [
                sortedToken0.address as `0x${string}`,
                sortedToken1.address as `0x${string}`,
                fee,
              ],
            }) as `0x${string}`;

            if (poolAddress === "0x0000000000000000000000000000000000000000") continue;

            // Get pool data
            const [slot0, liquidity, token0Balance, token1Balance] = await Promise.all([
              publicClient.readContract({
                address: poolAddress,
                abi: UniswapV3PoolABI,
                functionName: "slot0",
              }) as unknown as Promise<any[]>,
              publicClient.readContract({
                address: poolAddress,
                abi: UniswapV3PoolABI,
                functionName: "liquidity",
              }) as unknown as Promise<bigint>,
              publicClient.readContract({
                address: sortedToken0.address as `0x${string}`,
                abi: ERC20ABI,
                functionName: "balanceOf",
                args: [poolAddress],
              }) as unknown as Promise<bigint>,
              publicClient.readContract({
                address: sortedToken1.address as `0x${string}`,
                abi: ERC20ABI,
                functionName: "balanceOf",
                args: [poolAddress],
              }) as unknown as Promise<bigint>,
            ]);

            // Calculate TVL
            const token0Value = parseFloat(formatUnits(token0Balance, sortedToken0.decimals || 18)) * (TOKEN_PRICES[sortedToken0.symbol] || 0);
            const token1Value = parseFloat(formatUnits(token1Balance, sortedToken1.decimals || 18)) * (TOKEN_PRICES[sortedToken1.symbol] || 0);
            const tvlUsd = token0Value + token1Value;

            // Mock volume and APY (would come from indexer/subgraph in production)
            const volume24h = tvlUsd * (0.05 + Math.random() * 0.15); // 5-20% of TVL
            const apy = volume24h > 0 ? ((volume24h * 365 * (fee / 1000000)) / tvlUsd) * 100 : 0;

            foundPools.push({
              address: poolAddress,
              token0Symbol: sortedToken0.symbol,
              token1Symbol: sortedToken1.symbol,
              token0Address: sortedToken0.address as `0x${string}`,
              token1Address: sortedToken1.address as `0x${string}`,
              token0Decimals: sortedToken0.decimals || 18,
              token1Decimals: sortedToken1.decimals || 18,
              fee,
              sqrtPriceX96: slot0[0] as bigint,
              tick: Number(slot0[1]),
              liquidity,
              token0Balance,
              token1Balance,
              tvlUsd,
              volume24h,
              apy,
            });
          } catch (e) {
            // Pool doesn't exist or error fetching, skip
            console.debug(`Pool ${pair.token0Symbol}/${pair.token1Symbol} ${fee / 10000}% not found`);
          }
        }
      }

      // Sort by TVL
      foundPools.sort((a, b) => b.tvlUsd - a.tvlUsd);
      setPools(foundPools);
    } catch (err: any) {
      console.error("Error fetching pools:", err);
      setError(err.message || "Failed to fetch pools");
    } finally {
      setIsLoading(false);
    }
  }, [publicClient, hubTokens]);

  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  // Calculate aggregate stats
  const stats = useMemo((): PoolStats => {
    const totalTvlUsd = pools.reduce((sum, p) => sum + p.tvlUsd, 0);
    const totalVolume24h = pools.reduce((sum, p) => sum + p.volume24h, 0);
    return {
      totalTvlUsd,
      totalVolume24h,
      userLiquidityUsd: 0, // Would need to calculate from positions
    };
  }, [pools]);

  return {
    pools,
    stats,
    isLoading,
    error,
    refetch: fetchPools,
  };
}

// Hook for single pool info
export function useSinglePoolInfo(poolAddress: `0x${string}` | undefined) {
  const publicClient = usePublicClient({ chainId: HUB_CHAIN_ID });
  const [poolData, setPoolData] = useState<{
    sqrtPriceX96: bigint;
    tick: number;
    liquidity: bigint;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!publicClient || !poolAddress || poolAddress === "0x0000000000000000000000000000000000000000") {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [slot0, liquidity] = await Promise.all([
          publicClient.readContract({
            address: poolAddress,
            abi: UniswapV3PoolABI,
            functionName: "slot0",
          }) as unknown as Promise<any[]>,
          publicClient.readContract({
            address: poolAddress,
            abi: UniswapV3PoolABI,
            functionName: "liquidity",
          }) as unknown as Promise<bigint>,
        ]);

        setPoolData({
          sqrtPriceX96: slot0[0] as bigint,
          tick: Number(slot0[1]),
          liquidity,
        });
      } catch (e) {
        console.error("Error fetching pool data:", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [publicClient, poolAddress]);

  return { poolData, isLoading };
}

// Calculate position value in USD
export function calculatePositionValue(
  liquidity: bigint,
  tickLower: number,
  tickUpper: number,
  currentTick: number,
  sqrtPriceX96: bigint,
  token0Symbol: string,
  token1Symbol: string,
  token0Decimals: number,
  token1Decimals: number
): { token0Amount: number; token1Amount: number; totalUsd: number } {
  // Simplified calculation - in production would use proper Uniswap math
  const price0 = TOKEN_PRICES[token0Symbol] || 0;
  const price1 = TOKEN_PRICES[token1Symbol] || 0;

  // Very rough estimate based on liquidity
  // Real calculation would use getLiquidityAmounts from SDK
  const liquidityNumber = Number(liquidity);
  const estimatedToken0 = liquidityNumber / Math.pow(10, token0Decimals);
  const estimatedToken1 = liquidityNumber / Math.pow(10, token1Decimals);

  return {
    token0Amount: estimatedToken0,
    token1Amount: estimatedToken1,
    totalUsd: estimatedToken0 * price0 + estimatedToken1 * price1,
  };
}

export default useAllPools;

