"use client";

import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import Image from 'next/image';
import { getTokenLogoBySymbol } from '@/lib/tokens/logos';
import { usePoolByPair, useCandles, useCurrentPrice } from '@/lib/indexer/hooks';
import { getTokensForChain } from '@/lib/tokens/tokenList';

// Hub chain ID where pools exist
const HUB_CHAIN_ID = 146;

// Stablecoins - if one of the pair tokens is a stablecoin, show price in stablecoin
const STABLECOINS = ['USDC', 'USDT', 'DAI', 'sUSDC', 'sUSDT', 'sDAI', 'USDbC'];

// Map from source chain tokens to Hub synthetic tokens
const TOKEN_TO_SYNTHETIC: Record<string, string> = {
  'WETH': 'sWETH',
  'ETH': 'sWETH',
  'USDT': 'sUSDT',
  'USDC': 'sUSDC',
  'DAI': 'sDAI',
  'WBTC': 'sWBTC',
  // Synthetic tokens map to themselves
  'sWETH': 'sWETH',
  'sUSDT': 'sUSDT',
  'sUSDC': 'sUSDC',
  'sDAI': 'sDAI',
  'sWBTC': 'sWBTC',
  'S': 'S',
};

interface PriceChartProps {
  token0Symbol?: string;
  token1Symbol?: string;
  chainId?: number;
}

// Fallback mock data if indexer is unavailable
const generateMockData = (basePrice: number = 1) => {
  const data = [];
  let price = basePrice;
  const now = Date.now();
  
  for (let i = 47; i >= 0; i--) {
    const timestamp = now - i * 3600000;
    const hour = new Date(timestamp).getHours();
    const time = `${hour.toString().padStart(2, '0')}:00`;
    price = price + (Math.random() - 0.5) * (basePrice * 0.02);
    data.push({
      time,
      timestamp,
      price: parseFloat(price.toFixed(6)),
    });
  }
  
  return data;
};

const CustomTooltip = ({ active, payload, quoteSymbol }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ backgroundColor: '#18181b', padding: '8px 12px', borderRadius: '8px' }}>
        <p style={{ color: '#a1a1aa' }}>{payload[0].payload.time}</p>
        <p style={{ color: '#fafafa' }}>
          {parseFloat(payload[0].value).toLocaleString(undefined, { maximumFractionDigits: 6 })} {quoteSymbol}
        </p>
      </div>
    );
  }
  return null;
};

