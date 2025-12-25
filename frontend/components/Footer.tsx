"use client";

import { useState, useEffect } from "react";

// Gas/pump icon - exact from Figma
function GasIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.333 14V4.667A1.333 1.333 0 0 0 10 3.333H4A1.333 1.333 0 0 0 2.667 4.667V14M1.333 14H12.667M4 7.333h4M14.667 6V10.667C14.667 11.035 14.368 11.333 14 11.333H12.667V6H14C14.368 6 14.667 6.299 14.667 6.667V6Z" stroke="#7B8187" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10.667 3.333L13.333 6" stroke="#7B8187" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// WAGMI mini token icon
function WagmiMiniIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="8" fill="url(#wagmiFooterGrad)"/>
      <path d="M8 8L4.56 4.75V7.19L8 10.44L11.44 7.19V4.75L8 8Z" fill="white"/>
      <path d="M8 6.77L10.08 4.98H5.92L8 6.77Z" fill="white"/>
      <defs>
        <linearGradient id="wagmiFooterGrad" x1="0" y1="0" x2="16" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981"/>
          <stop offset="1" stopColor="#059669"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Footer() {
  const [blockNumber, setBlockNumber] = useState(18144859);

  useEffect(() => {
    const interval = setInterval(() => {
      setBlockNumber((prev) => prev + 1);
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 h-7" style={{ background: '#0E1218' }}>
      <div className="container-app h-full">
        <div className="flex items-center justify-between h-full">
          {/* Left side - Gas and WAGMI price */}
          <div className="flex items-center gap-4">
            {/* Gas price */}
            <div className="flex items-center gap-1.5">
              <GasIcon />
              <span className="text-sm font-normal tracking-[0.25px]" style={{ color: '#7B8187' }}>
                $ 0.0332
              </span>
            </div>
            
            {/* WAGMI price */}
            <div className="flex items-center gap-1.5">
              <WagmiMiniIcon />
              <span className="text-sm font-normal tracking-[0.25px]" style={{ color: '#7B8187' }}>
                $ 0.0332
              </span>
            </div>
          </div>

          {/* Right side - Block number */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-light capitalize leading-5" style={{ color: '#7B8187' }}>
              Block Number
            </span>
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <span 
                  className="block w-2 h-2 rounded-full pulse-dot" 
                  style={{ background: '#638E5D' }}
                />
              </div>
              <span className="text-sm font-light capitalize leading-5" style={{ color: '#638E5D' }}>
                {blockNumber.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
