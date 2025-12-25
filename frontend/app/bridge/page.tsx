"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useAccount, useSwitchChain } from "wagmi";
import { Header } from "@/components/Header";
import { useAllTokenBalances } from "@/hooks/useTokenBalances";
import { useTokenApproval } from "@/hooks/useTokenApproval";
import { useBridgeTransaction } from "@/hooks/useBridgeTransaction";
import { useGatewayBalance } from "@/hooks/useGatewayBalance";
import { getTokenLogoBySymbol, getChainLogo } from "@/lib/tokens/logos";
import { getTokensForChain, type Token } from "@/lib/tokens/tokenList";
import { getChainConfig } from "@/lib/contracts/config";

// Supported chain IDs
const DEPLOYED_CHAIN_IDS = [146, 42161, 8453, 1]; // Sonic, Arbitrum, Base, Ethereum
const HUB_CHAIN_ID = 146;

// Chain display info
const CHAIN_DISPLAY: Record<number, { name: string; color: string }> = {
  146: { name: "Sonic", color: "#19E68C" },
  42161: { name: "Arbitrum", color: "#28A0F0" },
  8453: { name: "Base", color: "#0052FF" },
  1: { name: "Ethereum", color: "#627EEA" },
};

// Chain Dropdown Selector
function ChainDropdown({
  selectedChainId,
  onChange,
  availableChains,
  label,
}: {
  selectedChainId: number;
  onChange: (chainId: number) => void;
  availableChains: number[];
  label: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedChain = CHAIN_DISPLAY[selectedChainId];

  return (
    <div className="flex-1">
      <div className="text-zinc-500 text-sm mb-2">{label}</div>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/50 hover:bg-zinc-900 rounded-lg transition-colors group"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full overflow-hidden">
              <Image src={getChainLogo(selectedChainId)} alt={selectedChain?.name || ""} width={24} height={24} className="w-full h-full object-cover" />
            </div>
            <span className="text-zinc-100">{selectedChain?.name || "Select"}</span>
          </div>
          <svg className="w-4 h-4 text-zinc-400 group-hover:text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        <AnimatePresence>
          {isOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 rounded-lg overflow-hidden shadow-2xl z-50"
              >
                {availableChains.map((chainId) => {
                  const chain = CHAIN_DISPLAY[chainId];
                  if (!chain) return null;
                  return (
                    <button
                      key={chainId}
                      onClick={() => { onChange(chainId); setIsOpen(false); }}
                      className="w-full px-4 py-3 flex items-center gap-2 hover:bg-zinc-800 transition-colors group"
                    >
                      <div className="w-6 h-6 rounded-full overflow-hidden">
                        <Image src={getChainLogo(chainId)} alt={chain.name} width={24} height={24} className="w-full h-full object-cover" />
                      </div>
                      <span className="text-zinc-300 group-hover:text-zinc-100">{chain.name}</span>
                      {chainId === selectedChainId && (
                        <svg className="ml-auto w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Token Selector
function TokenSelector({
  selected,
  onChange,
  tokens,
  chainId,
}: {
  selected: string;
  onChange: (symbol: string) => void;
  tokens: Token[];
  chainId: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { balances } = useAllTokenBalances(chainId);

  const availableTokens = tokens
    .filter((t) => 
      t.symbol.toLowerCase().includes(search.toLowerCase()) ||
      t.name.toLowerCase().includes(search.toLowerCase())
    )
    .map((token) => ({
      ...token,
      balance: balances[token.symbol]?.balanceFormatted || "0.00",
    }))
    .sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance));

  const handleTokenSelect = (symbol: string) => {
    onChange(symbol);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:bg-white/5"
          style={{ background: "transparent" }}
        >
          <div className="w-5 h-5 rounded-full overflow-hidden bg-gray-700">
            <Image src={getTokenLogoBySymbol(selected)} alt={selected} width={20} height={20} className="w-full h-full object-cover" />
          </div>
          <span className="font-medium text-sm text-white">{selected}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      {/* Portal-style modal - outside the relative container */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[9999]">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/50" 
              onClick={() => { setIsOpen(false); setSearch(""); }} 
            />
            
            {/* Dropdown Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-72 rounded-xl overflow-hidden shadow-2xl"
              style={{ background: "#18181b" }}
            >
              {/* Header */}
              <div className="p-4 border-b border-zinc-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-medium">Select a token</h3>
                  <button
                    type="button"
                    onClick={() => { setIsOpen(false); setSearch(""); }}
                    className="p-1 hover:bg-zinc-700 rounded transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or symbol"
                  autoFocus
                  className="w-full px-3 py-2 bg-zinc-900 text-white text-sm rounded-lg placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                />
              </div>
              
              {/* Token List */}
              <div 
                className="max-h-64 overflow-y-auto"
                style={{
                  scrollbarWidth: "thin",
                  scrollbarColor: "#374151 transparent",
                }}
              >
                {availableTokens.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-gray-500 text-center">No tokens found</div>
                ) : (
                  availableTokens.map((token) => (
                    <button
                      type="button"
                      key={token.symbol}
                      onClick={() => handleTokenSelect(token.symbol)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-700">
                          <Image src={getTokenLogoBySymbol(token.symbol)} alt={token.symbol} width={32} height={32} className="w-full h-full object-cover" />
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-medium text-white">{token.symbol}</div>
                          <div className="text-xs text-gray-500">{token.name}</div>
                        </div>
                      </div>
                      <span className="text-sm text-gray-400">{token.balance}</span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function BridgePage() {
  const { isConnected, address, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  
  // Chain states
  const [sourceChainId, setSourceChainId] = useState(42161); // Arbitrum
  const [destChainId, setDestChainId] = useState(HUB_CHAIN_ID); // Sonic
  const [selectedToken, setSelectedToken] = useState("ETH");
  const [amount, setAmount] = useState("");
  
  // Determine direction
  const bridgeToHub = destChainId === HUB_CHAIN_ID;
  const bridgeFromHub = sourceChainId === HUB_CHAIN_ID;
  
  // Handle chain changes - ensure one is always Hub
  const handleSourceChainChange = (chainId: number) => {
    setSourceChainId(chainId);
    if (chainId !== HUB_CHAIN_ID && destChainId !== HUB_CHAIN_ID) {
      setDestChainId(HUB_CHAIN_ID);
    }
  };
  
  const handleDestChainChange = (chainId: number) => {
    setDestChainId(chainId);
    if (chainId !== HUB_CHAIN_ID && sourceChainId !== HUB_CHAIN_ID) {
      setSourceChainId(HUB_CHAIN_ID);
    }
  };
  
  const handleSwapChains = () => {
    const temp = sourceChainId;
    setSourceChainId(destChainId);
    setDestChainId(temp);
  };

  // Get tokens for source chain
  const sourceTokens = useMemo(() => getTokensForChain(sourceChainId), [sourceChainId]);
  
  // Update token when source chain changes
  useEffect(() => {
    const tokens = getTokensForChain(sourceChainId);
    if (tokens.length > 0 && !tokens.find(t => t.symbol === selectedToken)) {
      setSelectedToken(tokens[0].symbol);
    }
  }, [sourceChainId, selectedToken]);

  // Balances
  const { balances: sourceBalances, refetch: refetchBalances } = useAllTokenBalances(sourceChainId);
  
  // Approval
  const sourceConfig = getChainConfig(sourceChainId);
  const spenderAddress = bridgeToHub 
    ? ((sourceConfig?.contracts as Record<string, string>)?.gatewayVault as `0x${string}` | undefined)
    : undefined;
  
  const approval = useTokenApproval({
    tokenSymbol: selectedToken,
    amount: amount,
    chainId: sourceChainId,
    spenderAddress: spenderAddress,
  });
  
  // Bridge transaction
  const { bridgeToHub: bridgeToHubFn, bridgeFromHub: bridgeFromHubFn, isLoading: isBridging } = useBridgeTransaction();
  
  // Gateway balance (for bridging from Hub)
  const gatewayBalance = useGatewayBalance(destChainId, selectedToken);
  
  // Auto-switch chain
  useEffect(() => {
    if (isConnected && switchChain && chain?.id !== sourceChainId) {
      switchChain({ chainId: sourceChainId });
    }
  }, [isConnected, switchChain, chain?.id, sourceChainId]);

  // Receive amount (1:1)
  const receiveAmount = parseFloat(amount) || 0;
  const receiveToken = bridgeToHub ? "s" + selectedToken : selectedToken.replace(/^s/, "");

  // Button state - checks allowance reactively as user types
  const getButtonState = () => {
    if (!isConnected) return { text: "Connect Wallet", disabled: true };
    if (!amount || parseFloat(amount) <= 0) return { text: "Enter amount", disabled: true };
    
    const balance = sourceBalances[selectedToken];
    if (balance && parseFloat(amount) > parseFloat(balance.balanceRaw || "0")) {
      return { text: "Insufficient balance", disabled: true };
    }
    
    // For bridge to hub (non-native tokens), check allowance
    if (bridgeToHub && selectedToken !== "ETH" && selectedToken !== "S") {
      // Show loading state while checking allowance (prevents race condition)
      if (approval.isCheckingAllowance) {
        return { text: "Checking allowance...", disabled: true };
      }
      // If amount exceeds allowance, show Approve button
      if (approval.needsApproval) {
        return { text: `Approve ${selectedToken}`, disabled: false, action: "approve" };
      }
    }
    
    if (approval.isApproving) return { text: "Approving...", disabled: true };
    if (isBridging) return { text: "Bridging...", disabled: true };
    return { text: "Bridge", disabled: false, action: "bridge" };
  };

  const buttonState = getButtonState();

  const handleBridge = async () => {
    if (!isConnected || !address) return;
    try {
      if (bridgeToHub) {
        await bridgeToHubFn({
          sourceChainId,
          tokenSymbol: selectedToken,
          amount,
          receiverAddress: address as `0x${string}`,
        });
      } else {
        await bridgeFromHubFn({
          destChainId,
          tokenSymbol: selectedToken,
          amount,
          receiverAddress: address as `0x${string}`,
        });
      }
      // Clear amount after successful bridge
      setAmount("");
      
      // Refresh balances after a short delay to allow for block confirmation
      setTimeout(() => {
        refetchBalances();
      }, 2000);
      
      // Refresh again after longer delay for cross-chain updates
      setTimeout(() => {
        refetchBalances();
      }, 10000);
    } catch (error) {
      console.error("Bridge failed:", error);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />

      <main className="pt-32 pb-12 px-4">
        <div className="max-w-md mx-auto">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-xl font-semibold text-white">Bridge</h1>
          </div>

          {/* Chain Selectors */}
          <div className="flex items-end gap-4 mb-8">
            <ChainDropdown
              selectedChainId={sourceChainId}
              onChange={handleSourceChainChange}
              availableChains={DEPLOYED_CHAIN_IDS}
              label="From"
            />
            
            <button 
              onClick={handleSwapChains}
              className="mb-1 p-2 rounded-full bg-zinc-100 transition-all hover:bg-zinc-200"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#18181b" strokeWidth="2">
                <path d="M7 16V4M7 4L3 8M7 4l4 4M17 8v12M17 20l4-4M17 20l-4-4" />
              </svg>
            </button>
            
            <ChainDropdown
              selectedChainId={destChainId}
              onChange={handleDestChainChange}
              availableChains={DEPLOYED_CHAIN_IDS}
              label="To"
            />
          </div>
          
          {/* Hub indicator */}
          <div className="mb-6 text-xs text-center" style={{ color: "#6B7280" }}>
            {bridgeToHub ? (
              <span>Bridging to <span style={{ color: "#19E68C" }}>Sonic Hub</span></span>
            ) : bridgeFromHub ? (
              <span>Bridging from <span style={{ color: "#19E68C" }}>Sonic Hub</span></span>
            ) : null}
          </div>

          {/* You Send */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">You send</span>
              <span className="text-sm text-gray-500">
                Balance: {sourceBalances[selectedToken]?.balanceFormatted || "0.00"}
              </span>
            </div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-700">
              <TokenSelector
                selected={selectedToken}
                onChange={setSelectedToken}
                tokens={sourceTokens}
                chainId={sourceChainId}
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  className="bg-transparent text-right text-xl font-medium text-white focus:outline-none w-32"
                />
                <button 
                  onClick={() => setAmount(sourceBalances[selectedToken]?.balanceRaw || "0")}
                  className="px-2 py-1 text-xs font-medium rounded bg-gray-800 text-gray-400 hover:bg-gray-700 transition-all"
                >
                  MAX
                </button>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center mb-6">
            <div className="p-2 rounded-full bg-zinc-100">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#18181b" strokeWidth="2">
                <path d="M12 5v14M19 12l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* You Receive */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">You receive</span>
              <span className="text-sm" style={{ color: "#10B981" }}>1:1</span>
            </div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-700">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg">
                <div className="w-5 h-5 rounded-full overflow-hidden bg-gray-700">
                  <Image src={getTokenLogoBySymbol(receiveToken)} alt="" width={20} height={20} className="w-full h-full object-cover" />
                </div>
                <span className="font-medium text-sm text-white">{receiveToken}</span>
              </div>
              <span className="text-xl font-medium text-white">
                {receiveAmount.toFixed(4) || "0.0"}
              </span>
            </div>
          </div>

          {/* Bridge Info */}
          <div className="mb-8 p-4 rounded-lg border" style={{ borderColor: "#1f1f1f" }}>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-500">Protocol Fee</span>
              <span style={{ color: "#10B981" }}>Free (1:1)</span>
            </div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-500">Estimated Time</span>
              <span className="text-white">~2 minutes</span>
            </div>
            {/* Allowance indicator for bridge to hub */}
            {bridgeToHub && selectedToken !== "ETH" && selectedToken !== "S" && amount && parseFloat(amount) > 0 && (
              <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-800">
                <span className="text-gray-500">Allowance</span>
                {approval.isCheckingAllowance ? (
                  <span className="text-gray-400">Checking...</span>
                ) : approval.needsApproval ? (
                  <span className="text-amber-400">
                    Approval needed
                  </span>
                ) : (
                  <span style={{ color: "#10B981" }}>✓ Approved</span>
                )}
              </div>
            )}
            {/* Available liquidity for bridge from Hub */}
            {bridgeFromHub && !gatewayBalance.error && (
              <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-800">
                <span className="text-gray-500">Available on {CHAIN_DISPLAY[destChainId]?.name}</span>
                {gatewayBalance.isLoading ? (
                  <span className="text-gray-400">Loading...</span>
                ) : (
                  <span className="text-white">
                    {gatewayBalance.balanceFormatted} {gatewayBalance.nativeSymbol || receiveToken}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Bridge Button */}
          <button
            onClick={() => {
              if (buttonState.action === "approve") approval.approve();
              else if (buttonState.action === "bridge") handleBridge();
            }}
            disabled={buttonState.disabled}
            className={`w-full py-4 rounded-xl font-semibold transition-all ${
              buttonState.disabled 
                ? "bg-zinc-800 text-zinc-500 opacity-40" 
                : "bg-zinc-100 text-zinc-900 hover:bg-white"
            }`}
          >
            {buttonState.text}
          </button>

        </div>
      </main>
    </div>
  );
}
