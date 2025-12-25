'use client';

import { useState } from 'react';
import { getTokenLogo, getDefaultTokenLogo, getChainLogo } from '@/lib/tokens/logos';

interface TokenLogoProps {
  symbol: string;
  chainId?: number;
  address?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showChainBadge?: boolean;
}

const sizeClasses = {
  xs: 'w-4 h-4',
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
  xl: 'w-12 h-12',
};

const badgeSizes = {
  xs: 'w-2 h-2 -bottom-0.5 -right-0.5',
  sm: 'w-3 h-3 -bottom-0.5 -right-0.5',
  md: 'w-4 h-4 -bottom-1 -right-1',
  lg: 'w-5 h-5 -bottom-1 -right-1',
  xl: 'w-6 h-6 -bottom-1.5 -right-1.5',
};

export function TokenLogo({
  symbol,
  chainId,
  address,
  size = 'md',
  className = '',
  showChainBadge = false,
}: TokenLogoProps) {
  const [error, setError] = useState(false);
  
  const logoUrl = error
    ? getDefaultTokenLogo()
    : getTokenLogo(symbol, chainId, address);
  
  return (
    <div className={`relative inline-flex ${className}`}>
      <img
        src={logoUrl}
        alt={`${symbol} logo`}
        className={`${sizeClasses[size]} rounded-full object-cover bg-gray-800`}
        onError={() => setError(true)}
      />
      {showChainBadge && chainId && (
        <img
          src={getChainLogo(chainId)}
          alt="chain"
          className={`absolute ${badgeSizes[size]} rounded-full border border-gray-900 bg-gray-900`}
        />
      )}
    </div>
  );
}

interface ChainLogoProps {
  chainId: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function ChainLogo({ chainId, size = 'md', className = '' }: ChainLogoProps) {
  const [error, setError] = useState(false);
  const logoUrl = error ? getDefaultTokenLogo() : getChainLogo(chainId);
  
  return (
    <img
      src={logoUrl}
      alt={`Chain ${chainId} logo`}
      className={`${sizeClasses[size]} rounded-full object-cover bg-gray-800 ${className}`}
      onError={() => setError(true)}
    />
  );
}

interface TokenPairLogoProps {
  token0Symbol: string;
  token1Symbol: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function TokenPairLogo({
  token0Symbol,
  token1Symbol,
  size = 'md',
  className = '',
}: TokenPairLogoProps) {
  return (
    <div className={`relative inline-flex ${className}`}>
      <TokenLogo symbol={token0Symbol} size={size} />
      <TokenLogo
        symbol={token1Symbol}
        size={size}
        className="-ml-2 ring-2 ring-gray-900 rounded-full"
      />
    </div>
  );
}

interface TokenWithAmountProps {
  symbol: string;
  amount: string;
  usdValue?: string;
  chainId?: number;
  showChainBadge?: boolean;
}

export function TokenWithAmount({
  symbol,
  amount,
  usdValue,
  chainId,
  showChainBadge = false,
}: TokenWithAmountProps) {
  return (
    <div className="flex items-center gap-3">
      <TokenLogo
        symbol={symbol}
        chainId={chainId}
        size="lg"
        showChainBadge={showChainBadge}
      />
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">{amount}</span>
          <span className="text-gray-400">{symbol}</span>
        </div>
        {usdValue && (
          <span className="text-sm text-gray-500">${usdValue}</span>
        )}
      </div>
    </div>
  );
}



