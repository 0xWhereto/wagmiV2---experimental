"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useAccount } from "wagmi";
import { getTokenLogoBySymbol } from "@/lib/tokens/logos";
import { type Token } from "@/lib/tokens/tokenList";
import { useAllTokenBalances, type TokenBalance } from "@/hooks/useTokenBalances";

interface TokenSelectorProps {
  token: string;
  onChange: (token: string) => void;
  availableTokens: Token[];
  usedTokens?: string[];
  chainId: number;
  showBalance?: boolean;
}

export function TokenSelector({
  token,
  onChange,
  availableTokens,
  usedTokens = [],
  chainId,
  showBalance = true,
}: TokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { isConnected } = useAccount();
  const { balances, isLoading } = useAllTokenBalances(chainId);
  
  const tokenLogo = getTokenLogoBySymbol(token);
  const currentBalance = balances[token];

  // Sort tokens: tokens with balance first, then alphabetically
  const sortedTokens = [...availableTokens]
    .filter(t => !usedTokens.includes(t.symbol) || t.symbol === token)
    .sort((a, b) => {
      const balA = parseFloat(balances[a.symbol]?.balanceFormatted || "0");
      const balB = parseFloat(balances[b.symbol]?.balanceFormatted || "0");
      if (balA > 0 && balB === 0) return -1;
      if (balB > 0 && balA === 0) return 1;
      if (balA !== balB) return balB - balA;
      return a.symbol.localeCompare(b.symbol);
    });

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all hover:scale-[1.02]"
        style={{
          background: "rgb(240, 240, 243)",
          boxShadow: "3px 3px 6px #d1d9e6, -3px -3px 6px #ffffff",
        }}
      >
        <div className="w-7 h-7 rounded-full overflow-hidden">
          <Image src={tokenLogo} alt={token} width={28} height={28} className="w-full h-full object-cover" />
        </div>
        <span className="font-semibold" style={{ color: "#374151" }}>{token}</span>
        <svg 
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          <path d="M3 4.5L6 7.5L9 4.5" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop for click-outside-to-close */}
            <div 
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full mt-2 rounded-xl z-50 min-w-[240px] max-h-[320px] overflow-hidden"
              style={{
                background: "rgb(240, 240, 243)",
                boxShadow: "8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff",
              }}
            >
            {/* Search Header */}
            <div 
              className="px-3 py-2 border-b"
              style={{ borderColor: "rgba(0,0,0,0.05)" }}
            >
              <span className="text-xs font-medium" style={{ color: "#6B7280" }}>
                Select Token
              </span>
            </div>

            {/* Token List */}
            <div className="overflow-y-auto max-h-[260px]">
              {sortedTokens.map((t) => {
                const logo = getTokenLogoBySymbol(t.symbol);
                const balance = balances[t.symbol];
                const hasBalance = balance && parseFloat(balance.balanceFormatted) > 0;
                
                return (
                  <button
                    key={t.symbol}
                    onClick={() => { onChange(t.symbol); setIsOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 transition-all hover:bg-white/50"
                    style={{ borderBottom: "1px solid rgba(0,0,0,0.03)" }}
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                      <Image src={logo} alt={t.symbol} width={32} height={32} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="font-medium text-sm" style={{ color: "#374151" }}>{t.symbol}</div>
                      <div className="text-xs truncate" style={{ color: "#9CA3AF" }}>{t.name}</div>
                    </div>
                    {isConnected && showBalance && (
                      <div className="text-right flex-shrink-0">
                        {isLoading ? (
                          <div className="w-12 h-4 rounded animate-pulse" style={{ background: "#E5E7EB" }} />
                        ) : (
                          <>
                            <div 
                              className="text-sm font-medium"
                              style={{ color: hasBalance ? "#374151" : "#9CA3AF" }}
                            >
                              {balance?.balanceFormatted || "0"}
                            </div>
                            {hasBalance && (
                              <div className="text-xs" style={{ color: "#9CA3AF" }}>
                                ${balance?.balanceUsd}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    {token === t.symbol && (
                      <svg className="flex-shrink-0" width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8L6.5 11.5L13 5" stroke="#667EEA" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// Export a simple balance display component
export function TokenBalanceDisplay({ 
  symbol, 
  chainId,
  className = "",
}: { 
  symbol: string; 
  chainId: number;
  className?: string;
}) {
  const { isConnected } = useAccount();
  const { balances, isLoading } = useAllTokenBalances(chainId);
  const balance = balances[symbol];

  if (!isConnected) {
    return <span className={className} style={{ color: "rgba(107, 114, 128, 0.6)" }}>--</span>;
  }

  if (isLoading) {
    return (
      <span className={className}>
        <span className="inline-block w-12 h-3 rounded animate-pulse" style={{ background: "#E5E7EB" }} />
      </span>
    );
  }

  return (
    <span className={className} style={{ color: "rgba(107, 114, 128, 0.6)" }}>
      {balance?.balanceFormatted || "0"}
    </span>
  );
}


