"use client";

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { getTokenLogoBySymbol } from '@/lib/tokens/logos';

interface Token {
  symbol: string;
  name: string;
  balance: string;
  address?: string;
  decimals?: number;
}

interface TokenSelectorProps {
  tokens: Token[];
  selectedToken: Token;
  onSelect: (token: Token) => void;
  onClose: () => void;
}

export function TokenSelector({ tokens, selectedToken, onSelect, onClose }: TokenSelectorProps) {
  const [search, setSearch] = useState('');
  const [mounted, setMounted] = useState(false);
  const portalRef = useRef<HTMLDivElement | null>(null);

  // Create portal container on mount
  useEffect(() => {
    // Create a div for the portal
    const portalDiv = document.createElement('div');
    portalDiv.id = 'token-selector-portal';
    document.body.appendChild(portalDiv);
    portalRef.current = portalDiv;
    setMounted(true);

    return () => {
      if (portalRef.current && document.body.contains(portalRef.current)) {
        document.body.removeChild(portalRef.current);
      }
    };
  }, []);

  const filteredTokens = tokens.filter(
    (token) =>
      token.symbol.toLowerCase().includes(search.toLowerCase()) ||
      token.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleTokenClick = (token: Token) => {
    onSelect(token);
  };

  // Don't render until mounted (for SSR)
  if (!mounted || !portalRef.current) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center z-[9999] p-4"
      style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
        style={{ backgroundColor: '#18181b' }}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ color: '#fafafa' }}>Select a token</h3>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg transition-colors hover:bg-zinc-700"
            >
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#71717a' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or symbol"
              className="w-full pl-10 pr-4 py-3 outline-none rounded-xl transition-colors"
              style={{ 
                backgroundColor: '#09090b', 
                color: '#fafafa',
                borderBottom: '2px solid #3f3f46'
              }}
              autoFocus
            />
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {filteredTokens.map((token) => (
            <button
              type="button"
              key={token.symbol}
              onClick={() => handleTokenClick(token)}
              className="w-full p-4 flex items-center justify-between transition-colors group cursor-pointer hover:bg-zinc-800/50"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-zinc-400 to-zinc-500">
                  <Image 
                    src={getTokenLogoBySymbol(token.symbol)} 
                    alt={token.symbol} 
                    width={40} 
                    height={40} 
                    className="w-full h-full object-cover token-icon"
                  />
                </div>
                <div className="text-left">
                  <div style={{ color: '#fafafa' }}>
                    {token.symbol}
                  </div>
                  <div style={{ color: '#71717a' }}>{token.name}</div>
                </div>
              </div>
              <div className="text-right" style={{ color: '#d4d4d8' }}>{token.balance}</div>
            </button>
          ))}

          {filteredTokens.length === 0 && (
            <div className="p-8 text-center" style={{ color: '#71717a' }}>No tokens found</div>
          )}
        </div>
      </motion.div>
    </motion.div>,
    portalRef.current
  );
}