export function PriceChart({ token0Symbol = 'WETH', token1Symbol = 'USDC' }: PriceChartProps) {
  const [timeframe, setTimeframe] = useState<'1h' | '4h' | '1d'>('1h');
  const [view, setView] = useState('Price');

  // Get Hub chain tokens for price lookup
  const hubTokens = useMemo(() => getTokensForChain(HUB_CHAIN_ID), []);

  // Normalize tokens: map to Hub synthetic tokens and determine base/quote
  const { baseSymbol, quoteSymbol, baseToken, quoteToken, isInverted } = useMemo(() => {
    // Map input symbols to Hub synthetic tokens
    const synth0 = TOKEN_TO_SYNTHETIC[token0Symbol] || token0Symbol;
    const synth1 = TOKEN_TO_SYNTHETIC[token1Symbol] || token1Symbol;
    
    // Determine which is base and which is quote
    // If one is a stablecoin, it should be the quote (denominator)
    const is0Stable = STABLECOINS.includes(synth0);
    const is1Stable = STABLECOINS.includes(synth1);
    
    let base: string;
    let quote: string;
    let inverted = false;
    
    if (is0Stable && !is1Stable) {
      // token0 is stable, so token1 is base, show price of token1 in token0
      base = synth1;
      quote = synth0;
      inverted = true;
    } else if (!is0Stable && is1Stable) {
      // token1 is stable, so token0 is base, show price of token0 in token1
      base = synth0;
      quote = synth1;
      inverted = false;
    } else {
      // Neither or both are stablecoins, use as-is (token0 priced in token1)
      base = synth0;
      quote = synth1;
      inverted = false;
    }
    
    const baseT = hubTokens.find(t => t.symbol === base);
    const quoteT = hubTokens.find(t => t.symbol === quote);
    
    return { 
      baseSymbol: base, 
      quoteSymbol: quote, 
      baseToken: baseT, 
      quoteToken: quoteT,
      isInverted: inverted
    };
  }, [token0Symbol, token1Symbol, hubTokens]);

  // Find pool for the token pair on Hub chain
  const { pools, loading: poolLoading } = usePoolByPair(
    baseToken?.address || null,
    quoteToken?.address || null
  );

  const poolAddress = pools.length > 0 ? pools[0].address : null;

  // Get current price from indexer
  const { price: currentPriceData, loading: priceLoading } = useCurrentPrice(poolAddress, 30000);

  // Get candles from indexer
  const { candles, loading: candlesLoading } = useCandles(
    poolAddress,
    { interval: timeframe },
    60000
  );

  // Convert candles to chart data or use mock data
  const chartData = useMemo(() => {
    if (candles && candles.length > 0) {
      return candles.map((candle) => {
        const date = new Date(candle.timestamp * 1000);
        // If inverted, we might need to invert the price (depends on pool token order)
        const price = parseFloat(candle.close);
        return {
          time: `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`,
          timestamp: candle.timestamp,
          price: price,
        };
      });
    }
    
    // Generate mock data based on token pair
    let mockBasePrice = 1;
    if (baseSymbol === 'sWETH' || baseSymbol === 'WETH') {
      mockBasePrice = 3370;
    } else if (baseSymbol === 'sWBTC' || baseSymbol === 'WBTC') {
      mockBasePrice = 95000;
    } else if (baseSymbol === 'S') {
      mockBasePrice = 0.52;
    }
    
    return generateMockData(mockBasePrice);
  }, [candles, baseSymbol]);

  // Calculate current price and change
  const currentPrice = useMemo(() => {
    if (currentPriceData?.price0) {
      // price0 = price of token0 in terms of token1
      // We need to check if the pool's token order matches our expected order
      return parseFloat(currentPriceData.price0);
    }
    if (chartData.length > 0) {
      return chartData[chartData.length - 1].price;
    }
    return 0;
  }, [currentPriceData, chartData]);

  const priceChange = useMemo(() => {
    if (currentPriceData?.change_24h) {
      return currentPriceData.change_24h.changePercent;
    }
    if (chartData.length > 1) {
      const firstPrice = chartData[0].price;
      const lastPrice = chartData[chartData.length - 1].price;
      if (firstPrice === 0) return 0;
      return ((lastPrice - firstPrice) / firstPrice) * 100;
    }
    return 0;
  }, [currentPriceData, chartData]);

  const isLoading = poolLoading || priceLoading || candlesLoading;

  // Display symbol (show original symbols for UI, but price is normalized)
  const displayBase = isInverted ? token1Symbol : token0Symbol;
  const displayQuote = isInverted ? token0Symbol : token1Symbol;

  return (
    <div className="p-6 w-[120%] -ml-[20%]">
      {/* Token pair header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center -space-x-2">
          <div className="w-10 h-10 rounded-full border-2 border-zinc-950 overflow-hidden bg-gradient-to-br from-zinc-400 to-zinc-500">
            <Image 
              src={getTokenLogoBySymbol(displayBase)} 
              alt={displayBase} 
              width={40} 
              height={40} 
              className="w-full h-full object-cover token-icon"
            />
          </div>
          <div className="w-10 h-10 rounded-full border-2 border-zinc-950 overflow-hidden bg-gradient-to-br from-zinc-500 to-zinc-600">
            <Image 
              src={getTokenLogoBySymbol(displayQuote)} 
              alt={displayQuote} 
              width={40} 
              height={40} 
              className="w-full h-full object-cover token-icon"
            />
          </div>
        </div>
        <div>
          <div className="text-zinc-500">Token pair</div>
          <div className="text-zinc-100">{displayBase}/{displayQuote}</div>
        </div>
        {isLoading && (
          <div className="ml-auto">
            <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Current price */}
      <div className="mb-6">
        <div className="flex items-baseline gap-3 mb-1">
          <span className="text-zinc-100 text-2xl">
            {currentPrice > 0 ? currentPrice.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '—'} {displayQuote}
          </span>
          <span className={priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}>
            {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
          </span>
        </div>
        <div className="text-zinc-500">Current price</div>
      </div>

      {/* Chart controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          {(['1h', '4h', '1d'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 rounded-lg transition-colors ${
                timeframe === tf
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {['Price', 'Liquidity'].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 rounded-lg transition-colors ${
                view === v
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="w-full min-w-0" style={{ height: '320px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={priceChange >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0.3} />
                <stop offset="100%" stopColor={priceChange >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              stroke="#52525b"
              style={{ fontSize: '12px' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              tickFormatter={(value, index) => {
                if (index % 6 === 0) return value;
                return '';
              }}
            />
            <YAxis
              stroke="#52525b"
              style={{ fontSize: '12px' }}
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
              tickFormatter={(value) => value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            />
            <Tooltip content={<CustomTooltip quoteSymbol={displayQuote} />} />
            <Area
              type="monotone"
              dataKey="price"
              stroke={priceChange >= 0 ? '#10b981' : '#ef4444'}
              strokeWidth={2}
              fill="url(#priceGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Stats below chart */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-zinc-800">
        <div>
          <div className="text-zinc-500 mb-1">24h Volume</div>
          <div className="text-zinc-100">$2.4M</div>
        </div>
        <div>
          <div className="text-zinc-500 mb-1">24h High</div>
          <div className="text-zinc-100">
            {chartData.length > 0 
              ? Math.max(...chartData.map(d => d.price)).toLocaleString(undefined, { maximumFractionDigits: 4 })
              : '—'}
          </div>
        </div>
        <div>
          <div className="text-zinc-500 mb-1">24h Low</div>
          <div className="text-zinc-100">
            {chartData.length > 0 
              ? Math.min(...chartData.map(d => d.price)).toLocaleString(undefined, { maximumFractionDigits: 4 })
              : '—'}
          </div>
        </div>
      </div>
    </div>
  );
}
