'use client';

import React, { useMemo, useState } from 'react';
import { useCandles, useCurrentPrice, usePriceChange, Candle } from '@/lib/indexer';

interface PriceChartProps {
  poolAddress: string;
  token0Symbol?: string;
  token1Symbol?: string;
  height?: number;
  showControls?: boolean;
}

type TimeInterval = '1h' | '4h' | '1d' | '1w';

export function PriceChart({
  poolAddress,
  token0Symbol = 'Token0',
  token1Symbol = 'Token1',
  height = 300,
  showControls = true,
}: PriceChartProps) {
  const [interval, setInterval] = useState<TimeInterval>('1h');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | '1y'>('7d');

  // Calculate from timestamp based on time range
  const fromTimestamp = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const ranges: Record<string, number> = {
      '24h': now - 86400,
      '7d': now - 86400 * 7,
      '30d': now - 86400 * 30,
      '1y': now - 86400 * 365,
    };
    return ranges[timeRange];
  }, [timeRange]);

  const { candles, loading, error } = useCandles(
    poolAddress,
    { interval, from: fromTimestamp },
    60000 // Refresh every minute
  );

  const { price } = useCurrentPrice(poolAddress);
  const priceChange = usePriceChange(price?.change_24h || null);

  // Calculate chart dimensions
  const chartData = useMemo(() => {
    if (!candles || candles.length === 0) return null;

    const prices = candles.map((c) => parseFloat(c.close));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;

    // Add 10% padding
    const paddedMin = minPrice - priceRange * 0.1;
    const paddedMax = maxPrice + priceRange * 0.1;
    const paddedRange = paddedMax - paddedMin;

    return {
      candles,
      minPrice: paddedMin,
      maxPrice: paddedMax,
      priceRange: paddedRange,
      prices,
    };
  }, [candles]);

  // Generate SVG path for line chart
  const linePath = useMemo(() => {
    if (!chartData) return '';

    const { candles, minPrice, priceRange } = chartData;
    const width = 100;
    const chartHeight = 100;

    const points = candles.map((candle, i) => {
      const x = (i / (candles.length - 1)) * width;
      const y = chartHeight - ((parseFloat(candle.close) - minPrice) / priceRange) * chartHeight;
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  }, [chartData]);

  // Generate area path (for gradient fill)
  const areaPath = useMemo(() => {
    if (!chartData || !linePath) return '';
    return `${linePath} L 100,100 L 0,100 Z`;
  }, [chartData, linePath]);

  // Determine if price is up or down
  const isUp = useMemo(() => {
    if (!chartData || chartData.candles.length < 2) return true;
    const first = parseFloat(chartData.candles[0].close);
    const last = parseFloat(chartData.candles[chartData.candles.length - 1].close);
    return last >= first;
  }, [chartData]);

  const chartColor = isUp ? '#22c55e' : '#ef4444';

  if (loading && !candles.length) {
    return (
      <div
        className="flex items-center justify-center bg-gray-900/50 rounded-xl border border-gray-800"
        style={{ height }}
      >
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex items-center justify-center bg-gray-900/50 rounded-xl border border-gray-800 text-red-400"
        style={{ height }}
      >
        <p>Error loading chart: {error}</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {token0Symbol}/{token1Symbol}
            </h3>
            {price && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl font-bold text-white">
                  {parseFloat(price.price0).toLocaleString(undefined, {
                    maximumFractionDigits: 6,
                  })}
                </span>
                <span className={`text-sm font-medium ${priceChange.color}`}>
                  {priceChange.formatted}
                </span>
              </div>
            )}
          </div>

          {showControls && (
            <div className="flex gap-2">
              {/* Time range selector */}
              <div className="flex bg-gray-800 rounded-lg p-1">
                {(['24h', '7d', '30d', '1y'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      timeRange === range
                        ? 'bg-purple-600 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>

              {/* Interval selector */}
              <div className="flex bg-gray-800 rounded-lg p-1">
                {(['1h', '4h', '1d', '1w'] as const).map((int) => (
                  <button
                    key={int}
                    onClick={() => setInterval(int)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      interval === int
                        ? 'bg-purple-600 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {int}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="relative" style={{ height: height - 80 }}>
        {chartData && (
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full"
          >
            {/* Gradient definition */}
            <defs>
              <linearGradient id={`gradient-${poolAddress}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColor} stopOpacity="0.3" />
                <stop offset="100%" stopColor={chartColor} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Area fill */}
            <path d={areaPath} fill={`url(#gradient-${poolAddress})`} />

            {/* Line */}
            <path
              d={linePath}
              fill="none"
              stroke={chartColor}
              strokeWidth="0.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}

        {/* Price labels */}
        {chartData && (
          <div className="absolute right-2 top-2 bottom-2 flex flex-col justify-between text-xs text-gray-500">
            <span>
              {chartData.maxPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </span>
            <span>
              {((chartData.maxPrice + chartData.minPrice) / 2).toLocaleString(undefined, {
                maximumFractionDigits: 4,
              })}
            </span>
            <span>
              {chartData.minPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </span>
          </div>
        )}

        {/* No data message */}
        {(!chartData || chartData.candles.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500">
            No price data available
          </div>
        )}
      </div>
    </div>
  );
}

export default PriceChart;



