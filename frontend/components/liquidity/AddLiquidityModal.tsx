"use client";

import { useState } from "react";
import { useAccount } from "wagmi";

interface AddLiquidityModalProps {
  onClose: () => void;
}

const FEE_TIERS = [
  { value: 0.01, label: "0.01%", description: "Best for stable pairs" },
  { value: 0.05, label: "0.05%", description: "Best for stable pairs" },
  { value: 0.3, label: "0.3%", description: "Best for most pairs" },
  { value: 1, label: "1%", description: "Best for exotic pairs" },
];

const TOKENS = [
  { id: "wagmi", symbol: "sWAGMI", name: "Synthetic WAGMI" },
  { id: "eth", symbol: "sETH", name: "Synthetic ETH" },
  { id: "dai", symbol: "sDAI", name: "Synthetic DAI" },
  { id: "usdc", symbol: "sUSDC", name: "Synthetic USDC" },
];

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
  const id = `modal-token-${symbol}-${size}`;

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

// Chevron
function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 6L8 10L12 6" stroke="#7B8187" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function AddLiquidityModal({ onClose }: AddLiquidityModalProps) {
  const [token0, setToken0] = useState("wagmi");
  const [token1, setToken1] = useState("eth");
  const [feeTier, setFeeTier] = useState(0.3);
  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [showToken0Select, setShowToken0Select] = useState(false);
  const [showToken1Select, setShowToken1Select] = useState(false);
  const { isConnected } = useAccount();

  const selectedToken0 = TOKENS.find(t => t.id === token0)!;
  const selectedToken1 = TOKENS.find(t => t.id === token1)!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-[480px] swap-card">
        {/* Header */}
        <div className="px-5 pt-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-normal text-white">Add Liquidity</h2>
            <p className="text-xs tracking-[0.4px] mt-1" style={{ color: '#7B8187' }}>
              Provide liquidity to earn fees
            </p>
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
          {/* Token Pair Selection */}
          <div>
            <div className="text-xs tracking-[0.4px] mb-2" style={{ color: '#7B8187' }}>
              Select Pair
            </div>
            <div className="flex items-center gap-3">
              {/* Token 0 */}
              <div className="relative flex-1">
                <button
                  onClick={() => setShowToken0Select(!showToken0Select)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl token-btn"
                >
                  <TokenIcon symbol={token0} size={24} />
                  <span className="text-sm font-normal text-white">{selectedToken0.symbol}</span>
                  <ChevronIcon />
                </button>
                
                {showToken0Select && (
                  <div 
                    className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-30"
                    style={{ background: '#0A0D12', border: '1px solid #272C35' }}
                  >
                    {TOKENS.filter(t => t.id !== token1).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setToken0(t.id);
                          setShowToken0Select(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                          t.id === token0 ? "bg-white/10" : "hover:bg-white/5"
                        }`}
                      >
                        <TokenIcon symbol={t.id} size={20} />
                        <span className="text-sm text-white">{t.symbol}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <span style={{ color: '#7B8187' }}>/</span>

              {/* Token 1 */}
              <div className="relative flex-1">
                <button
                  onClick={() => setShowToken1Select(!showToken1Select)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl token-btn"
                >
                  <TokenIcon symbol={token1} size={24} />
                  <span className="text-sm font-normal text-white">{selectedToken1.symbol}</span>
                  <ChevronIcon />
                </button>
                
                {showToken1Select && (
                  <div 
                    className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-30"
                    style={{ background: '#0A0D12', border: '1px solid #272C35' }}
                  >
                    {TOKENS.filter(t => t.id !== token0).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setToken1(t.id);
                          setShowToken1Select(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                          t.id === token1 ? "bg-white/10" : "hover:bg-white/5"
                        }`}
                      >
                        <TokenIcon symbol={t.id} size={20} />
                        <span className="text-sm text-white">{t.symbol}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Fee Tier */}
          <div>
            <div className="text-xs tracking-[0.4px] mb-2" style={{ color: '#7B8187' }}>
              Fee Tier
            </div>
            <div className="grid grid-cols-4 gap-2">
              {FEE_TIERS.map((tier) => (
                <button
                  key={tier.value}
                  onClick={() => setFeeTier(tier.value)}
                  className="p-2.5 rounded-xl text-center transition-all"
                  style={{
                    background: feeTier === tier.value ? 'rgba(93, 147, 178, 0.15)' : '#15191F',
                    border: feeTier === tier.value ? '1px solid rgba(93, 147, 178, 0.3)' : '1px solid transparent',
                  }}
                >
                  <div 
                    className="text-sm font-medium"
                    style={{ color: feeTier === tier.value ? '#FCFCFC' : '#AFB6C9' }}
                  >
                    {tier.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div>
            <div className="text-xs tracking-[0.4px] mb-2" style={{ color: '#7B8187' }}>
              Set Price Range
            </div>
            <div className="flex items-center gap-3">
              <div 
                className="flex-1 rounded-xl px-4 py-3"
                style={{ background: 'rgba(31, 36, 46, 0.6)' }}
              >
                <div className="text-xs mb-1" style={{ color: '#7B8187' }}>Min Price</div>
                <input
                  type="text"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="0.0"
                  className="w-full bg-transparent text-base font-medium text-white placeholder-white/30 focus:outline-none"
                />
                <div className="text-xs mt-1" style={{ color: '#7B8187' }}>
                  {selectedToken0.symbol} per {selectedToken1.symbol}
                </div>
              </div>
              
              <div 
                className="flex-1 rounded-xl px-4 py-3"
                style={{ background: 'rgba(31, 36, 46, 0.6)' }}
              >
                <div className="text-xs mb-1" style={{ color: '#7B8187' }}>Max Price</div>
                <input
                  type="text"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="∞"
                  className="w-full bg-transparent text-base font-medium text-white placeholder-white/30 focus:outline-none"
                />
                <div className="text-xs mt-1" style={{ color: '#7B8187' }}>
                  {selectedToken0.symbol} per {selectedToken1.symbol}
                </div>
              </div>
            </div>
            
            {/* Quick range buttons */}
            <div className="flex items-center gap-2 mt-2">
              {["Full Range", "Safe", "Common", "Expert"].map((range) => (
                <button
                  key={range}
                  className="px-3 py-1 rounded-lg text-xs font-normal transition-colors"
                  style={{ background: '#20262F', color: '#AFB6C9' }}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          {/* Deposit Amounts */}
          <div>
            <div className="text-xs tracking-[0.4px] mb-2" style={{ color: '#7B8187' }}>
              Deposit Amounts
            </div>
            
            {/* Token 0 */}
            <div 
              className="rounded-xl px-4 py-3 mb-2"
              style={{ background: 'rgba(31, 36, 46, 0.6)' }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium tracking-[0.25px]" style={{ color: '#AFB6C9' }}>
                  {selectedToken0.symbol}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-normal" style={{ color: '#A7A7A7' }}>0.00</span>
                  <button className="max-button">MAX</button>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="text"
                  value={amount0}
                  onChange={(e) => setAmount0(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 bg-transparent text-xl font-medium text-white placeholder-white/30 focus:outline-none"
                />
                <div className="flex items-center gap-2 px-2 py-1 rounded-3xl token-btn">
                  <TokenIcon symbol={token0} size={24} />
                  <span className="text-sm font-normal text-white">{selectedToken0.symbol}</span>
                </div>
              </div>
            </div>

            {/* Token 1 */}
            <div 
              className="rounded-xl px-4 py-3"
              style={{ background: 'rgba(31, 36, 46, 0.6)' }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium tracking-[0.25px]" style={{ color: '#AFB6C9' }}>
                  {selectedToken1.symbol}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-normal" style={{ color: '#A7A7A7' }}>0.00</span>
                  <button className="max-button">MAX</button>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="text"
                  value={amount1}
                  onChange={(e) => setAmount1(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 bg-transparent text-xl font-medium text-white placeholder-white/30 focus:outline-none"
                />
                <div className="flex items-center gap-2 px-2 py-1 rounded-3xl token-btn">
                  <TokenIcon symbol={token1} size={24} />
                  <span className="text-sm font-normal text-white">{selectedToken1.symbol}</span>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <button 
            className="w-full py-3 cta-button text-white font-medium text-base tracking-[0.5px]"
          >
            {isConnected ? "Add Liquidity" : "Connect Wallet"}
          </button>
        </div>
      </div>
    </div>
  );
}



