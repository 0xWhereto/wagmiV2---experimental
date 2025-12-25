"use client";

import { useState, useEffect } from "react";
import { useAccount, useBalance } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { ChainSelector, AVAILABLE_CHAINS, getChainByName } from "./ChainSelector";
import { TokenInput } from "./TokenInput";
import { ReceiveSection } from "./ReceiveSection";

type TabType = "crosschain" | "wagmiswap";

interface TokenEntry {
  id: string;
  token: string;
  amount: string;
}

// Settings/sliders icon
function SettingsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 6H14M4 6C4 6.53043 4.21071 7.03914 4.58579 7.41421C4.96086 7.78929 5.46957 8 6 8C6.53043 8 7.03914 7.78929 7.41421 7.41421C7.78929 7.03914 8 6.53043 8 6M4 6C4 5.46957 4.21071 4.96086 4.58579 4.58579C4.96086 4.21071 5.46957 4 6 4C6.53043 4 7.03914 4.21071 7.41421 4.58579C7.78929 4.96086 8 5.46957 8 6M14 6C14 6.53043 14.2107 7.03914 14.5858 7.41421C14.9609 7.78929 15.4696 8 16 8C16.5304 8 17.0391 7.78929 17.4142 7.41421C17.7893 7.03914 18 6.53043 18 6C18 5.46957 17.7893 4.96086 17.4142 4.58579C17.0391 4.21071 16.5304 4 16 4C15.4696 4 14.9609 4.21071 14.5858 4.58579C14.2107 4.96086 14 5.46957 14 6ZM18 6H20M4 18H8M8 18C8 18.5304 8.21071 19.0391 8.58579 19.4142C8.96086 19.7893 9.46957 20 10 20C10.5304 20 11.0391 19.7893 11.4142 19.4142C11.7893 19.0391 12 18.5304 12 18M8 18C8 17.4696 8.21071 16.9609 8.58579 16.5858C8.96086 16.2107 9.46957 16 10 16C10.5304 16 11.0391 16.2107 11.4142 16.5858C11.7893 16.9609 12 17.4696 12 18M12 18H20M4 12H10M16 12H20M16 12C16 12.5304 15.7893 13.0391 15.4142 13.4142C15.0391 13.7893 14.5304 14 14 14C13.4696 14 12.9609 13.7893 12.5858 13.4142C12.2107 13.0391 12 12.5304 12 12C12 11.4696 12.2107 10.9609 12.5858 10.5858C12.9609 10.2107 13.4696 10 14 10C14.5304 10 15.0391 10.2107 15.4142 10.5858C15.7893 10.9609 16 11.4696 16 12Z" stroke="#7B8187" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

// Plus icon for swap
function SwapPlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 3V13M3 8H13" stroke="#AFB6C9" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

// Add/Plus icon
function AddIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 3V13M3 8H13" stroke="#AFB6C9" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

// WAGMI mini icon
function WagmiMiniIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="8" fill="url(#wagmiMiniGradCard)"/>
      <path d="M8 8L4.56 4.75V7.19L8 10.44L11.44 7.19V4.75L8 8Z" fill="white"/>
      <path d="M8 6.77L10.08 4.98H5.92L8 6.77Z" fill="white"/>
      <defs>
        <linearGradient id="wagmiMiniGradCard" x1="0" y1="0" x2="16" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981"/>
          <stop offset="1" stopColor="#059669"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// DAI mini icon
function DaiMiniIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="8" fill="url(#daiMiniGrad)"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M3.818 3.5H7.611C9.918 3.5 11.668 4.737 12.318 6.536H13.5V7.623H12.567C12.586 7.797 12.595 7.972 12.595 8.148V8.174C12.595 8.372 12.583 8.569 12.56 8.764H13.5V9.852H12.296C11.628 11.626 9.892 12.85 7.611 12.85H3.818V9.852H2.5V8.764H3.818V7.623H2.5V6.536H3.818V3.5ZM4.878 9.852V11.875H7.611C9.298 11.875 10.551 11.065 11.134 9.852H4.878ZM11.459 8.764H4.878V7.623H11.46C11.485 7.806 11.498 7.99 11.498 8.174V8.201C11.498 8.39 11.484 8.578 11.459 8.764ZM7.611 4.474C9.305 4.474 10.562 5.306 11.142 6.536H4.878V4.474H7.611Z" fill="white"/>
      <defs>
        <radialGradient id="daiMiniGrad" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(8 8) scale(8)">
          <stop stopColor="#F5AC37"/>
          <stop offset="1" stopColor="#D4922F"/>
        </radialGradient>
      </defs>
    </svg>
  );
}

