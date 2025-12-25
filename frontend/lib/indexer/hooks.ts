'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getPools,
  getPool,
  getPoolByPair,
  getCurrentPrice,
  getPriceHistory,
  getCandles,
  getTokens,
  getToken,
  getSwapQuote,
  getBestSwapRoute,
  Pool,
  Token,
  PriceSnapshot,
  Candle,
  SwapQuote,
  SwapRoute,
} from './client';

// ============================================================================
// POOLS HOOKS
// ============================================================================

/**
 * Hook to fetch all pools
 */
export function usePools(refreshInterval?: number) {
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPools = useCallback(async () => {
    try {
      const data = await getPools();
      setPools(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPools();
    
    if (refreshInterval) {
      const interval = setInterval(fetchPools, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchPools, refreshInterval]);

  return { pools, loading, error, refetch: fetchPools };
}

/**
 * Hook to fetch a single pool
 */
export function usePool(address: string | null, refreshInterval?: number) {
  const [pool, setPool] = useState<Pool | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPool = useCallback(async () => {
    if (!address) {
      setLoading(false);
      return;
    }

    try {
      const data = await getPool(address);
      setPool(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      setPool(null);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchPool();
    
    if (refreshInterval && address) {
      const interval = setInterval(fetchPool, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchPool, refreshInterval, address]);

  return { pool, loading, error, refetch: fetchPool };
}

/**
 * Hook to find pools by token pair
 */
export function usePoolByPair(token0: string | null, token1: string | null, fee?: number) {
  const [pools, setPools] = useState<{ address: string; fee: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token0 || !token1) {
      setPools([]);
      return;
    }

    setLoading(true);
    getPoolByPair(token0, token1, fee)
      .then((data) => {
        setPools(data);
        setError(null);
      })
      .catch((err) => {
        setError(err.message);
        setPools([]);
      })
      .finally(() => setLoading(false));
  }, [token0, token1, fee]);

  return { pools, loading, error };
}

// ============================================================================
// PRICE HOOKS
// ============================================================================

/**
 * Hook to get current price for a pool
 */
export function useCurrentPrice(poolAddress: string | null, refreshInterval: number = 60000) {
  const [price, setPrice] = useState<{
    price0: string;
    price1: string;
    change_24h: { change: number; changePercent: number } | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrice = useCallback(async () => {
    if (!poolAddress) {
      setLoading(false);
      return;
    }

    try {
      const data = await getCurrentPrice(poolAddress);
      setPrice(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [poolAddress]);

  useEffect(() => {
    fetchPrice();
    
    if (refreshInterval && poolAddress) {
      const interval = setInterval(fetchPrice, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchPrice, refreshInterval, poolAddress]);

  return { price, loading, error, refetch: fetchPrice };
}

/**
 * Hook to get price history for a pool
 */
export function usePriceHistory(
  poolAddress: string | null,
  options?: {
    from?: number;
    to?: number;
    limit?: number;
  }
) {
  const [history, setHistory] = useState<PriceSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fromTs = options?.from;
  const toTs = options?.to;
  const limit = options?.limit;

  useEffect(() => {
    if (!poolAddress) {
      setLoading(false);
      return;
    }

    setLoading(true);
    getPriceHistory(poolAddress, { from: fromTs, to: toTs, limit })
      .then((data) => {
        setHistory(data);
        setError(null);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [poolAddress, fromTs, toTs, limit]);

  return { history, loading, error };
}

/**
 * Hook to get OHLCV candles for charts
 */
export function useCandles(
  poolAddress: string | null,
  options?: {
    interval?: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';
    from?: number;
    to?: number;
  },
  refreshInterval?: number
) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const interval = options?.interval;
  const fromTs = options?.from;
  const toTs = options?.to;

  const fetchCandles = useCallback(async () => {
    if (!poolAddress) {
      setLoading(false);
      return;
    }

    try {
      const data = await getCandles(poolAddress, { interval, from: fromTs, to: toTs });
      setCandles(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [poolAddress, interval, fromTs, toTs]);

  useEffect(() => {
    fetchCandles();
    
    if (refreshInterval && poolAddress) {
      const refreshTimer = setInterval(fetchCandles, refreshInterval);
      return () => clearInterval(refreshTimer);
    }
  }, [fetchCandles, refreshInterval, poolAddress]);

  return { candles, loading, error, refetch: fetchCandles };
}

// ============================================================================
// TOKENS HOOKS
// ============================================================================

/**
 * Hook to fetch all tokens
 */
export function useTokens() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTokens()
      .then((data) => {
        setTokens(data);
        setError(null);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  return { tokens, loading, error };
}

/**
 * Hook to fetch a single token
 */
export function useToken(address: string | null) {
  const [token, setToken] = useState<Token | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }

    getToken(address)
      .then((data) => {
        setToken(data);
        setError(null);
      })
      .catch((err) => {
        setError(err.message);
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, [address]);

  return { token, loading, error };
}

// ============================================================================
// SWAP HOOKS
// ============================================================================

/**
 * Hook to get a swap quote
 */
export function useSwapQuote(
  tokenIn: string | null,
  tokenOut: string | null,
  amountIn: string | null,
  fee?: number,
  debounceMs: number = 300
) {
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenIn || !tokenOut || !amountIn || parseFloat(amountIn) <= 0) {
      setQuote(null);
      setError(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await getSwapQuote(tokenIn, tokenOut, amountIn, fee);
        setQuote(data);
        setError(null);
      } catch (err: any) {
        setError(err.message);
        setQuote(null);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [tokenIn, tokenOut, amountIn, fee, debounceMs]);

  return { quote, loading, error };
}

/**
 * Hook to find best swap route
 */
export function useBestRoute(
  tokenIn: string | null,
  tokenOut: string | null,
  amountIn: string | null,
  debounceMs: number = 300
) {
  const [route, setRoute] = useState<SwapRoute | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenIn || !tokenOut || !amountIn || parseFloat(amountIn) <= 0) {
      setRoute(null);
      setError(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await getBestSwapRoute(tokenIn, tokenOut, amountIn);
        setRoute(data);
        setError(null);
      } catch (err: any) {
        setError(err.message);
        setRoute(null);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [tokenIn, tokenOut, amountIn, debounceMs]);

  return { route, loading, error };
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook to format price for display
 */
export function useFormattedPrice(price: string | null, decimals: number = 6): string {
  return useMemo(() => {
    if (!price) return '0';
    
    const num = parseFloat(price);
    if (num === 0) return '0';
    if (num < 0.000001) return num.toExponential(4);
    if (num < 1) return num.toFixed(decimals);
    if (num < 1000) return num.toFixed(4);
    if (num < 1000000) return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
    
    return num.toExponential(4);
  }, [price, decimals]);
}

/**
 * Hook to calculate and format price change
 */
export function usePriceChange(change: { change: number; changePercent: number } | null): {
  formatted: string;
  isPositive: boolean;
  color: string;
} {
  return useMemo(() => {
    if (!change) {
      return { formatted: '0%', isPositive: true, color: 'text-gray-500' };
    }

    const isPositive = change.changePercent >= 0;
    const sign = isPositive ? '+' : '';
    const formatted = `${sign}${change.changePercent.toFixed(2)}%`;
    const color = isPositive ? 'text-green-500' : 'text-red-500';

    return { formatted, isPositive, color };
  }, [change]);
}



