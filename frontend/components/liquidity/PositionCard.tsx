"use client";

import { useState } from "react";

interface Position {
  id: string;
  token0: { symbol: string; icon: string };
  token1: { symbol: string; icon: string };
  feeTier: number;
  liquidity: string;
  liquidityUsd: string;
  minPrice: string;
  maxPrice: string;
  currentPrice: string;
  inRange: boolean;
  unclaimedFees: {
    token0: string;
    token1: string;
    usd: string;
  };
  apr: string;
}

interface PositionCardProps {
  position: Position;
  onRemove: () => void;
}

// Token Icons - matching TokenInput.tsx style
function TokenIcon({ symbol, size = 28 }: { symbol: string; size?: number }) {
  const gradients: Record<string, [string, string]> = {
    wagmi: ["#10B981", "#059669"],
    eth: ["#627EEA", "#4A5FC1"],
    dai: ["#F5AC37", "#D4922F"],
    usdc: ["#2775CA", "#1A5FAD"],
  };
  
  const [c1, c2] = gradients[symbol] || ["#5D93B2", "#4A7A96"];
  const id = `token-${symbol}-${size}-${Math.random()}`;

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill={`url(#${id})`}/>
      <circle cx="16" cy="16" r="15.5" stroke="white" strokeOpacity="0.2"/>
      {symbol === "wagmi" && (
        <>
          <path d="M16 16L9.127 9.493V14.386L16 20.887L22.873 14.386V9.493L16 16Z" fill="white"/>
          <path d="M16 13.07L20.165 9.493H11.835L16 13.07Z" fill="white"/>
        </>
      )}
      {symbol === "eth" && (
        <>
          <path opacity="0.7" d="M16 13.278L9.127 16.404L16 20.465L22.871 16.404L16 13.278Z" fill="white"/>
          <path opacity="0.5" d="M9.127 16.404L16 20.465V5L9.127 16.404Z" fill="white"/>
          <path opacity="0.8" d="M16 5V20.465L22.871 16.404L16 5Z" fill="white"/>
          <path opacity="0.5" d="M9.127 17.707L16 27.39V21.768L9.127 17.707Z" fill="white"/>
          <path opacity="0.8" d="M16 21.768V27.39L22.876 17.707L16 21.768Z" fill="white"/>
        </>
      )}
      {symbol === "dai" && (
        <path fillRule="evenodd" clipRule="evenodd" d="M7.636 7H15.223C19.837 7 23.335 9.473 24.637 13.071H27V15.245H25.134C25.171 15.594 25.19 15.944 25.189 16.295V16.348C25.19 16.743 25.166 17.137 25.12 17.528H27V19.703H24.592C23.256 23.251 19.785 25.7 15.223 25.7H7.636V19.703H5V17.528H7.636V15.245H5V13.071H7.636V7ZM9.757 19.703V23.749H15.223C18.595 23.749 21.101 22.129 22.268 19.703H9.757ZM22.918 17.528H9.757V15.245H22.921C22.97 15.611 22.995 15.98 22.995 16.348V16.402C22.996 16.779 22.969 17.155 22.918 17.528ZM15.223 8.948C18.611 8.948 21.124 10.611 22.284 13.071H9.757V8.948H15.223Z" fill="white"/>
      )}
      {symbol === "usdc" && (
        <path d="M16 6C10.477 6 6 10.477 6 16C6 21.523 10.477 26 16 26C21.523 26 26 21.523 26 16C26 10.477 21.523 6 16 6ZM18.5 22.5V23.5H13.5V22.5C11.843 22.043 10.5 20.5 10.5 18.5H12.5C12.5 19.881 13.619 21 15 21H17C18.381 21 19.5 19.881 19.5 18.5C19.5 17.119 18.381 16 17 16H15C12.791 16 11 14.209 11 12C11 10.019 12.519 8.386 14.5 8.069V7H17.5V8.069C19.157 8.457 20.5 10 20.5 12H18.5C18.5 10.619 17.381 9.5 16 9.5H15C13.619 9.5 12.5 10.619 12.5 12C12.5 13.381 13.619 14.5 15 14.5H17C19.209 14.5 21 16.291 21 18.5C21 20.481 19.481 22.114 17.5 22.431V22.5H18.5Z" fill="white"/>
      )}
      <defs>
        <radialGradient id={id} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(16 16) scale(16)">
          <stop stopColor={c1}/>
          <stop offset="1" stopColor={c2}/>
        </radialGradient>
      </defs>
    </svg>
  );
}

