"use client";

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ExternalLink, TrendingUp, BarChart3, DollarSign, Activity } from 'lucide-react';
import Image from 'next/image';
import { getTokenLogoBySymbol } from '@/lib/tokens/logos';
import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';

const HUB_CHAIN_ID = 146;

// Pool ABI for reading tick data
const POOL_ABI = [
  {
    inputs: [],
    name: "slot0",
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "feeProtocol", type: "uint8" },
      { name: "unlocked", type: "bool" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "liquidity",
    outputs: [{ name: "", type: "uint128" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "token0",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "token1",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "fee",
    outputs: [{ name: "", type: "uint24" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "tickSpacing",
    outputs: [{ name: "", type: "int24" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ name: "tick", type: "int24" }],
    name: "ticks",
    outputs: [
      { name: "liquidityGross", type: "uint128" },
      { name: "liquidityNet", type: "int128" },
      { name: "feeGrowthOutside0X128", type: "uint256" },
      { name: "feeGrowthOutside1X128", type: "uint256" },
      { name: "tickCumulativeOutside", type: "int56" },
      { name: "secondsPerLiquidityOutsideX128", type: "uint160" },
      { name: "secondsOutside", type: "uint32" },
      { name: "initialized", type: "bool" }
    ],
    stateMutability: "view",
    type: "function"
  }
] as const;

const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function"
  }
] as const;

interface PoolAnalyticsProps {
  poolAddress: string;
  token0Symbol: string;
  token1Symbol: string;
  fee: number;
  onBack: () => void;
}

interface TickData {
  tick: number;
  liquidityNet: bigint;
  liquidityGross: bigint;
  price0: number;
  price1: number;
}

interface PoolStats {
  tvl: number;
  token0Amount: number;
  token1Amount: number;
  token0Value: number;
  token1Value: number;
  currentTick: number;
  currentPrice: number;
  fee: number;
  liquidity: bigint;
}

// Token prices (would use oracle in production)
const TOKEN_PRICES: Record<string, number> = {
  sWETH: 3370,
  sUSDC: 1,
  sUSDT: 1,
  sWBTC: 95000,
  MIM: 1,
  sMIM: 1,
};

export function PoolAnalytics({ poolAddress, token0Symbol, token1Symbol, fee, onBack }: PoolAnalyticsProps) {
  const [activeTab, setActiveTab] = useState<'TVL' | 'Volume' | 'Fees' | 'Liquidity'>('Liquidity');
  const [priceDirection, setPriceDirection] = useState<'0to1' | '1to0'>('0to1');

  // Fetch pool slot0
  const { data: slot0, isLoading: slot0Loading } = useReadContract({
    address: poolAddress as `0x${string}`,
    abi: POOL_ABI,
    functionName: 'slot0',
    chainId: HUB_CHAIN_ID,
  });

  // Fetch pool liquidity
  const { data: liquidity, isLoading: liquidityLoading } = useReadContract({
    address: poolAddress as `0x${string}`,
    abi: POOL_ABI,
    functionName: 'liquidity',
    chainId: HUB_CHAIN_ID,
  });

  // Fetch token addresses
  const { data: token0Addr } = useReadContract({
    address: poolAddress as `0x${string}`,
    abi: POOL_ABI,
    functionName: 'token0',
    chainId: HUB_CHAIN_ID,
  });

  const { data: token1Addr } = useReadContract({
    address: poolAddress as `0x${string}`,
    abi: POOL_ABI,
    functionName: 'token1',
    chainId: HUB_CHAIN_ID,
  });

  // Fetch token balances
  const { data: token0Balance } = useReadContract({
    address: token0Addr as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [poolAddress as `0x${string}`],
    chainId: HUB_CHAIN_ID,
    query: { enabled: !!token0Addr },
  });

  const { data: token1Balance } = useReadContract({
    address: token1Addr as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [poolAddress as `0x${string}`],
    chainId: HUB_CHAIN_ID,
    query: { enabled: !!token1Addr },
  });

  const { data: token0Decimals } = useReadContract({
    address: token0Addr as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'decimals',
    chainId: HUB_CHAIN_ID,
    query: { enabled: !!token0Addr },
  });

  const { data: token1Decimals } = useReadContract({
    address: token1Addr as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'decimals',
    chainId: HUB_CHAIN_ID,
    query: { enabled: !!token1Addr },
  });

  // Calculate pool stats
  const poolStats = useMemo<PoolStats | null>(() => {
    if (!slot0 || !liquidity || !token0Balance || !token1Balance || token0Decimals === undefined || token1Decimals === undefined) {
      return null;
    }

    const currentTick = Number(slot0[1]);
    const sqrtPriceX96 = slot0[0];
    // Raw price from sqrtPriceX96: token1 per token0
    const rawPrice = Math.pow(Number(sqrtPriceX96) / (2 ** 96), 2);
    // Adjust for decimal difference: multiply by 10^(token0Decimals - token1Decimals)
    const decimalAdjustment = Math.pow(10, Number(token0Decimals) - Number(token1Decimals));
    const price = rawPrice * decimalAdjustment;

    const token0Amount = parseFloat(formatUnits(token0Balance, token0Decimals));
    const token1Amount = parseFloat(formatUnits(token1Balance, token1Decimals));
    const token0Price = TOKEN_PRICES[token0Symbol] || 1;
    const token1Price = TOKEN_PRICES[token1Symbol] || 1;
    const token0Value = token0Amount * token0Price;
    const token1Value = token1Amount * token1Price;

    return {
      tvl: token0Value + token1Value,
      token0Amount,
      token1Amount,
      token0Value,
      token1Value,
      currentTick,
      currentPrice: price,
      fee,
      liquidity,
    };
  }, [slot0, liquidity, token0Balance, token1Balance, token0Decimals, token1Decimals, token0Symbol, token1Symbol, fee]);

  // For tick data, we'll show a simplified view since fetching many ticks requires batching
  const tickData = useMemo<TickData[]>(() => {
    if (!poolStats) return [];
    
    // Generate simulated tick distribution around current price
    // In production, you'd fetch actual tick data from an indexer
    const currentTick = poolStats.currentTick;
    const bars: TickData[] = [];
    const tickSpacing = fee === 100 ? 1 : fee === 500 ? 10 : fee === 3000 ? 60 : 200;
    
    for (let i = -30; i <= 30; i++) {
      const tick = Math.floor(currentTick / tickSpacing) * tickSpacing + i * tickSpacing;
      const distance = Math.abs(i);
      // Simulate liquidity concentration around current tick
      const baseLiquidity = Number(poolStats.liquidity / BigInt(1e12));
      const simulatedLiquidity = baseLiquidity * Math.exp(-distance * 0.1);
      
      if (simulatedLiquidity > 0) {
        const price0 = Math.pow(1.0001, tick);
        bars.push({
          tick,
          liquidityGross: BigInt(Math.floor(simulatedLiquidity)),
          liquidityNet: BigInt(0),
          price0,
          price1: 1 / price0,
        });
      }
    }
    
    return bars;
  }, [poolStats, fee]);

  const loading = slot0Loading || liquidityLoading || !poolStats;

  // Calculate liquidity distribution for chart
  const liquidityBars = useMemo(() => {
    if (!poolStats || tickData.length === 0) return [];

    const currentTick = poolStats.currentTick;
    let cumulativeLiquidity = poolStats.liquidity;
    
    // Build liquidity profile
    const bars: { tick: number; liquidity: number; isActive: boolean; price: number }[] = [];
    
    // Sort ticks and calculate cumulative liquidity
    const sortedTicks = [...tickData].sort((a, b) => a.tick - b.tick);
    
    for (let i = 0; i < sortedTicks.length; i++) {
      const tick = sortedTicks[i];
      const isActive = tick.tick <= currentTick && (i === sortedTicks.length - 1 || sortedTicks[i + 1].tick > currentTick);
      
      bars.push({
        tick: tick.tick,
        liquidity: Number(tick.liquidityGross),
        isActive,
        price: priceDirection === '0to1' ? tick.price0 : tick.price1,
      });
    }

    // Normalize for display
    const maxLiquidity = Math.max(...bars.map(b => b.liquidity), 1);
    return bars.map(b => ({
      ...b,
      height: (b.liquidity / maxLiquidity) * 100,
    }));
  }, [tickData, poolStats, priceDirection]);

  // Format price for display
  const formatPrice = (price: number) => {
    if (price >= 1000) return price.toFixed(2);
    if (price >= 1) return price.toFixed(4);
    if (price >= 0.0001) return price.toFixed(6);
    return price.toExponential(4);
  };

  const currentPrice = useMemo(() => {
    if (!poolStats) return 0;
    // poolStats.currentPrice is already decimal-adjusted (token1 per token0)
    // priceDirection '0to1' means show token1 per token0, '1to0' means token0 per token1
    return priceDirection === '0to1' ? poolStats.currentPrice : 1 / poolStats.currentPrice;
  }, [poolStats, priceDirection]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-400" />
          </button>
          <h1 className="text-xl font-semibold text-white">
            {token0Symbol}/{token1Symbol}
          </h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-2 border-zinc-500 border-t-zinc-200 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-400" />
        </button>
        
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-zinc-900 bg-zinc-800">
              <Image
                src={getTokenLogoBySymbol(token0Symbol)}
                alt={token0Symbol}
                width={40}
                height={40}
              />
            </div>
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-zinc-900 bg-zinc-800">
              <Image
                src={getTokenLogoBySymbol(token1Symbol)}
                alt={token1Symbol}
                width={40}
                height={40}
              />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white flex items-center gap-2">
              {token0Symbol}/{token1Symbol}
              <a
                href={`https://sonicscan.org/address/${poolAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-500 hover:text-zinc-300"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400">
                Fee {fee / 10000}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Price Display */}
      <div className="bg-zinc-900/50 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-zinc-500 text-sm mb-1">Current Price</div>
            <div className="text-2xl font-mono text-white">
              {formatPrice(currentPrice)} {priceDirection === '0to1' ? token1Symbol : token0Symbol}
            </div>
            <div className="text-zinc-500 text-sm">
              per {priceDirection === '0to1' ? token0Symbol : token1Symbol}
            </div>
          </div>
          <button
            onClick={() => setPriceDirection(d => d === '0to1' ? '1to0' : '0to1')}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 transition-colors"
          >
            ↔ Switch
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-sm mb-2">
            <DollarSign className="w-4 h-4" />
            Total Value Locked
          </div>
          <div className="text-xl font-semibold text-white">
            ${poolStats?.tvl.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </div>
        
        <div className="bg-zinc-900/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-sm mb-2">
            <Activity className="w-4 h-4" />
            24h Volume
          </div>
          <div className="text-xl font-semibold text-white">$0.00</div>
          <div className="text-xs text-zinc-500">No indexer yet</div>
        </div>
        
        <div className="bg-zinc-900/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-sm mb-2">
            <BarChart3 className="w-4 h-4" />
            24h Fees
          </div>
          <div className="text-xl font-semibold text-white">$0.00</div>
          <div className="text-xs text-zinc-500">No indexer yet</div>
        </div>
        
        <div className="bg-zinc-900/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-sm mb-2">
            <TrendingUp className="w-4 h-4" />
            APR
          </div>
          <div className="text-xl font-semibold text-emerald-400">
            {((fee / 10000) * 365 * 0.5).toFixed(2)}%
          </div>
          <div className="text-xs text-zinc-500">Estimated</div>
        </div>
      </div>

      {/* Pool Composition */}
      <div className="bg-zinc-900/50 rounded-xl p-4">
        <h3 className="text-zinc-400 text-sm mb-4">Pool Composition</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-800">
                <Image
                  src={getTokenLogoBySymbol(token0Symbol)}
                  alt={token0Symbol}
                  width={32}
                  height={32}
                />
              </div>
              <span className="text-white">{token0Symbol}</span>
            </div>
            <div className="text-right">
              <div className="text-white font-mono">
                {poolStats?.token0Amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}
              </div>
              <div className="text-zinc-500 text-sm">
                ${poolStats?.token0Value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-800">
                <Image
                  src={getTokenLogoBySymbol(token1Symbol)}
                  alt={token1Symbol}
                  width={32}
                  height={32}
                />
              </div>
              <span className="text-white">{token1Symbol}</span>
            </div>
            <div className="text-right">
              <div className="text-white font-mono">
                {poolStats?.token1Amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}
              </div>
              <div className="text-zinc-500 text-sm">
                ${poolStats?.token1Value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Liquidity Distribution Chart */}
      <div className="bg-zinc-900/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-zinc-400 text-sm">Liquidity Distribution</h3>
          <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1">
            {(['TVL', 'Volume', 'Fees', 'Liquidity'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  activeTab === tab
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Chart Area */}
        <div className="relative h-64 mt-4">
          {activeTab === 'Liquidity' && liquidityBars.length > 0 ? (
            <div className="absolute inset-0 flex items-end justify-center gap-[1px]">
              {liquidityBars.map((bar, i) => (
                <div
                  key={bar.tick}
                  className="group relative flex-1 max-w-2"
                  style={{ height: '100%' }}
                >
                  <div
                    className={`absolute bottom-0 w-full rounded-t transition-colors ${
                      bar.isActive
                        ? 'bg-emerald-500'
                        : bar.tick < (poolStats?.currentTick || 0)
                        ? 'bg-cyan-600/60'
                        : 'bg-cyan-600/60'
                    }`}
                    style={{ height: `${Math.max(bar.height, 1)}%` }}
                  />
                  
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-xs whitespace-nowrap shadow-xl">
                      <div className="text-zinc-400">Tick: {bar.tick}</div>
                      <div className="text-white">
                        Price: {formatPrice(bar.price)} {priceDirection === '0to1' ? token1Symbol : token0Symbol}
                      </div>
                      <div className="text-zinc-400">
                        Liquidity: {bar.liquidity.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Current price line */}
              <div 
                className="absolute bottom-0 w-0.5 bg-white/50 h-full"
                style={{ 
                  left: `${((liquidityBars.findIndex(b => b.isActive) + 0.5) / liquidityBars.length) * 100}%` 
                }}
              />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-zinc-500 text-sm">
                {activeTab === 'Liquidity' 
                  ? 'No liquidity data available'
                  : 'Historical data requires indexer (coming soon)'}
              </div>
            </div>
          )}
        </div>

        {/* Price Range Indicator */}
        {liquidityBars.length > 0 && (
          <div className="mt-4 flex justify-between text-xs text-zinc-500">
            <span>{formatPrice(liquidityBars[0]?.price || 0)}</span>
            <span className="text-emerald-400">Current: {formatPrice(currentPrice)}</span>
            <span>{formatPrice(liquidityBars[liquidityBars.length - 1]?.price || 0)}</span>
          </div>
        )}
      </div>

      {/* Tick Stats */}
      {poolStats && (
        <div className="bg-zinc-900/50 rounded-xl p-4">
          <h3 className="text-zinc-400 text-sm mb-4">Tick Information</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-zinc-500">Current Tick</div>
              <div className="text-white font-mono">{poolStats.currentTick}</div>
            </div>
            <div>
              <div className="text-zinc-500">Active Liquidity</div>
              <div className="text-white font-mono">{poolStats.liquidity.toString()}</div>
            </div>
            <div>
              <div className="text-zinc-500">Initialized Ticks</div>
              <div className="text-white font-mono">{tickData.length}</div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default PoolAnalytics;

