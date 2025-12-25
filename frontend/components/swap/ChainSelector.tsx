"use client";

import { useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";

interface Chain {
  id: string;
  chainId: number;
  name: string;
  eid: number;
}

// Available chains for cross-chain operations
export const AVAILABLE_CHAINS: Chain[] = [
  { id: "sonic", chainId: 146, name: "Sonic", eid: 30332 },
  { id: "arbitrum", chainId: 42161, name: "Arbitrum", eid: 30110 },
  { id: "base", chainId: 8453, name: "Base", eid: 30184 },
  { id: "ethereum", chainId: 1, name: "Ethereum", eid: 30101 },
];

// Chain icons
function SonicIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="url(#sonicGrad)"/>
      <path d="M16 6L8 16L16 26L24 16L16 6Z" fill="white" fillOpacity="0.9"/>
      <path d="M16 10L11 16L16 22L21 16L16 10Z" fill="#1E90FF"/>
      <defs>
        <linearGradient id="sonicGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1E90FF"/>
          <stop offset="1" stopColor="#0066CC"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

function ArbitrumIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="url(#arbGrad)"/>
      <path d="M16 6L8 11V21L16 26L24 21V11L16 6Z" fill="white"/>
      <path d="M16 9L11 12V20L16 23L21 20V12L16 9Z" fill="#28A0F0"/>
      <defs>
        <linearGradient id="arbGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#28A0F0"/>
          <stop offset="1" stopColor="#1C7AC0"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

function BaseIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="url(#baseGrad)"/>
      <circle cx="16" cy="16" r="8" fill="white"/>
      <circle cx="16" cy="16" r="5" fill="#0052FF"/>
      <defs>
        <linearGradient id="baseGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0052FF"/>
          <stop offset="1" stopColor="#0039B3"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

function EthereumIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="url(#ethGrad)"/>
      <path d="M16 4V12.5L22 15.5L16 4Z" fill="white" fillOpacity="0.6"/>
      <path d="M16 4L10 15.5L16 12.5V4Z" fill="white"/>
      <path d="M16 21.5V28L22 17L16 21.5Z" fill="white" fillOpacity="0.6"/>
      <path d="M16 28V21.5L10 17L16 28Z" fill="white"/>
      <defs>
        <linearGradient id="ethGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#627EEA"/>
          <stop offset="1" stopColor="#4A5FC1"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// Swap arrows icon
function SwapArrowsIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 11H26M6 11L11 6M6 11L11 16" stroke="#AFB6C9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M26 21H6M26 21L21 16M26 21L21 26" stroke="#AFB6C9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

interface ChainSelectorProps {
  originChain: string;
  destChain: string;
  onOriginChange: (chain: string) => void;
  onDestChange: (chain: string) => void;
  onSwapChains: () => void;
}

export function ChainSelector({
  originChain,
  destChain,
  onOriginChange,
  onDestChange,
  onSwapChains,
}: ChainSelectorProps) {
  const [showOriginDropdown, setShowOriginDropdown] = useState(false);
  const [showDestDropdown, setShowDestDropdown] = useState(false);
  const { switchChain } = useSwitchChain();
  const { chain: currentChain } = useAccount();

  const origin = AVAILABLE_CHAINS.find((c) => c.id === originChain) || AVAILABLE_CHAINS[0];
  const dest = AVAILABLE_CHAINS.find((c) => c.id === destChain) || AVAILABLE_CHAINS[1];

  const getIcon = (chainId: string, size = 32) => {
    switch (chainId) {
      case "sonic": return <SonicIcon size={size} />;
      case "arbitrum": return <ArbitrumIcon size={size} />;
      case "base": return <BaseIcon size={size} />;
      case "ethereum": return <EthereumIcon size={size} />;
      default: return <SonicIcon size={size} />;
    }
  };

  const getBgStyle = (chainId: string) => {
    switch (chainId) {
      case "sonic": return { background: 'rgba(30, 144, 255, 0.15)' };
      case "arbitrum": return { background: 'rgba(40, 160, 240, 0.15)' };
      case "base": return { background: 'rgba(0, 82, 255, 0.15)' };
      case "ethereum": return { background: 'rgba(98, 126, 234, 0.15)' };
      default: return { background: 'rgba(26, 106, 255, 0.15)' };
    }
  };

  const handleOriginSelect = (chainId: string) => {
    onOriginChange(chainId);
    setShowOriginDropdown(false);
    // Switch wallet to selected chain
    const chain = AVAILABLE_CHAINS.find(c => c.id === chainId);
    if (chain && currentChain?.id !== chain.chainId) {
      switchChain?.({ chainId: chain.chainId });
    }
  };

  return (
    <div className="flex items-center gap-[18px]">
      {/* Origin Chain */}
      <div className="relative flex-1">
        <button
          onClick={() => setShowOriginDropdown(!showOriginDropdown)}
          className="w-full h-[52px] flex items-center gap-2 px-5 rounded-xl transition-opacity hover:opacity-90"
          style={getBgStyle(origin.id)}
        >
          {getIcon(origin.id)}
          <div className="text-left">
            <div className="text-xs font-normal tracking-[0.4px]" style={{ color: '#AFB6C9' }}>Origin</div>
            <div className="text-base font-normal text-white">{origin.name}</div>
          </div>
        </button>

        {showOriginDropdown && (
          <div 
            className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-20"
            style={{ background: '#0A0D12', border: '1px solid #272C35' }}
          >
            {AVAILABLE_CHAINS.filter(c => c.id !== destChain).map((chain) => (
              <button
                key={chain.id}
                onClick={() => handleOriginSelect(chain.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                  chain.id === originChain ? "bg-white/10" : "hover:bg-white/5"
                }`}
              >
                {getIcon(chain.id, 24)}
                <span className="text-sm font-medium text-white">{chain.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Swap Button */}
      <button
        onClick={onSwapChains}
        className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full transition-all hover:rotate-180 duration-300"
      >
        <SwapArrowsIcon />
      </button>

      {/* Destination Chain */}
      <div className="relative flex-1">
        <button
          onClick={() => setShowDestDropdown(!showDestDropdown)}
          className="w-full h-[52px] flex items-center gap-2 px-5 rounded-xl transition-opacity hover:opacity-90"
          style={getBgStyle(dest.id)}
        >
          {getIcon(dest.id)}
          <div className="text-left">
            <div className="text-xs font-normal tracking-[0.4px]" style={{ color: '#AFB6C9' }}>Destination</div>
            <div className="text-base font-normal text-white">{dest.name}</div>
          </div>
        </button>

        {showDestDropdown && (
          <div 
            className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-20"
            style={{ background: '#0A0D12', border: '1px solid #272C35' }}
          >
            {AVAILABLE_CHAINS.filter(c => c.id !== originChain).map((chain) => (
              <button
                key={chain.id}
                onClick={() => {
                  onDestChange(chain.id);
                  setShowDestDropdown(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                  chain.id === destChain ? "bg-white/10" : "hover:bg-white/5"
                }`}
              >
                {getIcon(chain.id, 24)}
                <span className="text-sm font-medium text-white">{chain.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Export chain helpers
export function getChainByName(name: string) {
  return AVAILABLE_CHAINS.find(c => c.id === name);
}

export function getChainById(chainId: number) {
  return AVAILABLE_CHAINS.find(c => c.chainId === chainId);
}
