"use client";

import { Search, ChevronDown, Info, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';

const LEVERAGE_POOLS = [
  {
    id: 1,
    name: 'WS/Anon',
    leftToBorrow: [
      { amount: '77,314.8533', color: 'zinc' },
      { amount: '6,981.4536', color: 'zinc' }
    ],
    borrowed: [
      { amount: '43.9822', color: 'zinc' },
      { amount: '9,047.2423', color: 'zinc' }
    ],
    protocols: ['Protocol 1'],
    apr: ['87.6%', '87.6%'],
    fees1d: ['0.1056', '21.7134'],
  },
  {
    id: 2,
    name: 'WS/WAGMI',
    leftToBorrow: [
      { amount: '155,073.80...', color: 'orange' },
      { amount: '6,330,206...', color: 'orange' }
    ],
    borrowed: [
      { amount: '0', color: 'orange' },
      { amount: '512,229.15...', color: 'orange' }
    ],
    protocols: ['Protocol 2'],
    apr: ['87.6%', '87.6%'],
    fees1d: ['0', '1,229.35'],
  },
  {
    id: 3,
    name: 'WAGMI/Anon',
    leftToBorrow: [
      { amount: '150,179.93...', color: 'orange' },
      { amount: '336.5424', color: 'zinc' }
    ],
    borrowed: [
      { amount: '0', color: 'orange' },
      { amount: '0', color: 'zinc' }
    ],
    protocols: ['Protocol 3'],
    apr: ['87.6%', '87.6%'],
    fees1d: ['0', '0'],
  },
  {
    id: 4,
    name: 'WS/USDC.e',
    leftToBorrow: [
      { amount: '669.4914', color: 'zinc' },
      { amount: '64.1528', color: 'blue' }
    ],
    borrowed: [
      { amount: '3,546.4225', color: 'zinc' },
      { amount: '0', color: 'blue' }
    ],
    protocols: ['Protocol 4'],
    apr: ['87.6%', '87.6%'],
    fees1d: ['8.5114', '0'],
  },
  {
    id: 5,
    name: 'SONIC/EQUAL',
    leftToBorrow: [
      { amount: '7,826.0906', color: 'gray' },
      { amount: '2.5722', color: 'gray' }
    ],
    borrowed: [
      { amount: '0', color: 'gray' },
      { amount: '0', color: 'gray' }
    ],
    protocols: ['Protocol 5'],
    apr: ['87.6%', '87.6%'],
    fees1d: ['0', '0'],
  },
];

const NETWORK_ICONS = ['Ⓐ', 'Ⓞ', '⬣', 'Ⓢ', '◉', '◎'];

const getColorClass = (color: string) => {
  switch (color) {
    case 'orange':
      return 'text-orange-400';
    case 'blue':
      return 'text-blue-400';
    case 'gray':
      return 'text-zinc-500';
    default:
      return 'text-zinc-100';
  }
};

export function LeverageTab() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div>
      {/* Hero Section */}
      <div className="mb-12">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <h1 className="text-4xl text-zinc-100">Leverage</h1>
              <span className="px-3 py-1 bg-zinc-800 text-zinc-100 rounded-lg text-sm">
                Up to 233.6% APR
              </span>
            </div>
            <p className="text-zinc-400 mb-3 max-w-xl">
              Approve your V3 position to be used as a source of liquidity for
              leverage and earn from fixed APR
            </p>
            <a href="#" className="text-zinc-500 hover:text-zinc-300 transition-colors inline-flex items-center gap-1 mb-4">
              Learn more about Leverage <ExternalLink className="w-3 h-3" />
            </a>
            <div className="text-zinc-500 mb-4">
              Protocol Commission: 20%
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-8">
          <div>
            <div className="text-zinc-500 mb-1">Pairs</div>
            <div className="text-zinc-100 text-xl">275</div>
          </div>
          <div>
            <div className="text-zinc-500 mb-1">Supported networks</div>
            <div className="flex items-center gap-2">
              {NETWORK_ICONS.map((icon, i) => (
                <div 
                  key={i} 
                  className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-100 text-xs"
                >
                  {icon}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button className="px-4 py-2 bg-zinc-800/50 text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors flex items-center gap-2">
            Protocols
            <ChevronDown className="w-4 h-4" />
          </button>
          
          <button className="px-4 py-2 bg-zinc-800/50 text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors flex items-center gap-2">
            Networks
            <ChevronDown className="w-4 h-4" />
          </button>

          <button className="px-4 py-2 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-zinc-100 rounded-lg transition-all">
            Dashboard
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
        <div className="grid gap-4 px-6 py-3 text-zinc-500 border-b border-zinc-800 min-w-[900px]" style={{ gridTemplateColumns: '1.5fr 1.5fr 1.5fr 80px 1fr 1fr 100px' }}>
          <div>Token pair</div>
          <div className="flex items-center gap-1">
            Left to borrow
            <Info className="w-3 h-3" />
          </div>
          <div className="flex items-center gap-1">
            Borrowed
            <Info className="w-3 h-3" />
          </div>
          <div className="flex items-center gap-1">
            Protocols
            <Info className="w-3 h-3" />
          </div>
          <div className="flex items-center gap-1">
            APR
            <Info className="w-3 h-3" />
          </div>
          <div className="flex items-center gap-1">
            Fees 1D
            <Info className="w-3 h-3" />
          </div>
          <div></div>
        </div>

        {/* Table Rows */}
        <div className="space-y-2 min-w-[900px]">
          {LEVERAGE_POOLS.map((pool, index) => (
            <motion.div
              key={pool.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="grid gap-4 px-6 py-4 bg-zinc-900/30 hover:bg-zinc-900/50 transition-colors items-center"
              style={{ gridTemplateColumns: '1.5fr 1.5fr 1.5fr 80px 1fr 1fr 100px' }}
            >
              {/* Token Pair */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex items-center -space-x-2 flex-shrink-0">
                  <div className="w-6 h-6 rounded-full bg-zinc-700 border-2 border-zinc-950" />
                  <div className="w-6 h-6 rounded-full bg-zinc-600 border-2 border-zinc-950" />
                </div>
                <div className="text-zinc-100 truncate">{pool.name}</div>
              </div>

              {/* Left to Borrow */}
              <div className="space-y-1 min-w-0">
                {pool.leftToBorrow.map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      item.color === 'orange' ? 'bg-orange-400' :
                      item.color === 'blue' ? 'bg-blue-400' :
                      item.color === 'gray' ? 'bg-zinc-500' :
                      'bg-zinc-100'
                    }`} />
                    <span className={`truncate ${getColorClass(item.color)}`}>{item.amount}</span>
                  </div>
                ))}
              </div>

              {/* Borrowed */}
              <div className="space-y-1 min-w-0">
                {pool.borrowed.map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      item.color === 'orange' ? 'bg-orange-400' :
                      item.color === 'blue' ? 'bg-blue-400' :
                      item.color === 'gray' ? 'bg-zinc-500' :
                      'bg-zinc-100'
                    }`} />
                    <span className={`truncate ${getColorClass(item.color)}`}>{item.amount}</span>
                  </div>
                ))}
              </div>

              {/* Protocols */}
              <div>
                <button className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors">
                  <div className="w-5 h-5 rounded-full bg-zinc-600" />
                </button>
              </div>

              {/* APR */}
              <div className="space-y-1">
                {pool.apr.map((apr, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-100 flex-shrink-0" />
                    <span className="text-zinc-100">{apr}</span>
                  </div>
                ))}
              </div>

              {/* Fees 1D */}
              <div className="space-y-1">
                {pool.fees1d.map((fee, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-100 flex-shrink-0" />
                    <span className="text-zinc-100">{fee}</span>
                  </div>
                ))}
              </div>

              {/* Join Button */}
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

