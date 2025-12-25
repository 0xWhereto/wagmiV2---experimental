"use client";

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { TokenSelector } from './TokenSelector';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { getTokenLogoBySymbol } from '@/lib/tokens/logos';

interface Token {
  symbol: string;
  name: string;
  balance: string;      // Formatted balance for display
  balanceRaw?: string;  // Full precision balance for MAX button
  address?: string;
  decimals?: number;
}

interface TokenInputProps {
  label: string;
  token: Token;
  amount: string;
  onAmountChange: (value: string) => void;
  tokens: Token[];
  onTokenChange: (token: Token) => void;
  readOnly?: boolean;
  usdValue?: string;
}

export function TokenInput({
  label,
  token,
  amount,
  onAmountChange,
  tokens,
  onTokenChange,
  readOnly = false,
  usdValue,
}: TokenInputProps) {
  const [isSelectingToken, setIsSelectingToken] = useState(false);

  const handleMaxClick = () => {
    // Use balanceRaw (full precision) if available, fallback to balance
    const maxAmount = token.balanceRaw || token.balance.replace(/,/g, '');
    onAmountChange(maxAmount);
  };

  return (
    <>
      <div className="py-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-zinc-500">{label}</span>
          <span className="text-zinc-500">Balance: {token.balance}</span>
        </div>

        <div className="flex items-center gap-3 pb-3 border-b border-zinc-700">
          <button
            type="button"
            onClick={() => setIsSelectingToken(true)}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors group"
          >
            <div className="w-6 h-6 rounded-full overflow-hidden bg-gradient-to-br from-zinc-400 to-zinc-500">
              <Image 
                src={getTokenLogoBySymbol(token.symbol)} 
                alt={token.symbol} 
                width={24} 
                height={24} 
                className="w-full h-full object-cover token-icon"
              />
            </div>
            <span className="text-zinc-100">{token.symbol}</span>
            <ChevronDown className="w-4 h-4 text-zinc-400 group-hover:text-zinc-300" />
          </button>

          <div className="flex-1 flex items-center gap-2">
            <input
              type="text"
              value={amount}
              onChange={(e) => {
                const value = e.target.value;
                if (/^\d*\.?\d*$/.test(value)) {
                  onAmountChange(value);
                }
              }}
              placeholder="0.0"
              readOnly={readOnly}
              className="flex-1 bg-transparent text-zinc-100 text-right outline-none placeholder:text-zinc-700"
            />
            {!readOnly && (
              <button
                type="button"
                onClick={handleMaxClick}
                className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 transition-colors"
              >
                MAX
              </button>
            )}
          </div>
        </div>

        {amount && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 text-right text-zinc-600"
          >
            {usdValue || `≈ $${(parseFloat(amount || '0') * 2000).toFixed(2)}`}
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {isSelectingToken && (
          <TokenSelector
            tokens={tokens}
            selectedToken={token}
            onSelect={(selectedToken) => {
              onTokenChange(selectedToken);
              setIsSelectingToken(false);
            }}
            onClose={() => setIsSelectingToken(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