// Wallet icon
function WalletIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 6H3C2.44772 6 2 6.44772 2 7V16C2 16.5523 2.44772 17 3 17H17C17.5523 17 18 16.5523 18 16V7C18 6.44772 17.5523 6 17 6Z" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M14 11.5C14 12.0523 13.5523 12.5 13 12.5C12.4477 12.5 12 12.0523 12 11.5C12 10.9477 12.4477 10.5 13 10.5C13.5523 10.5 14 10.9477 14 11.5Z" fill="currentColor"/>
      <path d="M4 6V5C4 3.89543 4.89543 3 6 3H14C15.1046 3 16 3.89543 16 5V6" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

export function SwapCard() {
  const [activeTab, setActiveTab] = useState<TabType>("crosschain");
  const [originChain, setOriginChain] = useState("sonic");
  const [destChain, setDestChain] = useState("arbitrum");
  const [tokenInputs, setTokenInputs] = useState<TokenEntry[]>([
    { id: "1", token: "eth", amount: "" },
    { id: "2", token: "dai", amount: "" },
  ]);
  const [receiveAmount, setReceiveAmount] = useState("0.00");
  const [receivingAddress, setReceivingAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Wagmi hooks
  const { address, isConnected, chain } = useAccount();
  
  // Set receiving address when wallet connects
  useEffect(() => {
    if (address) {
      setReceivingAddress(`${address.slice(0, 7)}...${address.slice(-4)}`);
    }
  }, [address]);

  const handleSwapChains = () => {
    const temp = originChain;
    setOriginChain(destChain);
    setDestChain(temp);
  };

  const handleAddToken = () => {
    const newId = String(Date.now());
    setTokenInputs([...tokenInputs, { id: newId, token: "eth", amount: "" }]);
  };

  const handleRemoveToken = (id: string) => {
    if (tokenInputs.length > 1) {
      setTokenInputs(tokenInputs.filter((t) => t.id !== id));
    }
  };

  const handleTokenChange = (id: string, field: "token" | "amount", value: string) => {
    setTokenInputs(tokenInputs.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  // Calculate total USD value
  const getTotalUsd = () => {
    // In a real implementation, this would fetch prices from an oracle
    const total = tokenInputs.reduce((acc, input) => {
      const amount = parseFloat(input.amount) || 0;
      // Mock prices
      const price = input.token === "eth" ? 2000 : input.token === "dai" ? 1 : 0.033;
      return acc + amount * price;
    }, 0);
    return `$${total.toFixed(3)}`;
  };

  // Get button text based on state
  const getButtonText = () => {
    if (!isConnected) return "Connect Wallet";
    
    const originChainConfig = getChainByName(originChain);
    if (chain?.id !== originChainConfig?.chainId) {
      return `Switch to ${originChainConfig?.name}`;
    }
    
    const hasAmount = tokenInputs.some(t => parseFloat(t.amount) > 0);
    if (!hasAmount) return "Enter an amount";
    
    return "Bridge Tokens";
  };

  // Handle button click
  const handleButtonClick = async () => {
    if (!isConnected) {
      // Trigger wallet connection (handled by RainbowKit)
      return;
    }

    const hasAmount = tokenInputs.some(t => parseFloat(t.amount) > 0);
    if (!hasAmount) return;

    setIsLoading(true);
    try {
      // TODO: Implement actual bridge logic
      console.log("Bridging tokens from", originChain, "to", destChain);
      console.log("Tokens:", tokenInputs);
    } catch (error) {
      console.error("Bridge error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[502px] swap-card">
      {/* Header - Tabs and Settings */}
      <div className="relative px-5 pt-5">
        <div className="flex items-center justify-between">
          {/* Tabs */}
          <div className="flex items-center gap-8">
            <button
              onClick={() => setActiveTab("crosschain")}
              className={`relative text-xl font-normal capitalize leading-5 transition-colors ${
                activeTab === "crosschain" ? "text-white" : "text-white/20"
              }`}
            >
              Cross chain
              {activeTab === "crosschain" && (
                <div 
                  className="absolute -bottom-1 left-0 h-0.5 rounded-full"
                  style={{ 
                    width: '114px',
                    background: 'linear-gradient(to right, #FCFCFC, transparent)' 
                  }}
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab("wagmiswap")}
              className={`text-xl font-normal capitalize leading-5 transition-colors ${
                activeTab === "wagmiswap" ? "text-white" : "text-white/20"
              }`}
            >
              Wagmi swap
            </button>
          </div>

          {/* Settings */}
          <button className="hover:opacity-80 transition-opacity">
            <SettingsIcon />
          </button>
        </div>
      </div>

      {/* Card content */}
      <div className="px-5 pb-5 pt-4 space-y-4">
        {/* Chain Selector */}
        <ChainSelector
          originChain={originChain}
          destChain={destChain}
          onOriginChange={setOriginChain}
          onDestChange={setDestChain}
          onSwapChains={handleSwapChains}
        />

        {/* Token Inputs with relative positioning for swap button */}
        <div className="relative">
          {tokenInputs.map((input, index) => (
            <div key={input.id} className="relative">
              {index > 0 && (
                <div className="absolute left-1/2 -top-3 -translate-x-1/2 z-10">
                  <div className="swap-icon-btn p-2">
                    <SwapPlusIcon />
                  </div>
                </div>
              )}
              <div className={index > 0 ? "pt-1" : ""}>
                <TokenInput
                  label="You sell"
                  value={input.amount}
                  onChange={(value) => handleTokenChange(input.id, "amount", value)}
                  selectedToken={input.token}
                  onTokenChange={(token) => handleTokenChange(input.id, "token", token)}
                  usdValue={input.token === "eth" ? "20.00" : "10.00"}
                  balance="0.00"
                  showRemove={tokenInputs.length > 1}
                  onRemove={() => handleRemoveToken(input.id)}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Total and Add Token row */}
        <div className="flex items-center justify-between">
          {/* Total */}
          <div 
            className="flex items-center gap-2 px-2 py-2 rounded-xl"
            style={{ background: '#15191F' }}
          >
            <span className="text-sm font-medium tracking-[0.25px]" style={{ color: '#AFB6C9' }}>
              Total
            </span>
            <div className="flex items-center gap-1">
              {/* Overlapping token icons */}
              <div className="flex items-center -space-x-1">
                <DaiMiniIcon />
                <div className="relative">
                  <WagmiMiniIcon />
                </div>
              </div>
              <span className="text-sm font-medium text-white tracking-[0.25px] ml-1">
                {getTotalUsd()}
              </span>
            </div>
          </div>

          {/* Add token button */}
          <button
            onClick={handleAddToken}
            className="add-token-btn flex items-center gap-2 px-2 py-2"
          >
            <AddIcon />
            <span className="text-sm font-medium tracking-[0.25px]" style={{ color: '#AFB6C9' }}>
              Add token to sell
            </span>
          </button>
        </div>

        {/* Receive Section */}
        <ReceiveSection
          amount={receiveAmount}
          usdValue="28.00"
          receivingAddress={receivingAddress || "Connect wallet"}
          onEditAddress={() => console.log("Edit address")}
        />

        {/* Penalty */}
        <div className="flex items-center justify-between px-0 py-1.5">
          <span className="text-sm font-normal tracking-[0.25px]" style={{ color: '#7B8187' }}>
            Penalty
          </span>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1">
              <WagmiMiniIcon />
              <span className="text-sm font-normal text-white tracking-[0.25px]">
                3.00
              </span>
            </div>
            <span className="text-xs font-normal tracking-[0.4px]" style={{ color: '#7B8187' }}>
              $ 0.00
            </span>
          </div>
        </div>

        {/* CTA Button */}
        <button 
          onClick={handleButtonClick}
          disabled={isLoading}
          className={`w-full py-3 cta-button text-white font-medium text-base tracking-[0.5px] flex items-center justify-center gap-2 ${
            isLoading ? 'opacity-70 cursor-not-allowed' : ''
          }`}
        >
          {!isConnected && <WalletIcon />}
          {isLoading ? 'Processing...' : getButtonText()}
        </button>
      </div>
    </div>
  );
}