// Chevron icon
function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg 
      width="16" 
      height="16" 
      viewBox="0 0 16 16" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
    >
      <path d="M4 6L8 10L12 6" stroke="#7B8187" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function PositionCard({ position, onRemove }: PositionCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div 
      className="rounded-xl overflow-hidden"
      style={{ background: 'rgba(31, 36, 46, 0.6)' }}
    >
      {/* Header - Clickable */}
      <div 
        className="px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          {/* Token Pair */}
          <div className="flex items-center gap-3">
            <div className="flex items-center -space-x-2">
              <TokenIcon symbol={position.token0.icon} size={28} />
              <TokenIcon symbol={position.token1.icon} size={28} />
            </div>
            <div>
              <div className="text-sm font-medium text-white tracking-[0.15px]">
                {position.token0.symbol} / {position.token1.symbol}
              </div>
              <div className="text-xs tracking-[0.4px]" style={{ color: '#7B8187' }}>
                {position.feeTier}% fee
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-xs tracking-[0.4px]" style={{ color: '#7B8187' }}>Liquidity</div>
              <div className="text-sm font-medium text-white tracking-[0.15px]">{position.liquidityUsd}</div>
            </div>
            <div className="text-right">
              <div className="text-xs tracking-[0.4px]" style={{ color: '#7B8187' }}>Fees</div>
              <div className="text-sm font-medium tracking-[0.15px]" style={{ color: '#638E5D' }}>
                {position.unclaimedFees.usd}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs tracking-[0.4px]" style={{ color: '#7B8187' }}>APR</div>
              <div className="text-sm font-medium tracking-[0.15px]" style={{ color: '#638E5D' }}>
                {position.apr}
              </div>
            </div>
            
            {/* Status */}
            <div 
              className="px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5"
              style={{ 
                background: position.inRange ? 'rgba(99, 142, 93, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: position.inRange ? '#638E5D' : '#EF4444',
              }}
            >
              <span 
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: position.inRange ? '#638E5D' : '#EF4444' }}
              />
              {position.inRange ? "In Range" : "Out"}
            </div>

            <ChevronIcon expanded={expanded} />
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div 
          className="px-4 pb-4 border-t"
          style={{ borderColor: 'rgba(109, 119, 135, 0.2)' }}
        >
          {/* Price Range */}
          <div className="pt-4 mb-4">
            <div className="text-xs tracking-[0.4px] mb-3" style={{ color: '#7B8187' }}>Price Range</div>
            <div className="flex items-center gap-3">
              <div 
                className="flex-1 p-3 rounded-xl text-center"
                style={{ background: '#15191F' }}
              >
                <div className="text-xs mb-1" style={{ color: '#7B8187' }}>Min</div>
                <div className="text-sm font-medium text-white">{position.minPrice}</div>
                <div className="text-xs" style={{ color: '#7B8187' }}>
                  {position.token0.symbol}/{position.token1.symbol}
                </div>
              </div>
              
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8H13M13 8L10 5M13 8L10 11" stroke="#7B8187" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              
              <div 
                className="flex-1 p-3 rounded-xl text-center"
                style={{ background: '#15191F' }}
              >
                <div className="text-xs mb-1" style={{ color: '#7B8187' }}>Max</div>
                <div className="text-sm font-medium text-white">{position.maxPrice}</div>
                <div className="text-xs" style={{ color: '#7B8187' }}>
                  {position.token0.symbol}/{position.token1.symbol}
                </div>
              </div>
            </div>

            {/* Current Price */}
            <div className="mt-3 flex items-center justify-between text-xs">
              <span style={{ color: '#7B8187' }}>Current: {position.currentPrice}</span>
              <PriceRangeBar position={position} />
            </div>
          </div>

          {/* Unclaimed Fees */}
          <div 
            className="p-3 rounded-xl mb-4"
            style={{ background: '#15191F' }}
          >
            <div className="flex items-center justify-between">
              <div className="text-xs" style={{ color: '#7B8187' }}>Unclaimed Fees</div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <TokenIcon symbol={position.token0.icon} size={16} />
                  <span className="text-xs text-white">{position.unclaimedFees.token0}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <TokenIcon symbol={position.token1.icon} size={16} />
                  <span className="text-xs text-white">{position.unclaimedFees.token1}</span>
                </div>
                <span className="text-xs font-medium" style={{ color: '#638E5D' }}>
                  {position.unclaimedFees.usd}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button 
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-80 add-token-btn"
            >
              Collect Fees
            </button>
            <button 
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-80 add-token-btn"
            >
              Add Liquidity
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
              style={{ 
                background: 'rgba(239, 68, 68, 0.1)', 
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#EF4444',
              }}
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PriceRangeBar({ position }: { position: Position }) {
  const min = parseFloat(position.minPrice);
  const max = parseFloat(position.maxPrice);
  const current = parseFloat(position.currentPrice);
  
  let percentage = ((current - min) / (max - min)) * 100;
  percentage = Math.max(0, Math.min(100, percentage));

  return (
    <div className="w-32 relative h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
      <div 
        className="absolute inset-y-0 rounded-full"
        style={{ 
          left: '0%',
          right: '0%',
          background: position.inRange 
            ? 'linear-gradient(90deg, rgba(99, 142, 93, 0.3), rgba(99, 142, 93, 0.5))' 
            : 'linear-gradient(90deg, rgba(239, 68, 68, 0.3), rgba(239, 68, 68, 0.5))',
        }}
      />
      <div 
        className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
        style={{ 
          left: `calc(${percentage}% - 4px)`,
          background: position.inRange ? '#638E5D' : '#EF4444',
        }}
      />
    </div>
  );
}
