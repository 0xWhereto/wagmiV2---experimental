"use client";

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Header, SwapCard, PriceChart } from '@/components/design';

export default function SwapPage() {
  const [chartTokens, setChartTokens] = useState({ from: 'WETH', to: 'USDC' });
  
  const handleTokensChange = useCallback((from: string, to: string) => {
    setChartTokens({ from, to });
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col relative overflow-hidden">
      <Header />
      
      <main className="flex-1 px-6 py-12 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-1 items-start">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <SwapCard onTokensChange={handleTokensChange} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <PriceChart 
                token0Symbol={chartTokens.from}
                token1Symbol={chartTokens.to}
                chainId={146}
              />
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}


