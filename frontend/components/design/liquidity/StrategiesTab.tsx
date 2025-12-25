"use client";

import { Search, Info, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';

const STRATEGIES = [
  {
    id: 1,
    name: 'WAGMI/Anon',
    badge: '0%',
    range: '0x85...C6',
    tvl: '$755,326.81',
    maxCap: '$767,439.61',
    fees24h: '$25.44',
    totalFees: '$197,019.28',
    apr: '1.23%',
  },
  {
    id: 2,
    name: 'WS/WETH',
    badge: '10%',
    range: '0xc4...0a',
    tvl: '$123,747.53',
    maxCap: '$255,147.16',
    fees24h: '$95.91',
    totalFees: '$626,016.05',
    apr: '28.29%',
  },
  {
    id: 3,
    name: 'WS/WAGMI',
    badge: '2%',
    range: '0x29...9C',
    tvl: '$103,655.7',
    maxCap: '$117,158.16',
    fees24h: '$28.96',
    totalFees: '$170,224.79',
    apr: '10.2%',
  },
  {
    id: 4,
    name: 'WS/USDC.e',
    badge: '10%',
    range: '0x63...61',
    tvl: '$94,115.68',
    maxCap: '$407,029.79',
    fees24h: '$47.9',
    totalFees: '$2,649,909.86',
    apr: '18.58%',
  },
];

export function StrategiesTab() {
  const [gmiSupported, setGmiSupported] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div>
      {/* Hero Section */}
      <div className="mb-12">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <h1 className="text-4xl text-zinc-100">Strategies</h1>
              <span className="px-3 py-1 bg-zinc-800 text-zinc-100 rounded-lg text-sm">
                Up to 224.14% APR
              </span>
            </div>
            <p className="text-zinc-400 mb-3 max-w-xl">
              Multipools where liquidity is managed by the protocol ensuring
              you always earn with maximum efficiency
            </p>
            <a href="#" className="text-zinc-500 hover:text-zinc-300 transition-colors inline-flex items-center gap-1 mb-4">
              Learn more about Strategies <ExternalLink className="w-3 h-3" />
            </a>
            <div className="text-zinc-500 mb-4">
              Protocol Commission: 20%
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-8">
          <div>
            <div className="text-zinc-500 mb-1">Pairs</div>
            <div className="text-zinc-100 text-xl">18</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setGmiSupported(!gmiSupported)}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              gmiSupported
                ? 'bg-zinc-100 text-zinc-950'
                : 'bg-zinc-800/50 text-zinc-400'
            }`}
          >
            <span className="text-xs">⚡</span>
            GMI supported
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            className="pl-10 pr-4 py-2 bg-zinc-900/30 text-zinc-100 placeholder:text-zinc-600 rounded-lg outline-none focus:ring-1 focus:ring-zinc-700 transition-all w-64"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden overflow-x-auto">
        {/* Table Header */}
        <div className="grid gap-4 px-6 py-3 text-zinc-500 border-b border-zinc-800 min-w-[900px]" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 100px' }}>
          <div>Token pair</div>
          <div className="flex items-center gap-1">
            TVL
            <Info className="w-3 h-3" />
          </div>
          <div className="flex items-center gap-1">
            Max cap
            <Info className="w-3 h-3" />
          </div>
          <div className="flex items-center gap-1">
            Fees 24h
            <Info className="w-3 h-3" />
          </div>
          <div className="flex items-center gap-1">
            Total fees
            <Info className="w-3 h-3" />
          </div>
          <div className="flex items-center gap-1">
            APR
            <Info className="w-3 h-3" />
          </div>
          <div></div>
        </div>

        {/* Table Rows */}
        <div className="space-y-2 min-w-[900px]">
          {STRATEGIES.map((strategy, index) => (
            <motion.div
              key={strategy.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="grid gap-4 px-6 py-4 bg-zinc-900/30 hover:bg-zinc-900/50 transition-colors items-center"
              style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 100px' }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center -space-x-2 flex-shrink-0">
                  <div className="w-6 h-6 rounded-full bg-zinc-700 border-2 border-zinc-950" />
                  <div className="w-6 h-6 rounded-full bg-zinc-600 border-2 border-zinc-950" />
                </div>
                <div className="min-w-0">
                  <div className="text-zinc-100 flex items-center gap-2 flex-wrap">
                    <span className="whitespace-nowrap">{strategy.name}</span>
                    <span className="text-xs px-2 py-0.5 bg-zinc-800/50 text-zinc-400 rounded whitespace-nowrap flex-shrink-0">
                      {strategy.badge}
                    </span>
                  </div>
                  <div className="text-zinc-500 text-xs flex items-center gap-1">
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{strategy.range}</span>
                  </div>
                </div>
              </div>
              <div className="text-zinc-100 truncate">{strategy.tvl}</div>
              <div className="text-zinc-100 truncate">{strategy.maxCap}</div>
              <div className="text-zinc-100 truncate">{strategy.fees24h}</div>
              <div className="text-zinc-100 truncate">{strategy.totalFees}</div>
              <div className="text-zinc-100 truncate">{strategy.apr}</div>
              <div className="flex justify-end">
                <button className="px-4 py-2 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-zinc-100 rounded-lg transition-all whitespace-nowrap">
                  Join
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

