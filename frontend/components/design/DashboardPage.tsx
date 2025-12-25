"use client";

import { useState } from 'react';
import { TrendingUp, ArrowUpRight, ArrowDownRight, Info, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAllZeroILVaults } from '@/lib/contracts/magicpool/useZeroILVault';
import { useMIMStaking } from '@/lib/contracts/0IL/use0IL';
import { useLiquidity, tickToPrice } from '@/lib/contracts/hooks/useLiquidity';
import { useRouter } from 'next/navigation';
import { formatUnits } from 'viem';

const LEVERAGED_POSITIONS = [
  {
    id: 1,
    pair: 'ETH-USDC',
    leverage: '3x',
    type: 'Long',
    size: '$15,420',
    pnl: '+$1,234',
    pnlPercent: '+8.7%',
    isPositive: true,
    health: 85,
  },
  {
    id: 2,
    pair: 'WBTC-USDC',
    leverage: '5x',
    type: 'Short',
    size: '$8,200',
    pnl: '-$420',
    pnlPercent: '-5.1%',
    isPositive: false,
    health: 72,
  },
];

const GMI_POSITIONS = [
  { id: 1, token: 'WAGMI', amount: '1,234.56', value: '$12,345.60', apy: '124.5%' },
  { id: 2, token: 'WS', amount: '567.89', value: '$5,678.90', apy: '98.2%' },
];

const STRATEGY_POSITIONS = [
  { id: 1, name: 'WAGMI/Anon', deposited: '$5,420', earned: '$234', apr: '28.5%' },
  { id: 2, name: 'WS/WETH', deposited: '$3,200', earned: '$156', apr: '45.2%' },
];

// V3_POSITIONS will be fetched dynamically

const LEVERAGE_LIQUIDITY_POSITIONS = [
  { id: 1, name: 'WS/Anon', supplied: '$4,500', earned: '$187', apr: '87.6%' },
  { id: 2, name: 'WS/USDC.e', supplied: '$2,800', earned: '$95', apr: '87.6%' },
];

type PortfolioTab = 'GMI' | 'Strategies' | 'V3 Pools' | 'Zero IL Vaults' | 'Leverage Liquidity';

