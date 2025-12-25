"use client";

import { useState } from "react";

interface Token {
  id: string;
  symbol: string;
  name: string;
}

const tokens: Token[] = [
  { id: "eth", symbol: "ETH", name: "Ethereum" },
  { id: "dai", symbol: "DAI", name: "Dai" },
  { id: "wagmi", symbol: "WAGMI", name: "Wagmi" },
  { id: "usdc", symbol: "USDC", name: "USD Coin" },
];

// ETH icon - exact from Figma
function EthIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="url(#ethGradToken)"/>
      <circle cx="16" cy="16" r="15.5" stroke="white" strokeOpacity="0.2"/>
      <path opacity="0.7" d="M16 13.278L9.127 16.404L16 20.465L22.871 16.404L16 13.278Z" fill="white"/>
      <path opacity="0.5" d="M9.127 16.404L16 20.465V5L9.127 16.404Z" fill="white"/>
      <path opacity="0.8" d="M16 5V20.465L22.871 16.404L16 5Z" fill="white"/>
      <path opacity="0.5" d="M9.127 17.707L16 27.39V21.768L9.127 17.707Z" fill="white"/>
      <path opacity="0.8" d="M16 21.768V27.39L22.876 17.707L16 21.768Z" fill="white"/>
      <defs>
        <radialGradient id="ethGradToken" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(16 16) scale(16)">
          <stop stopColor="#627EEA"/>
          <stop offset="1" stopColor="#4A5FC1"/>
        </radialGradient>
      </defs>
    </svg>
  );
}

// DAI icon - exact from Figma
function DaiIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="url(#daiGradToken)"/>
      <circle cx="16" cy="16" r="15.5" stroke="white" strokeOpacity="0.2"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M7.636 7H15.223C19.837 7 23.335 9.473 24.637 13.071H27V15.245H25.134C25.171 15.594 25.19 15.944 25.189 16.295V16.348C25.19 16.743 25.166 17.137 25.12 17.528H27V19.703H24.592C23.256 23.251 19.785 25.7 15.223 25.7H7.636V19.703H5V17.528H7.636V15.245H5V13.071H7.636V7ZM9.757 19.703V23.749H15.223C18.595 23.749 21.101 22.129 22.268 19.703H9.757ZM22.918 17.528H9.757V15.245H22.921C22.97 15.611 22.995 15.98 22.995 16.348V16.402C22.996 16.779 22.969 17.155 22.918 17.528ZM15.223 8.948C18.611 8.948 21.124 10.611 22.284 13.071H9.757V8.948H15.223Z" fill="white"/>
      <defs>
        <radialGradient id="daiGradToken" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(16 16) scale(16)">
          <stop stopColor="#F5AC37"/>
          <stop offset="1" stopColor="#D4922F"/>
        </radialGradient>
      </defs>
    </svg>
  );
}

// WAGMI icon - exact from Figma
function WagmiIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="url(#wagmiGradToken)"/>
      <path d="M16 16L9.127 9.493V14.386L16 20.887L22.873 14.386V9.493L16 16Z" fill="white"/>
      <path d="M16 13.07L20.165 9.493H11.835L16 13.07Z" fill="white"/>
      <path d="M22.951 15.777L20.074 18.248H22.951V15.777Z" fill="white"/>
      <path d="M11.252 18.249L8.375 15.778V18.249H11.252Z" fill="white"/>
      <defs>
        <linearGradient id="wagmiGradToken" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981"/>
          <stop offset="1" stopColor="#059669"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// USDC icon
function UsdcIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#2775CA"/>
      <path d="M16 6C10.477 6 6 10.477 6 16C6 21.523 10.477 26 16 26C21.523 26 26 21.523 26 16C26 10.477 21.523 6 16 6ZM18.5 22.5V23.5H13.5V22.5C11.843 22.043 10.5 20.5 10.5 18.5H12.5C12.5 19.881 13.619 21 15 21H17C18.381 21 19.5 19.881 19.5 18.5C19.5 17.119 18.381 16 17 16H15C12.791 16 11 14.209 11 12C11 10.019 12.519 8.386 14.5 8.069V7H17.5V8.069C19.157 8.457 20.5 10 20.5 12H18.5C18.5 10.619 17.381 9.5 16 9.5H15C13.619 9.5 12.5 10.619 12.5 12C12.5 13.381 13.619 14.5 15 14.5H17C19.209 14.5 21 16.291 21 18.5C21 20.481 19.481 22.114 17.5 22.431V22.5H18.5Z" fill="white"/>
    </svg>
  );
}

// Close/X icon for remove button
function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 4L4 12M4 4L12 12" stroke="#7B8187" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

// Dropdown chevron
function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 6L8 10L12 6" stroke="#7B8187" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

interface TokenInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  selectedToken: string;
  onTokenChange: (token: string) => void;
  usdValue: string;
  balance: string;
  showMax?: boolean;
  showRemove?: boolean;
  onRemove?: () => void;
  readOnly?: boolean;
}

export function TokenInput({
  label,
  value,
  onChange,
  selectedToken,
  onTokenChange,
  usdValue,
  balance,
  showMax = true,
  showRemove = false,
  onRemove,
  readOnly = false,
}: TokenInputProps) {
  const [showTokenSelect, setShowTokenSelect] = useState(false);
  const token = tokens.find((t) => t.id === selectedToken) || tokens[0];

  const getIcon = (tokenId: string, size = 32) => {
    switch (tokenId) {
      case "eth": return <EthIcon size={size} />;
      case "dai": return <DaiIcon size={size} />;
      case "wagmi": return <WagmiIcon size={size} />;
      case "usdc": return <UsdcIcon size={size} />;
      default: return <EthIcon size={size} />;
    }
  };

  return (
    <div 
      className="rounded-xl px-4 py-3"
      style={{ background: 'rgba(31, 36, 46, 0.6)' }}
    >
      {/* Top row - Label and Balance */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium tracking-[0.25px]" style={{ color: '#AFB6C9' }}>
          {label}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-xs font-normal leading-5" style={{ color: '#A7A7A7' }}>
            {balance}
          </span>
          {showMax && (
            <button 
              onClick={() => onChange(balance)} 
              className="max-button"
            >
              MAX
            </button>
          )}
        </div>
      </div>

      {/* Main row - Amount and Token */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="0.00"
            readOnly={readOnly}
            className="w-full bg-transparent text-xl font-medium text-white placeholder-white/30 focus:outline-none tracking-[0.15px]"
          />
          <div className="text-xs font-normal tracking-[0.4px] mt-1.5" style={{ color: '#7B8187' }}>
            $ {usdValue}
          </div>
        </div>

        {/* Token selector */}
        <div className="relative">
          <button
            onClick={() => !readOnly && setShowTokenSelect(!showTokenSelect)}
            className="flex items-center gap-2 px-1.5 py-1 rounded-3xl transition-colors token-btn"
            style={{ background: showRemove ? '#29313E' : '#20262F' }}
          >
            {getIcon(token.id)}
            <div className="flex items-center gap-3">
              <span className="text-sm font-normal text-white tracking-[0.15px]">
                {token.symbol}
              </span>
              {showRemove ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove?.();
                  }}
                  className="flex items-center"
                >
                  <CloseIcon />
                </button>
              ) : (
                !readOnly && <ChevronIcon />
              )}
            </div>
          </button>

          {showTokenSelect && (
            <div 
              className="absolute top-full right-0 mt-2 w-48 rounded-xl overflow-hidden z-30"
              style={{ background: '#0A0D12', border: '1px solid #272C35' }}
            >
              {tokens.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    onTokenChange(t.id);
                    setShowTokenSelect(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                    t.id === selectedToken ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                >
                  {getIcon(t.id, 24)}
                  <div className="text-left">
                    <div className="text-sm font-medium text-white">{t.symbol}</div>
                    <div className="text-xs" style={{ color: '#7B8187' }}>{t.name}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
