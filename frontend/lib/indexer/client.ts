/**
 * Indexer API Client
 * Used to fetch price data, pool info, and swap quotes from the indexer service
 */

// Configure this based on your deployment
export const INDEXER_API_URL = process.env.NEXT_PUBLIC_INDEXER_URL || 'http://localhost:3001';

// Types
export interface Pool {
  address: string;
  token0: string;
  token1: string;
  fee: number;
  tick_spacing: number;
  sqrt_price_x96: string;
  tick: number;
  liquidity: string;
  last_updated: number;
  token0_symbol: string;
  token0_name: string;
  token0_decimals: number;
  token1_symbol: string;
  token1_name: string;
  token1_decimals: number;
  price_token0_in_token1: string | null;
  price_token1_in_token0: string | null;
  fee_percent: number;
  change_24h?: {
    change: number;
    changePercent: number;
  } | null;
}

export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  created_at: number;
  pools?: { address: string; fee: number; token0: string; token1: string }[];
}

export interface PriceSnapshot {
  id: number;
  pool_address: string;
  timestamp: number;
  price_token0_in_token1: string;
  price_token1_in_token0: string;
  sqrt_price_x96: string;
  tick: number;
  liquidity: string;
}

export interface Candle {
  timestamp: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume_token0: string;
  volume_token1: string;
}

export interface SwapQuote {
  amountIn: string;
  amountOut: string;
  sqrtPriceX96After: string;
  initializedTicksCrossed: number;
  gasEstimate: string;
  fee: number;
}

export interface SwapRoute {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  bestRoute: SwapQuote;
  allRoutes: SwapQuote[];
}

export interface IndexerStatus {
  pools: number;
  tokens: number;
  priceSnapshots: number;
  lastIndexedBlock: string | null;
}

// API Response wrapper
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Fetch wrapper with error handling
async function fetchApi<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${INDEXER_API_URL}/api${endpoint}`);
  const json: ApiResponse<T> = await res.json();
  
  if (!json.success) {
    throw new Error(json.error || 'API request failed');
  }
  
  return json.data as T;
}

// ============================================================================
// POOLS API
// ============================================================================

export async function getPools(): Promise<Pool[]> {
  return fetchApi<Pool[]>('/pools');
}

export async function getPool(address: string): Promise<Pool> {
  return fetchApi<Pool>(`/pools/${address}`);
}

export async function getPoolByPair(
  token0: string,
  token1: string,
  fee?: number
): Promise<{ address: string; fee: number }[]> {
  const feeParam = fee ? `?fee=${fee}` : '';
  return fetchApi<{ address: string; fee: number }[]>(`/pools/pair/${token0}/${token1}${feeParam}`);
}

// ============================================================================
// PRICES & CHARTS API
// ============================================================================

export async function getCurrentPrice(poolAddress: string): Promise<{
  price0: string;
  price1: string;
  change_24h: { change: number; changePercent: number } | null;
}> {
  return fetchApi(`/prices/${poolAddress}`);
}

export async function getPriceHistory(
  poolAddress: string,
  options?: {
    from?: number;
    to?: number;
    limit?: number;
  }
): Promise<PriceSnapshot[]> {
  const params = new URLSearchParams();
  if (options?.from) params.set('from', options.from.toString());
  if (options?.to) params.set('to', options.to.toString());
  if (options?.limit) params.set('limit', options.limit.toString());
  
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchApi<PriceSnapshot[]>(`/prices/${poolAddress}/history${query}`);
}

export async function getCandles(
  poolAddress: string,
  options?: {
    interval?: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';
    from?: number;
    to?: number;
  }
): Promise<Candle[]> {
  const params = new URLSearchParams();
  if (options?.interval) params.set('interval', options.interval);
  if (options?.from) params.set('from', options.from.toString());
  if (options?.to) params.set('to', options.to.toString());
  
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchApi<Candle[]>(`/prices/${poolAddress}/candles${query}`);
}

// ============================================================================
// TOKENS API
// ============================================================================

export async function getTokens(): Promise<Token[]> {
  return fetchApi<Token[]>('/tokens');
}

export async function getToken(address: string): Promise<Token> {
  return fetchApi<Token>(`/tokens/${address}`);
}

// ============================================================================
// SWAP HELPER API
// ============================================================================

export async function getSwapQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  fee?: number
): Promise<SwapQuote> {
  const params = new URLSearchParams({
    tokenIn,
    tokenOut,
    amountIn,
  });
  if (fee) params.set('fee', fee.toString());
  
  return fetchApi<SwapQuote>(`/quote?${params.toString()}`);
}

export async function getBestSwapRoute(
  tokenIn: string,
  tokenOut: string,
  amountIn: string
): Promise<SwapRoute> {
  const params = new URLSearchParams({
    tokenIn,
    tokenOut,
    amountIn,
  });
  
  return fetchApi<SwapRoute>(`/route?${params.toString()}`);
}

// ============================================================================
// ADMIN API
// ============================================================================

export async function getIndexerStatus(): Promise<IndexerStatus> {
  return fetchApi<IndexerStatus>('/admin/status');
}

export async function syncPools(): Promise<void> {
  await fetch(`${INDEXER_API_URL}/api/admin/sync/pools`, { method: 'POST' });
}

export async function syncPrices(): Promise<void> {
  await fetch(`${INDEXER_API_URL}/api/admin/sync/prices`, { method: 'POST' });
}



