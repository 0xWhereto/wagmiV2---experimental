'use client';

import { TokenLogo } from './TokenLogo';
import { Token } from '@/lib/tokens';

interface TokenListItemProps {
  token: Token;
  balance?: string;
  usdValue?: string;
  onClick?: () => void;
  showChainBadge?: boolean;
}

export function TokenListItem({
  token,
  balance,
  usdValue,
  onClick,
  showChainBadge = false,
}: TokenListItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800/50 transition-colors group"
    >
      <TokenLogo
        symbol={token.symbol}
        chainId={token.chainId}
        size="lg"
        showChainBadge={showChainBadge}
      />
      <div className="flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white group-hover:text-cyan-400 transition-colors">
            {token.symbol}
          </span>
          {token.tags?.includes('synthetic') && (
            <span className="px-1.5 py-0.5 text-[10px] bg-purple-500/20 text-purple-400 rounded">
              Synthetic
            </span>
          )}
        </div>
        <span className="text-sm text-gray-500">{token.name}</span>
      </div>
      {balance && (
        <div className="text-right">
          <p className="font-medium text-white">{balance}</p>
          {usdValue && <p className="text-sm text-gray-500">${usdValue}</p>}
        </div>
      )}
      <svg
        className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

interface TokenGridProps {
  tokens: Token[];
  onSelect?: (token: Token) => void;
  selectedToken?: Token;
}

export function TokenGrid({ tokens, onSelect, selectedToken }: TokenGridProps) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
      {tokens.map((token) => (
        <button
          key={`${token.chainId}-${token.address}`}
          onClick={() => onSelect?.(token)}
          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
            selectedToken?.address === token.address
              ? 'border-cyan-500 bg-cyan-500/10'
              : 'border-gray-800 hover:border-gray-700 hover:bg-gray-800/50'
          }`}
        >
          <TokenLogo symbol={token.symbol} size="lg" />
          <span className="text-xs font-medium text-gray-300">{token.symbol}</span>
        </button>
      ))}
    </div>
  );
}

interface TokenBalanceListProps {
  tokens: Array<Token & { balance?: string; usdValue?: string }>;
  onSelect?: (token: Token) => void;
  showChainBadge?: boolean;
}

export function TokenBalanceList({
  tokens,
  onSelect,
  showChainBadge = false,
}: TokenBalanceListProps) {
  return (
    <div className="space-y-1">
      {tokens.map((token) => (
        <TokenListItem
          key={`${token.chainId}-${token.address}`}
          token={token}
          balance={token.balance}
          usdValue={token.usdValue}
          onClick={() => onSelect?.(token)}
          showChainBadge={showChainBadge}
        />
      ))}
    </div>
  );
}

interface CompactTokenDisplayProps {
  symbol: string;
  amount?: string;
  chainId?: number;
}

export function CompactTokenDisplay({
  symbol,
  amount,
  chainId,
}: CompactTokenDisplayProps) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-800 rounded-lg">
      <TokenLogo symbol={symbol} chainId={chainId} size="xs" />
      {amount && <span className="text-sm text-white font-medium">{amount}</span>}
      <span className="text-sm text-gray-400">{symbol}</span>
    </div>
  );
}



