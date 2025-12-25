"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { StrategiesTab } from './liquidity/StrategiesTab';
import { LeverageTab } from './liquidity/LeverageTab';
import { V3PoolsTab } from './liquidity/V3PoolsTab';
import { VaultsTab } from './liquidity/VaultsTab';

type Tab = 'Vaults' | 'Strategies' | 'Leverage' | 'V3 Pools';

export function LiquidityPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Vaults');

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Title */}
      <motion.h1 
        className="text-zinc-100 text-2xl mb-8"
        initial={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        Liquidity
      </motion.h1>

      {/* Tabs */}
      <motion.div 
        className="flex items-center gap-6 mb-8 border-b border-zinc-800"
        initial={{ opacity: 0, y: -10, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <button
          onClick={() => setActiveTab('Vaults')}
          className={`pb-4 transition-colors relative ${
            activeTab === 'Vaults'
              ? 'text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Vaults
          {activeTab === 'Vaults' && (
            <motion.div
              layoutId="liquidityActiveTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-100"
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab('Strategies')}
          className={`pb-4 transition-colors relative ${
            activeTab === 'Strategies'
              ? 'text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Strategies
          {activeTab === 'Strategies' && (
            <motion.div
              layoutId="liquidityActiveTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-100"
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab('Leverage')}
          className={`pb-4 transition-colors relative ${
            activeTab === 'Leverage'
              ? 'text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Leverage
          {activeTab === 'Leverage' && (
            <motion.div
              layoutId="liquidityActiveTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-100"
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab('V3 Pools')}
          className={`pb-4 transition-colors relative ${
            activeTab === 'V3 Pools'
              ? 'text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          V3 Pools
          {activeTab === 'V3 Pools' && (
            <motion.div
              layoutId="liquidityActiveTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-100"
            />
          )}
        </button>
      </motion.div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {activeTab === 'Vaults' && <VaultsTab />}
        {activeTab === 'Strategies' && <StrategiesTab />}
        {activeTab === 'Leverage' && <LeverageTab />}
        {activeTab === 'V3 Pools' && <V3PoolsTab />}
      </motion.div>
    </div>
  );
}

