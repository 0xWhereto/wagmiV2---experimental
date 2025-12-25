"use client";

import { motion } from 'framer-motion';

interface SwapDetailsProps {
  networkFee?: string;
  networkFeeSubtext?: string;
  priceImpact?: string;
  priceImpactSubtext?: string;
  minimumReceived?: string;
  minimumReceivedSubtext?: string;
  lpFee?: string;
  lpFeeSubtext?: string;
}

export function SwapDetails({ 
  networkFee = '~$2.45',
  networkFeeSubtext = '0.00123 ETH',
  priceImpact = '<0.01%',
  priceImpactSubtext = 'Minimal',
  minimumReceived = '1,995.00 USDC',
  minimumReceivedSubtext = 'After slippage',
  lpFee = '6.00 USDC',
  lpFeeSubtext = '0.3%',
}: SwapDetailsProps) {
  const details = [
    { label: 'Network fee', value: networkFee, subtext: networkFeeSubtext },
    { label: 'Price impact', value: priceImpact, subtext: priceImpactSubtext },
    { label: 'Minimum received', value: minimumReceived, subtext: minimumReceivedSubtext },
    { label: 'Liquidity provider fee', value: lpFee, subtext: lpFeeSubtext },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 p-3 bg-zinc-800/20 rounded-lg space-y-2"
    >
      {details.map((detail, index) => (
        <div key={index} className="flex items-center justify-between">
          <div>
            <div className="text-zinc-400">{detail.label}</div>
            <div className="text-zinc-600">{detail.subtext}</div>
          </div>
          <div className="text-zinc-300">{detail.value}</div>
        </div>
      ))}
    </motion.div>
  );
}


