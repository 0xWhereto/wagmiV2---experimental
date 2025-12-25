'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TokenLogo } from './TokenLogo';
import { Token, getTokensForChain, getPopularTokens, searchTokens } from '@/lib/tokens';

interface TokenSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: Token) => void;
  chainId: number;
  selectedToken?: Token;
  excludeTokens?: string[];
}

export function TokenSelector({
  isOpen,
  onClose,
  onSelect,
  chainId,
  selectedToken,
  excludeTokens = [],
}: TokenSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  
  const tokens = useMemo(() => {
    const chainTokens = getTokensForChain(chainId);
    return chainTokens.filter(t => !excludeTokens.includes(t.symbol));
  }, [chainId, excludeTokens]);
  
  const popularTokens = useMemo(() => {
    return getPopularTokens(chainId).filter(t => !excludeTokens.includes(t.symbol));
  }, [chainId, excludeTokens]);
  
  const filteredTokens = useMemo(() => {
    if (!searchQuery) return tokens;
    const lowerQuery = searchQuery.toLowerCase();
    return tokens.filter(
      t =>
        t.symbol.toLowerCase().includes(lowerQuery) ||
        t.name.toLowerCase().includes(lowerQuery) ||
        t.address.toLowerCase().includes(lowerQuery)
    );
  }, [tokens, searchQuery]);
  
  const handleSelect = (token: Token) => {
    onSelect(token);
    onClose();
    setSearchQuery('');
  };
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Select Token</h2>
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Search */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by name or paste address"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>
            
            {/* Popular Tokens */}
            {!searchQuery && popularTokens.length > 0 && (
              <div className="p-4 border-b border-gray-800">
                <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Popular</p>
                <div className="flex flex-wrap gap-2">
                  {popularTokens.map((token) => (
                    <button
                      key={token.address}
                      onClick={() => handleSelect(token)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors ${
                        selectedToken?.address === token.address
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : 'border-gray-700 hover:border-gray-600 hover:bg-gray-800'
                      }`}
                    >
                      <TokenLogo symbol={token.symbol} size="xs" />
                      <span className="text-sm text-white">{token.symbol}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Token List */}
            <div className="max-h-80 overflow-y-auto">
              {filteredTokens.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <p>No tokens found</p>
                </div>
              ) : (
                <div className="p-2">
                  {filteredTokens.map((token) => (
                    <button
                      key={token.address}
                      onClick={() => handleSelect(token)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                        selectedToken?.address === token.address
                          ? 'bg-cyan-500/10'
                          : 'hover:bg-gray-800'
                      }`}
                    >
                      <TokenLogo symbol={token.symbol} size="lg" />
                      <div className="flex-1 text-left">
                        <p className="font-medium text-white">{token.symbol}</p>
                        <p className="text-sm text-gray-500">{token.name}</p>
                      </div>
                      {selectedToken?.address === token.address && (
                        <svg className="w-5 h-5 text-cyan-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}