export function DashboardPage() {
  const [activePortfolioTab, setActivePortfolioTab] = useState<PortfolioTab>('GMI');
  const router = useRouter();
  
  // Real Zero IL vault data
  const { wethVault, wbtcVault } = useAllZeroILVaults();
  const { userSMIMBalance: sMIMBalance, totalAssets: sMIMTotalAssets } = useMIMStaking();
  
  // Real V3 positions
  const { positions: v3Positions, isLoading: v3Loading } = useLiquidity();
  
  // Token prices for USD value calculation
  const getTokenPrice = (symbol: string): number => {
    const prices: Record<string, number> = {
      'sWETH': wethVault.assetPrice || 3000,
      'sWBTC': 95000,
      'MIM': 1,
      'sUSDC': 1,
      'sUSDT': 1,
    };
    return prices[symbol] || 1;
  };
  
  // Calculate position USD value
  const calculatePositionValue = (position: any): number => {
    try {
      const token0Price = getTokenPrice(position.token0Symbol);
      const token1Price = getTokenPrice(position.token1Symbol);
      const token0Decimals = position.token0Decimals || 18;
      const token1Decimals = position.token1Decimals || 18;
      
      // Estimate token amounts from liquidity
      const liquidity = Number(position.liquidity);
      const sqrtLiquidity = Math.sqrt(liquidity);
      
      // Rough estimate: half in each token
      const amount0Est = sqrtLiquidity / (10 ** (token0Decimals / 2));
      const amount1Est = sqrtLiquidity / (10 ** (token1Decimals / 2));
      
      return (amount0Est * token0Price + amount1Est * token1Price) / 1000;
    } catch {
      return 0;
    }
  };

  const tradingBalance = LEVERAGED_POSITIONS.reduce((sum, pos) => {
    const size = parseFloat(pos.size.replace(/[$,]/g, ''));
    return sum + size;
  }, 0);

  const calculatePortfolioBalance = () => {
    let total = 0;
    
    // GMI positions
    GMI_POSITIONS.forEach(pos => {
      total += parseFloat(pos.value.replace(/[$,]/g, ''));
    });
    
    // Strategy positions
    STRATEGY_POSITIONS.forEach(pos => {
      total += parseFloat(pos.deposited.replace(/[$,]/g, ''));
    });
    
    // V3 positions - real data
    v3Positions.forEach(pos => {
      total += calculatePositionValue(pos);
    });
    
    // Zero IL Vaults - real data
    const wethValue = parseFloat(wethVault.wTokenBalance || '0') * wethVault.assetPrice;
    const sMIMValue = parseFloat(sMIMBalance || '0'); // sMIM = $1
    total += wethValue + sMIMValue;
    
    // Leverage liquidity positions
    LEVERAGE_LIQUIDITY_POSITIONS.forEach(pos => {
      total += parseFloat(pos.supplied.replace(/[$,]/g, ''));
    });
    
    return total;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Trading Section - 25% */}
      <motion.div 
        className="h-[25vh] min-h-[300px]"
        initial={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-2">
            <h2 className="text-zinc-100 text-2xl">Trading</h2>
            <span className="text-zinc-400 text-xl">
              ${tradingBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Current Leveraged Positions */}
        <div className="space-y-3">
          {LEVERAGED_POSITIONS.map((position, index) => (
            <motion.div
              key={position.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="p-4 bg-zinc-900/30 rounded-lg hover:bg-zinc-900/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-zinc-700 border-2 border-zinc-950" />
                    <div className="w-8 h-8 rounded-full bg-zinc-600 border-2 border-zinc-950" />
                  </div>
                  <div>
                    <div className="text-zinc-100 flex items-center gap-2">
                      {position.pair}
                      <span className="text-xs px-2 py-0.5 bg-zinc-800/50 text-zinc-400 rounded">
                        {position.leverage}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          position.type === 'Long'
                            ? 'text-green-400 bg-green-400/10'
                            : 'text-red-400 bg-red-400/10'
                        }`}
                      >
                        {position.type}
                      </span>
                    </div>
                    <div className="text-zinc-500 text-sm">Size: {position.size}</div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-zinc-500 text-sm mb-1">P&L</div>
                    <div className={`flex items-center gap-1 ${position.isPositive ? 'text-green-400' : 'text-red-400'}`}>
                      {position.isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      <span>{position.pnl}</span>
                      <span className="text-sm">({position.pnlPercent})</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500 text-sm">Health:</span>
                    <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          position.health > 80
                            ? 'bg-green-400'
                            : position.health > 50
                            ? 'bg-yellow-400'
                            : 'bg-red-400'
                        }`}
                        style={{ width: `${position.health}%` }}
                      />
                    </div>
                    <span className="text-zinc-400 text-sm">{position.health}%</span>
                  </div>

                  <button className="px-4 py-2 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 rounded-lg transition-colors text-sm">
                    Manage
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Portfolio Section - 75% */}
      <div className="min-h-[60vh]">
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-2">
            <h2 className="text-zinc-100 text-2xl">Portfolio</h2>
            <span className="text-zinc-400 text-xl">
              ${calculatePortfolioBalance().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Portfolio Tabs */}
        <div className="flex items-center gap-6 mb-6 border-b border-zinc-800">
          {(['GMI', 'Strategies', 'V3 Pools', 'Zero IL Vaults', 'Leverage Liquidity'] as PortfolioTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActivePortfolioTab(tab)}
              className={`pb-3 transition-colors relative ${
                activePortfolioTab === tab
                  ? 'text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab}
              {activePortfolioTab === tab && (
                <motion.div
                  layoutId="portfolioTabIndicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-100"
                />
              )}
            </button>
          ))}
        </div>

        {/* Portfolio Tabs Content */}
        {activePortfolioTab === 'GMI' && (
          <div className="space-y-8 mt-8">
            {/* Priority 0: Claimable Fees - Most Prominent */}
            <div className="p-8 bg-zinc-900/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-zinc-500 mb-2">Claimable Fees</div>
                  <div className="text-zinc-100 text-4xl mb-3">$1,101.97</div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Info className="w-3 h-3 text-zinc-500" />
                      <span className="text-zinc-400">Boosted fees pending:</span>
                      <span className="text-zinc-100">$662.06</span>
                    </div>
                    <div className="text-zinc-500">
                      Your share: <span className="text-red-400">-$12.12</span>
                    </div>
                  </div>
                </div>
                <button className="px-8 py-3 bg-zinc-100 hover:bg-white text-zinc-950 rounded-lg transition-all">
                  Collect Fees
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column */}
              <div className="space-y-6">
                {/* Priority 1: Balance of GMI */}
                <div>
                  <div className="text-zinc-500 text-sm mb-2">Balance of GMI</div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-zinc-100 text-3xl">64,680.33</span>
                    <span className="px-3 py-1 bg-zinc-800 text-zinc-100 rounded-lg text-sm">
                      APR 4.59%
                    </span>
                  </div>
                  <div className="text-zinc-500 text-sm">Your GMI share: 1.1361%</div>
                </div>

                {/* Priority 2: WAGMI Reserved */}
                <div className="pt-4 border-t border-zinc-800">
                  <div className="text-zinc-500 text-sm mb-3">WAGMI reserved</div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-700" />
                    <div>
                      <div className="text-zinc-100">3,631,241.58</div>
                      <div className="text-zinc-500 text-sm">$0.13-24</div>
                    </div>
                  </div>
                </div>

                {/* Priority 3: NGMI Button */}
                <div className="pt-2">
                  <button className="w-full py-3 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-zinc-100 rounded-lg transition-all">
                    NGMI
                  </button>
                </div>

                {/* Priority 4: GMI Stats */}
                <div className="space-y-3 pt-4 border-t border-zinc-800">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-zinc-500">
                      <span>Total GMI</span>
                      <Info className="w-3 h-3" />
                    </div>
                    <span className="text-zinc-100">$1,103,812.8</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-zinc-500">
                      <span>Users owned GMI</span>
                      <Info className="w-3 h-3" />
                    </div>
                    <span className="text-zinc-100">$999,875.28</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-zinc-500">
                      <span>Protocol&apos;s owned GMI</span>
                      <Info className="w-3 h-3" />
                    </div>
                    <span className="text-zinc-100">$103,937.51</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-zinc-500">
                      <span>GMI Total Supply</span>
                      <Info className="w-3 h-3" />
                    </div>
                    <span className="text-zinc-100">5,693,410</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-zinc-500">
                      <span>Total Burned GMI</span>
                      <Info className="w-3 h-3" />
                    </div>
                    <span className="text-zinc-100">1,185,666.63</span>
                  </div>
                </div>
              </div>

              {/* Right Column - Priority 5: Strategies Supported by GMI (Compact) */}
              <div>
                <h3 className="text-zinc-100 mb-4">Strategies supported by GMI</h3>
                
                <div className="space-y-3">
                  {[
                    {
                      name: 'WS/USDC.e',
                      totalValueLocked: '$98,658.2',
                      maxCap: '$426,657.79',
                      feesGenerated: '$1,580,765.49',
                      percentageFilled: 23.12,
                      gmiShare: '69.81%',
                    },
                    {
                      name: 'WS/WETH',
                      totalValueLocked: '$128,986.68',
                      maxCap: '$266,011.09',
                      feesGenerated: '$408,991.81',
                      percentageFilled: 48.49,
                      gmiShare: '86.48%',
                    },
                    {
                      name: 'WS/WAGMI',
                      totalValueLocked: '$104,337.85',
                      maxCap: '$120,212.78',
                      feesGenerated: '$146,780.46',
                      percentageFilled: 88.40,
                      gmiShare: '89.57%',
                    },
                    {
                      name: 'WAGMI/Anon',
                      totalValueLocked: '$791,412.04',
                      maxCap: '$804,117.58',
                      feesGenerated: '$181,658.18',
                      percentageFilled: 98.42,
                      gmiShare: '90.52%',
                    },
                  ].map((strategy, index) => (
                    <div
                      key={index}
                      className="p-3 bg-zinc-900/20 rounded-lg hover:bg-zinc-900/30 transition-colors"
                    >
                      {/* Compact Strategy Header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center -space-x-1">
                            <div className="w-5 h-5 rounded-full bg-zinc-700 border border-zinc-950" />
                            <div className="w-5 h-5 rounded-full bg-zinc-600 border border-zinc-950" />
                          </div>
                          <span className="text-zinc-100 text-sm">{strategy.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-zinc-500" />
                          <span className="text-zinc-400 text-xs">{strategy.gmiShare}</span>
                        </div>
                      </div>

                      {/* Compact Stats Grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mb-2">
                        <div>
                          <span className="text-zinc-500">TVL: </span>
                          <span className="text-zinc-100">{strategy.totalValueLocked}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500">Max: </span>
                          <span className="text-zinc-100">{strategy.maxCap}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-zinc-500">Fees: </span>
                          <span className="text-zinc-100">{strategy.feesGenerated}</span>
                        </div>
                      </div>

                      {/* Compact Progress Bar */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-zinc-400"
                            style={{ width: `${strategy.percentageFilled}%` }}
                          />
                        </div>
                        <span className="text-zinc-400 text-xs">{strategy.percentageFilled}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activePortfolioTab === 'Strategies' && (
          <div className="space-y-3">
            {STRATEGY_POSITIONS.map((position, index) => (
              <motion.div
                key={position.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="p-6 bg-zinc-900/30 rounded-lg hover:bg-zinc-900/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center -space-x-2">
                      <div className="w-10 h-10 rounded-full bg-zinc-700 border-2 border-zinc-950" />
                      <div className="w-10 h-10 rounded-full bg-zinc-600 border-2 border-zinc-950" />
                    </div>
                    <div className="text-zinc-100">{position.name}</div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <div className="text-zinc-500 text-sm mb-1">Deposited</div>
                      <div className="text-zinc-100">{position.deposited}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-zinc-500 text-sm mb-1">Earned</div>
                      <div className="text-green-400">{position.earned}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-zinc-500 text-sm mb-1">APR</div>
                      <div className="text-zinc-100">{position.apr}</div>
                    </div>
                    <button className="px-6 py-2 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-zinc-100 rounded-lg transition-all">
                      Manage
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {activePortfolioTab === 'V3 Pools' && (
          <div className="space-y-3">
            {v3Loading ? (
              <div className="p-12 bg-zinc-900/20 rounded-lg text-center">
                <div className="animate-pulse text-zinc-500">Loading positions...</div>
              </div>
            ) : v3Positions.length === 0 ? (
              <div className="p-12 bg-zinc-900/20 rounded-lg text-center">
                <div className="w-12 h-12 rounded-full bg-zinc-800 mx-auto mb-4 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-zinc-600" />
                </div>
                <div className="text-zinc-400 mb-4">No V3 liquidity positions yet</div>
                <button 
                  onClick={() => router.push('/liquidity')}
                  className="px-6 py-3 bg-zinc-100 hover:bg-white text-zinc-950 rounded-lg transition-all"
                >
                  Add Liquidity
                </button>
              </div>
            ) : (
              v3Positions.map((position, index) => {
                const posValue = calculatePositionValue(position);
                const feeValue0 = Number(formatUnits(position.tokensOwed0, position.token0Decimals || 18));
                const feeValue1 = Number(formatUnits(position.tokensOwed1, position.token1Decimals || 18));
                const feesUSD = feeValue0 * getTokenPrice(position.token0Symbol || '') + 
                               feeValue1 * getTokenPrice(position.token1Symbol || '');
                
                return (
                  <motion.div
                    key={position.tokenId.toString()}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="p-6 bg-zinc-900/30 rounded-lg hover:bg-zinc-900/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center -space-x-2">
                          <div className="w-10 h-10 rounded-full bg-zinc-700 border-2 border-zinc-950 flex items-center justify-center text-xs text-zinc-300">
                            {position.token0Symbol?.slice(0, 2)}
                          </div>
                          <div className="w-10 h-10 rounded-full bg-zinc-600 border-2 border-zinc-950 flex items-center justify-center text-xs text-zinc-300">
                            {position.token1Symbol?.slice(0, 2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-zinc-100 flex items-center gap-2">
                            {position.token0Symbol}/{position.token1Symbol}
                            <span className="text-xs px-2 py-0.5 bg-zinc-800/50 text-zinc-400 rounded">
                              {position.fee / 10000}%
                            </span>
                          </div>
                          <div className="text-zinc-500 text-xs">
                            ID: {position.tokenId.toString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-8">
                        <div className="text-right">
                          <div className="text-zinc-500 text-sm mb-1">Value</div>
                          <div className="text-zinc-100">
                            ${posValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-zinc-500 text-sm mb-1">Fees Earned</div>
                          <div className="text-green-400">
                            ${feesUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-zinc-500 text-sm mb-1">Range</div>
                          <div className="text-zinc-100 text-sm">
                            {tickToPrice(position.tickLower).toFixed(4)} - {tickToPrice(position.tickUpper).toFixed(4)}
                          </div>
                        </div>
                        <button 
                          onClick={() => router.push('/liquidity')}
                          className="px-6 py-2 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-zinc-100 rounded-lg transition-all"
                        >
                          Manage
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        )}

        {activePortfolioTab === 'Zero IL Vaults' && (
          <div className="space-y-6">
            {/* Zero IL Vaults Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-zinc-900/30 rounded-lg">
                <div className="text-zinc-500 text-sm mb-1">Total Deposited</div>
                <div className="text-zinc-100 text-xl">
                  ${((parseFloat(wethVault.wTokenBalance || '0') * wethVault.assetPrice) + parseFloat(sMIMBalance || '0')).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="p-4 bg-zinc-900/30 rounded-lg">
                <div className="text-zinc-500 text-sm mb-1">sWETH Price</div>
                <div className="text-zinc-100 text-xl">${wethVault.assetPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              <div className="p-4 bg-zinc-900/30 rounded-lg">
                <div className="text-zinc-500 text-sm mb-1">sMIM TVL</div>
                <div className="text-zinc-100 text-xl">${parseFloat(sMIMTotalAssets || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
            </div>

            {/* wETH Vault Position */}
            {parseFloat(wethVault.wTokenBalance || '0') > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="p-6 bg-zinc-900/30 rounded-lg hover:bg-zinc-900/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-zinc-100 flex items-center gap-2">
                        wETH (Zero IL)
                        <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">2x Leverage</span>
                      </div>
                      <div className="text-zinc-500 text-sm">Zero Impermanent Loss ETH exposure</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <div className="text-zinc-500 text-sm mb-1">Balance</div>
                      <div className="text-zinc-100">{parseFloat(wethVault.wTokenBalance || '0').toFixed(6)} wETH</div>
                    </div>
                    <div className="text-right">
                      <div className="text-zinc-500 text-sm mb-1">Value</div>
                      <div className="text-zinc-100">${(parseFloat(wethVault.wTokenBalance || '0') * wethVault.assetPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-zinc-500 text-sm mb-1">APR</div>
                      <div className="text-green-400">{wethVault.apr}%</div>
                    </div>
                    <button 
                      onClick={() => router.push('/magicpool')}
                      className="px-6 py-2 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-zinc-100 rounded-lg transition-all"
                    >
                      Manage
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* sMIM Position */}
            {parseFloat(sMIMBalance || '0') > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.05 }}
                className="p-6 bg-zinc-900/30 rounded-lg hover:bg-zinc-900/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">M</span>
                    </div>
                    <div>
                      <div className="text-zinc-100 flex items-center gap-2">
                        sMIM (Staked MIM)
                        <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded">Yield Bearing</span>
                      </div>
                      <div className="text-zinc-500 text-sm">Earn from 0IL vault borrow interest</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <div className="text-zinc-500 text-sm mb-1">Balance</div>
                      <div className="text-zinc-100">{parseFloat(sMIMBalance || '0').toFixed(4)} sMIM</div>
                    </div>
                    <div className="text-right">
                      <div className="text-zinc-500 text-sm mb-1">Value</div>
                      <div className="text-zinc-100">${parseFloat(sMIMBalance || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-zinc-500 text-sm mb-1">APR</div>
                      <div className="text-green-400">~5%</div>
                    </div>
                    <button 
                      onClick={() => router.push('/magicpool')}
                      className="px-6 py-2 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-zinc-100 rounded-lg transition-all"
                    >
                      Manage
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Empty state */}
            {parseFloat(wethVault.wTokenBalance || '0') === 0 && parseFloat(sMIMBalance || '0') === 0 && (
              <div className="p-12 bg-zinc-900/20 rounded-lg text-center">
                <Shield className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <div className="text-zinc-400 mb-4">No Zero IL vault positions yet</div>
                <button 
                  onClick={() => router.push('/magicpool')}
                  className="px-6 py-3 bg-zinc-100 hover:bg-white text-zinc-950 rounded-lg transition-all"
                >
                  Explore Zero IL Vaults
                </button>
              </div>
            )}
          </div>
        )}

        {activePortfolioTab === 'Leverage Liquidity' && (
          <div className="space-y-3">
            {LEVERAGE_LIQUIDITY_POSITIONS.map((position, index) => (
              <motion.div
                key={position.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="p-6 bg-zinc-900/30 rounded-lg hover:bg-zinc-900/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center -space-x-2">
                      <div className="w-10 h-10 rounded-full bg-zinc-700 border-2 border-zinc-950" />
                      <div className="w-10 h-10 rounded-full bg-zinc-600 border-2 border-zinc-950" />
                    </div>
                    <div className="text-zinc-100">{position.name}</div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <div className="text-zinc-500 text-sm mb-1">Supplied</div>
                      <div className="text-zinc-100">{position.supplied}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-zinc-500 text-sm mb-1">Earned</div>
                      <div className="text-green-400">{position.earned}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-zinc-500 text-sm mb-1">APR</div>
                      <div className="text-zinc-100">{position.apr}</div>
                    </div>
                    <button className="px-6 py-2 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-zinc-100 rounded-lg transition-all">
                      Manage
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

