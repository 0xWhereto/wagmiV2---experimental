"use client";

import { useState } from "react";

interface RemoveLiquidityModalProps {
  position: any;
  onClose: () => void;
}

// Close icon
function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 5L5 15M5 5L15 15" stroke="#7B8187" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

// Token icon
function TokenIcon({ symbol, size = 28 }: { symbol: string; size?: number }) {
  const gradients: Record<string, [string, string]> = {
    wagmi: ["#10B981", "#059669"],
    eth: ["#627EEA", "#4A5FC1"],
    dai: ["#F5AC37", "#D4922F"],
    usdc: ["#2775CA", "#1A5FAD"],
  };
  
  const [c1, c2] = gradients[symbol] || ["#5D93B2", "#4A7A96"];
  const id = `remove-token-${symbol}-${size}`;

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
        </>
      )}
      {symbol === "dai" && (
        <path fillRule="evenodd" clipRule="evenodd" d="M7.636 7H15.223C19.837 7 23.335 9.473 24.637 13.071H27V15.245H25.134C25.171 15.594 25.19 15.944 25.189 16.295V16.348C25.19 16.743 25.166 17.137 25.12 17.528H27V19.703H24.592C23.256 23.251 19.785 25.7 15.223 25.7H7.636V19.703H5V17.528H7.636V15.245H5V13.071H7.636V7Z" fill="white"/>
      )}
      {symbol === "usdc" && (
        <path d="M16 6C10.477 6 6 10.477 6 16C6 21.523 10.477 26 16 26C21.523 26 26 21.523 26 16C26 10.477 21.523 6 16 6Z" fill="white"/>
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

const PERCENTAGE_OPTIONS = [25, 50, 75, 100];

export function RemoveLiquidityModal({ position, onClose }: RemoveLiquidityModalProps) {
  const [percentage, setPercentage] = useState(100);
  const [collectFees, setCollectFees] = useState(true);

  // Calculate amounts based on percentage
  const liquidityValue = parseFloat(position.liquidityUsd.replace(/[$,]/g, ''));
  const removeValue = (liquidityValue * percentage / 100).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-[420px] swap-card">
        {/* Header */}
        <div className="px-5 pt-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-normal text-white">Remove Liquidity</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center -space-x-1">
                <TokenIcon symbol={position.token0.icon} size={20} />
                <TokenIcon symbol={position.token1.icon} size={20} />
              </div>
              <span className="text-xs tracking-[0.4px]" style={{ color: '#7B8187' }}>
                {position.token0.symbol}/{position.token1.symbol} · {position.feeTier}%
              </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="hover:opacity-80 transition-opacity"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 pb-5 pt-4 space-y-4">
          {/* Amount */}
          <div>
            <div className="text-xs tracking-[0.4px] mb-2" style={{ color: '#7B8187' }}>
              Amount to Remove
            </div>
            
            <div 
              className="rounded-xl px-4 py-4"
              style={{ background: 'rgba(31, 36, 46, 0.6)' }}
            >
              <div className="text-center mb-4">
                <div className="text-4xl font-semibold text-white mb-1">
                  {percentage}%
                </div>
                <div className="text-sm" style={{ color: '#7B8187' }}>
                  ≈ ${removeValue}
                </div>
              </div>

              {/* Slider */}
              <input
                type="range"
                min="0"
                max="100"
                value={percentage}
                onChange={(e) => setPercentage(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #5D93B2 0%, #5D93B2 ${percentage}%, rgba(255,255,255,0.1) ${percentage}%, rgba(255,255,255,0.1) 100%)`,
                }}
              />

              {/* Quick percentages */}
              <div className="flex items-center gap-2 mt-4">
                {PERCENTAGE_OPTIONS.map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setPercentage(pct)}
                    className="flex-1 py-2 rounded-xl text-sm font-normal transition-all"
                    style={{
                      background: percentage === pct ? 'rgba(93, 147, 178, 0.15)' : '#15191F',
                      color: percentage === pct ? '#FCFCFC' : '#AFB6C9',
                      border: percentage === pct ? '1px solid rgba(93, 147, 178, 0.3)' : '1px solid transparent',
                    }}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* You will receive */}
          <div>
            <div className="text-xs tracking-[0.4px] mb-2" style={{ color: '#7B8187' }}>
              You Will Receive
            </div>
            
            <div 
              className="rounded-xl px-4 py-3 space-y-3"
              style={{ background: '#15191F' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TokenIcon symbol={position.token0.icon} size={24} />
                  <span className="text-sm text-white">{position.token0.symbol}</span>
                </div>
                <span className="text-sm font-medium text-white">
                  {(parseFloat(position.liquidity.replace(/,/g, '')) * percentage / 100 / 2).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TokenIcon symbol={position.token1.icon} size={24} />
                  <span className="text-sm text-white">{position.token1.symbol}</span>
                </div>
                <span className="text-sm font-medium text-white">
                  {(parseFloat(position.liquidity.replace(/,/g, '')) * percentage / 100 / 2).toFixed(4)}
                </span>
              </div>
            </div>
          </div>

          {/* Collect fees toggle */}
          <div 
            className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{ background: 'rgba(31, 36, 46, 0.6)' }}
          >
            <div>
              <div className="text-sm text-white">Collect Fees</div>
              <div className="text-xs" style={{ color: '#7B8187' }}>
                {position.unclaimedFees.usd} unclaimed
              </div>
            </div>
            <button
              onClick={() => setCollectFees(!collectFees)}
              className="w-11 h-6 rounded-full transition-colors relative"
              style={{ 
                background: collectFees ? '#5D93B2' : 'rgba(255,255,255,0.1)',
              }}
            >
              <div 
                className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                style={{ 
                  left: collectFees ? 'calc(100% - 20px)' : '4px',
                }}
              />
            </button>
          </div>

          {/* CTA */}
          <button 
            className="w-full py-3 rounded-xl text-white font-medium text-base tracking-[0.5px] transition-opacity hover:opacity-90"
            style={{ 
              background: 'rgba(239, 68, 68, 0.8)',
            }}
          >
            Remove Liquidity
          </button>
        </div>
      </div>
    </div>
  );
}



