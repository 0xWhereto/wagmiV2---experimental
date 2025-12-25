"use client";

// WAGMI token icon - exact from Figma
function WagmiTokenIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="url(#wagmiRecGradNew)"/>
      <path d="M16 16L9.127 9.493V14.386L16 20.887L22.873 14.386V9.493L16 16Z" fill="white"/>
      <path d="M16 13.07L20.165 9.493H11.835L16 13.07Z" fill="white"/>
      <path d="M22.951 15.777L20.074 18.248H22.951V15.777Z" fill="white"/>
      <path d="M11.252 18.249L8.375 15.778V18.249H11.252Z" fill="white"/>
      <defs>
        <linearGradient id="wagmiRecGradNew" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981"/>
          <stop offset="1" stopColor="#059669"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// Wallet/address icon - gradient circle
function AddressIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="8" fill="url(#addressIconGrad)"/>
      <defs>
        <linearGradient id="addressIconGrad" x1="0" y1="0" x2="16" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5D93B2"/>
          <stop offset="1" stopColor="#34627D"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// Edit/pencil icon - exact from Figma
function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9.5 3.5L12.5 6.5M2 14H5L13.5 5.5C13.8978 5.10218 14.1213 4.56261 14.1213 4C14.1213 3.43739 13.8978 2.89782 13.5 2.5C13.1022 2.10218 12.5626 1.87868 12 1.87868C11.4374 1.87868 10.8978 2.10218 10.5 2.5L2 11V14Z" stroke="#7B8187" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

interface ReceiveSectionProps {
  amount: string;
  usdValue: string;
  receivingAddress: string;
  onEditAddress: () => void;
}

export function ReceiveSection({
  amount,
  usdValue,
  receivingAddress,
  onEditAddress,
}: ReceiveSectionProps) {
  return (
    <div className="rounded-t-xl overflow-hidden">
      {/* Main receive section */}
      <div 
        className="px-4 py-3"
        style={{ background: 'rgba(31, 36, 46, 0.4)' }}
      >
        {/* Label */}
        <div className="flex items-center h-5 mb-1.5">
          <span className="text-xs font-medium tracking-[0.25px]" style={{ color: '#AFB6C9' }}>
            You receive
          </span>
        </div>

        {/* Amount and Token */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-medium text-white tracking-[0.15px]">
              {amount || "0.00"}
            </div>
            <div className="text-xs font-normal tracking-[0.4px] mt-1.5" style={{ color: '#7B8187' }}>
              $ {usdValue}
            </div>
          </div>

          <div 
            className="flex items-center gap-2 px-1.5 py-1 rounded-3xl token-btn"
          >
            <WagmiTokenIcon />
            <span className="text-sm font-normal text-white tracking-[0.15px] pr-1">
              WAGMI
            </span>
          </div>
        </div>
      </div>

      {/* Address bar */}
      <div 
        className="flex items-center justify-between px-4 py-2 h-8 rounded-b-xl"
        style={{ background: 'rgba(31, 36, 46, 0.8)' }}
      >
        <div className="flex items-center gap-1">
          <AddressIcon />
          <span className="text-xs font-light tracking-[0.25px]" style={{ color: '#AFB6C9' }}>
            {receivingAddress}
          </span>
        </div>
        
        <button 
          onClick={onEditAddress} 
          className="edit-button w-6 h-6 flex items-center justify-center"
        >
          <EditIcon />
        </button>
      </div>
    </div>
  );
}
