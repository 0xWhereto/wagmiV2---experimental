"use client";

import { Info, Sparkles, ExternalLink, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';

const STRATEGIES_SUPPORTED = [
  {
    id: 1,
    name: 'WAGMI/Anon',
    tvl: '$798,028,949',
    gmiShare: '90.32%',
    maxCap: '$810,840,818',
    percentageFilled: 98,
    premium: '0%',
    premiumColor: 'text-yellow-500',
  },
  {
    id: 2,
    name: 'wS/WAGMI',
    tvl: '$107,241,062',
    gmiShare: '89.57%',
    maxCap: '$121,255,836',
    percentageFilled: 88,
    premium: '2%',
    premiumColor: 'text-yellow-500',
  },
  {
    id: 3,
    name: 'wS/USDC',
    tvl: '$99,402,576',
    gmiShare: '69.81%',
    maxCap: '$429,965,221',
    percentageFilled: 23,
    premium: '10%',
    premiumColor: 'text-emerald-500',
  },
  {
    id: 4,
    name: 'wS/WETH',
    tvl: '$129,785,329',
    gmiShare: '86.48%',
    maxCap: '$267,654,038',
    percentageFilled: 48,
    premium: '10%',
    premiumColor: 'text-emerald-500',
  },
];

export function GMIPage() {
  const [depositAmount, setDepositAmount] = useState('');

  return (
    <div className="max-w-7xl mx-auto">
      {/* Priority 1 & 2: Get GMI Deposit Form + Viking Power Stats - Side by Side */}
      <motion.div 
        className="mb-16"
        initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Left - Get GMI Deposit Form */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <h1 className="text-zinc-100 text-5xl">Get GMI</h1>
              <Sparkles className="w-7 h-7 text-zinc-100" />
            </div>

            {/* APR Badge - Prominent */}
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-100 rounded-lg mb-10">
              <span className="text-zinc-950">APR</span>
              <span className="text-zinc-950">4.59%</span>
            </div>

            {/* Deposit Section */}
            <div className="space-y-4 max-w-md">
              <div className="text-zinc-100 text-xl">Deposit</div>
              
              {/* Amount Input with Deposit Button - Same Line */}
              <div className="relative pb-4">
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="0"
                    className="bg-transparent text-zinc-100 text-5xl outline-none placeholder:text-zinc-800 flex-1 min-w-0"
                  />
                  <button className="px-6 py-2 bg-zinc-100 hover:bg-white text-zinc-950 rounded-lg transition-all whitespace-nowrap ml-4">
                    Deposit
                  </button>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-px bg-zinc-700" />
              </div>

              {/* User LP Balance - Clickable to insert into deposit input */}
              <button 
                onClick={() => setDepositAmount('1,234.56')} 
                className="flex items-center gap-3 text-zinc-400 hover:text-zinc-100 transition-colors group"
              >
                <div className="flex items-center -space-x-2">
                  <div className="w-6 h-6 rounded-full bg-zinc-600 border-2 border-zinc-950" />
                  <div className="w-6 h-6 rounded-full bg-zinc-500 border-2 border-zinc-950" />
                </div>
                <span className="text-lg">Balance: <span className="text-zinc-100 group-hover:underline">1,234.56</span> LP</span>
              </button>
            </div>

            {/* Buy Link */}
            <button className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors mt-8">
              <div className="w-5 h-5 rounded-full bg-zinc-600" />
              <span>Buy WAGMI/Anon WLP</span>
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>

          {/* Right - Viking Power Stats */}
          <div className="space-y-5">
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2 text-zinc-300 text-lg">
                <span>Viking Power</span>
                <Info className="w-4 h-4" />
              </div>
              <span className="text-zinc-500 text-lg">Fill the input</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2 text-zinc-300 text-lg">
                <span>Expected GMI</span>
                <Info className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-zinc-600" />
                <span className="text-zinc-100 text-lg">0</span>
              </div>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-zinc-300 text-lg">WAGMI Reserved</span>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-zinc-600" />
                <span className="text-zinc-100 text-lg">0</span>
              </div>
            </div>
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2 text-zinc-300 text-lg">
                <span>Premium locked</span>
                <Info className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-zinc-600" />
                <span className="text-zinc-100 text-lg">0</span>
              </div>
            </div>
            <div className="flex items-center justify-between py-3 pt-6 border-t border-zinc-800">
              <span className="text-zinc-100 text-lg">Total WAGMI</span>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-zinc-600" />
                <span className="text-zinc-100 text-lg">0</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Priority 3: GMI Info & Stats with Circle */}
      <motion.div 
        className="mb-16"
        initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left - GMI Available On */}
          <div className="space-y-8">
            <div>
              <h2 className="text-zinc-100 text-2xl mb-3">GMI info</h2>
              <button className="text-zinc-400 hover:text-zinc-300 transition-colors text-sm underline">
                Learn more about GMI
              </button>
            </div>

            <div>
              <div className="text-zinc-300 mb-2">Fees paid in</div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-blue-500" />
                <div className="w-5 h-5 rounded-full bg-purple-500" />
                <div className="w-5 h-5 rounded-full bg-cyan-500" />
                <div className="w-5 h-5 rounded-full bg-zinc-400" />
              </div>
            </div>

            <div>
              <h3 className="text-zinc-300 text-lg mb-6">GMI Total fees distributed</h3>
              
              {/* Simple Bar Chart */}
              <div className="space-y-4">
                {/* Total Display */}
                <div className="mb-6">
                  <div className="text-zinc-500 text-sm mb-1">Total</div>
                  <div className="text-zinc-100 text-3xl">$2,398,193.94</div>
                </div>

                {/* Strategy Breakdown */}
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center -space-x-1">
                          <div className="w-4 h-4 rounded-full bg-zinc-600 border border-zinc-950" />
                          <div className="w-4 h-4 rounded-full bg-zinc-500 border border-zinc-950" />
                        </div>
                        <span className="text-zinc-400 text-sm">WAGMI/Anon</span>
                      </div>
                      <span className="text-zinc-300 text-sm">$1,580,763.49</span>
                    </div>
                    <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
                      <div className="h-full bg-zinc-600 rounded-full" style={{ width: '65%' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center -space-x-1">
                          <div className="w-4 h-4 rounded-full bg-zinc-600 border border-zinc-950" />
                          <div className="w-4 h-4 rounded-full bg-zinc-500 border border-zinc-950" />
                        </div>
                        <span className="text-zinc-400 text-sm">wS/WETH</span>
                      </div>
                      <span className="text-zinc-300 text-sm">$408,991.81</span>
                    </div>
                    <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
                      <div className="h-full bg-zinc-600 rounded-full" style={{ width: '17%' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center -space-x-1">
                          <div className="w-4 h-4 rounded-full bg-zinc-600 border border-zinc-950" />
                          <div className="w-4 h-4 rounded-full bg-zinc-500 border border-zinc-950" />
                        </div>
                        <span className="text-zinc-400 text-sm">wS/WAGMI</span>
                      </div>
                      <span className="text-zinc-300 text-sm">$146,780.46</span>
                    </div>
                    <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
                      <div className="h-full bg-zinc-600 rounded-full" style={{ width: '6%' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center -space-x-1">
                          <div className="w-4 h-4 rounded-full bg-zinc-600 border border-zinc-950" />
                          <div className="w-4 h-4 rounded-full bg-zinc-500 border border-zinc-950" />
                        </div>
                        <span className="text-zinc-400 text-sm">wS/USDC</span>
                      </div>
                      <span className="text-zinc-300 text-sm">$261,657.68</span>
                    </div>
                    <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
                      <div className="h-full bg-zinc-600 rounded-full" style={{ width: '11%' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right - Statistics */}
          <div className="space-y-4">
            <h3 className="text-zinc-300 text-lg mb-6">Statistics</h3>
            
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2 text-zinc-400">
                <span>GMI TVL</span>
                <Info className="w-3.5 h-3.5" />
              </div>
              <span className="text-zinc-100 text-lg">$1,103,653.84</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2 text-zinc-400">
                <span>Users' owned GMI</span>
                <Info className="w-3.5 h-3.5" />
              </div>
              <span className="text-zinc-100 text-lg">$999,731.29</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2 text-zinc-400">
                <span>Protocol's owned GMI</span>
                <Info className="w-3.5 h-3.5" />
              </div>
              <span className="text-zinc-100 text-lg">$103,922.55</span>
            </div>
            <div className="flex items-center justify-between py-3 pt-6 border-t border-zinc-800">
              <div className="flex items-center gap-2 text-zinc-400">
                <span>WAGMI left</span>
                <Info className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-zinc-600" />
                <span className="text-zinc-100 text-lg">16.7433</span>
              </div>
            </div>
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2 text-zinc-400">
                <span>GMI Total Supply</span>
                <Info className="w-3.5 h-3.5" />
              </div>
              <span className="text-zinc-100 text-lg">5,695,416</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2 text-zinc-400">
                <span>Total Burned GMI</span>
                <Info className="w-3.5 h-3.5" />
              </div>
              <span className="text-zinc-100 text-lg">1,183,666.63</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Priority 4: Strategies Table */}
      <motion.div
        initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <h2 className="text-zinc-300 text-xl mb-6">Strategies supported by GMI</h2>
        
        <div className="bg-zinc-900/30 rounded-lg overflow-hidden overflow-x-auto">
          <div className="grid gap-4 px-6 py-4 border-b border-zinc-800 text-sm min-w-[900px]" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1.5fr 1fr 100px' }}>
            <div className="flex items-center gap-1 text-zinc-500">
              <span>Token pair</span>
            </div>
            <div className="flex items-center gap-1 text-zinc-500">
              <span>TVL</span>
              <Info className="w-3 h-3" />
            </div>
            <div className="flex items-center gap-1 text-zinc-500">
              <span>GMI share</span>
              <Info className="w-3 h-3" />
            </div>
            <div className="flex items-center gap-1 text-zinc-500">
              <span>Max cap</span>
              <Info className="w-3 h-3" />
            </div>
            <div className="flex items-center gap-1 text-zinc-500">
              <span>Percentage filled</span>
              <Info className="w-3 h-3" />
            </div>
            <div className="flex items-center gap-1 text-zinc-500">
              <span>Premium</span>
              <Info className="w-3 h-3" />
            </div>
            <div className="text-zinc-500"></div>
          </div>

          <div className="min-w-[900px]">
            {STRATEGIES_SUPPORTED.map((strategy, index) => (
              <motion.div
                key={strategy.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.45 + index * 0.05 }}
                className="grid gap-4 px-6 py-5 border-b border-zinc-800/50 last:border-b-0 hover:bg-zinc-800/20 transition-colors"
                style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1.5fr 1fr 100px' }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex items-center -space-x-1.5 flex-shrink-0">
                    <div className="w-6 h-6 rounded-full bg-zinc-600 border-2 border-zinc-950" />
                    <div className="w-6 h-6 rounded-full bg-zinc-500 border-2 border-zinc-950" />
                  </div>
                  <span className="text-zinc-300 truncate">{strategy.name}</span>
                </div>

                <div className="flex items-center text-zinc-300 truncate">
                  {strategy.tvl}
                </div>

                <div className="flex items-center text-zinc-300 truncate">
                  {strategy.gmiShare}
                </div>

                <div className="flex items-center text-zinc-300 truncate">
                  {strategy.maxCap}
                </div>

                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-zinc-500 rounded-full"
                      style={{ width: `${strategy.percentageFilled}%` }}
                    />
                  </div>
                  <span className="text-zinc-300 text-sm flex-shrink-0">{strategy.percentageFilled}%</span>
                </div>

                <div className="flex items-center">
                  <span className={strategy.premiumColor}>{strategy.premium}</span>
                </div>

                <div className="flex items-center justify-end">
                  <button className="px-4 py-1.5 border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-100 rounded-lg transition-all whitespace-nowrap">
                    Join
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

