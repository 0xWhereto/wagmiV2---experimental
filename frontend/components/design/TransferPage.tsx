"use client";

import { useState, useEffect, useMemo } from 'react';
import { ArrowDown, ArrowLeftRight } from 'lucide-react';
import { TokenInput } from './TokenInput';
import { ChainSelector } from './ChainSelector';
import { motion } from 'framer-motion';
import { useAccount, useSwitchChain } from 'wagmi';
import { useAllTokenBalances } from '@/hooks/useTokenBalances';
import { useBridgeTransaction } from '@/hooks/useBridgeTransaction';
import { useTokenApproval } from '@/hooks/useTokenApproval';
import { useGatewayBalance } from '@/hooks/useGatewayBalance';
import { getTokensForChain } from '@/lib/tokens/tokenList';
import { getTokenLogoBySymbol } from '@/lib/tokens/logos';
import { getChainConfig } from '@/lib/contracts/config';
import Image from 'next/image';

// Hub chain (Sonic) - always one side of the transfer
const HUB_CHAIN = { id: 146, name: 'Sonic' };

// Available chains (excluding Hub - these are the selectable options)
const AVAILABLE_CHAINS = [
  { id: 42161, name: 'Arbitrum' },
  { id: 8453, name: 'Base' },
  { id: 1, name: 'Ethereum' },
];

// Mock prices
const TOKEN_PRICES: Record<string, number> = {
  ETH: 3370, WETH: 3370, USDC: 1, USDT: 1, DAI: 1, WBTC: 95000,
  S: 0.5, WAGMI: 0.85, sWETH: 3370, sUSDC: 1, sUSDT: 1, sDAI: 1,
};

const getTokenPrice = (symbol: string) => TOKEN_PRICES[symbol] || 0;

interface TokenWithBalance {
  symbol: string;
  name: string;
  balance: string;      // Formatted balance for display
  balanceRaw?: string;  // Full precision balance for MAX button / contract calls
  address?: string;
  decimals?: number;
}

export function TransferPage() {
  const { address, isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();

  // Direction: 'toHub' means transferring TO Sonic, 'fromHub' means transferring FROM Sonic
  const [direction, setDirection] = useState<'toHub' | 'fromHub'>('toHub');
  const [selectedChain, setSelectedChain] = useState(AVAILABLE_CHAINS[0]); // Non-hub chain
  const [amount, setAmount] = useState('');
  const [receiverAddress, setReceiverAddress] = useState('');

  // Derived from direction
  const fromChain = direction === 'toHub' ? selectedChain : HUB_CHAIN;
  const toChain = direction === 'toHub' ? HUB_CHAIN : selectedChain;

  // Get tokens for source chain
  const sourceTokens = useMemo(() => getTokensForChain(fromChain.id), [fromChain.id]);
  const { balances, refetch: refetchBalances } = useAllTokenBalances(fromChain.id);

  // Convert tokens to format with balances (include balanceRaw for MAX button)
  const tokensWithBalances = useMemo(() => {
    return sourceTokens.map((token) => ({
      ...token,
      balance: balances[token.symbol]?.balanceFormatted || '0.00',
      balanceRaw: balances[token.symbol]?.balanceRaw || '0', // Full precision for MAX
    }));
  }, [sourceTokens, balances]);

  const [selectedToken, setSelectedToken] = useState<TokenWithBalance>(
    tokensWithBalances[0] || { symbol: 'WETH', name: 'Wrapped Ether', balance: '0.00', decimals: 18 }
  );

  // Reset selected token when source chain changes (direction or selectedChain)
  useEffect(() => {
    if (tokensWithBalances.length > 0) {
      // Check if current token exists on the new chain
      const existsOnNewChain = tokensWithBalances.find(t => t.symbol === selectedToken.symbol);
      if (!existsOnNewChain) {
        // Token doesn't exist on new chain, select the first available token
        console.log('Chain changed, resetting token to:', tokensWithBalances[0].symbol);
        setSelectedToken(tokensWithBalances[0]);
      } else {
        // Token exists, just update the balance
        setSelectedToken(existsOnNewChain);
      }
    }
  }, [fromChain.id]); // Only trigger when source chain changes
  
  // Update selected token balance when balances change
  useEffect(() => {
    if (tokensWithBalances.length > 0 && selectedToken) {
      const updated = tokensWithBalances.find(t => t.symbol === selectedToken.symbol);
      if (updated && (updated.balance !== selectedToken.balance || updated.balanceRaw !== selectedToken.balanceRaw)) {
        setSelectedToken(prev => ({
          ...prev,
          balance: updated.balance,
          balanceRaw: updated.balanceRaw,
        }));
      }
    }
  }, [balances]); // Only trigger when balances change, not tokensWithBalances
  
  // Handle token change from dropdown
  const handleTokenChange = (token: TokenWithBalance) => {
    console.log('Token changed to:', token.symbol);
    setSelectedToken(token);
  };

  // Bridge transaction hook
  const { bridgeToHub, bridgeFromHub, isLoading: isBridging } = useBridgeTransaction();

  // Approval hook - for bridge TO hub (locking tokens in gateway)
  const sourceConfig = getChainConfig(fromChain.id);
  const spenderAddress = direction === 'toHub' 
    ? ((sourceConfig?.contracts as Record<string, string>)?.gatewayVault as `0x${string}` | undefined)
    : undefined;
  
  const approval = useTokenApproval({
    tokenSymbol: selectedToken.symbol,
    amount: amount,
    chainId: fromChain.id,
    spenderAddress: spenderAddress,
  });

  // Gateway balance - show available liquidity when bridging FROM Hub
  const gatewayBalance = useGatewayBalance(toChain.id, selectedToken.symbol);

  const handleSwapDirection = () => {
    setDirection(direction === 'toHub' ? 'fromHub' : 'toHub');
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
  };

  const handleTransfer = async () => {
    if (!isConnected || !amount || parseFloat(amount) === 0) return;

    const targetChainId = direction === 'toHub' ? selectedChain.id : HUB_CHAIN.id;

    // Switch chain if needed
    if (chain?.id !== targetChainId) {
      switchChain?.({ chainId: targetChainId });
      return;
    }

    const receiver = (receiverAddress || address || '0x') as `0x${string}`;

    try {
      if (direction === 'toHub') {
        await bridgeToHub({
          sourceChainId: selectedChain.id,
          tokenSymbol: selectedToken.symbol,
          amount: amount,
          receiverAddress: receiver,
        });
      } else {
        await bridgeFromHub({
          destChainId: selectedChain.id,
          tokenSymbol: selectedToken.symbol,
          amount: amount,
          receiverAddress: receiver,
        });
      }

      // Clear amount after successful transfer
      setAmount('');
      
      // Refresh balances after a short delay to allow for block confirmation
      setTimeout(() => {
        refetchBalances();
      }, 2000);
      
      // Refresh again after longer delay for cross-chain updates
      setTimeout(() => {
        refetchBalances();
      }, 10000);
    } catch (error) {
      // Error is handled by the hook, just log it
      console.error('Transfer failed:', error);
    }
  };

  // Check if native token (no approval needed)
  const isNativeToken = selectedToken.symbol === 'ETH' || selectedToken.symbol === 'S';

  const getButtonState = () => {
    if (!isConnected) return { text: 'Connect Wallet', disabled: true, action: 'none' };
    if (!amount || parseFloat(amount) === 0) return { text: 'Enter amount', disabled: true, action: 'none' };

    const targetChainId = direction === 'toHub' ? selectedChain.id : HUB_CHAIN.id;
    const targetChainName = direction === 'toHub' ? selectedChain.name : 'Sonic';

    if (chain?.id !== targetChainId) return { text: `Switch to ${targetChainName}`, disabled: false, action: 'switch' };
    
    // For bridge to hub (non-native tokens), check allowance
    if (direction === 'toHub' && !isNativeToken) {
      if (approval.isCheckingAllowance) {
        return { text: 'Checking allowance...', disabled: true, action: 'none' };
      }
      if (approval.needsApproval) {
        return { text: `Approve ${selectedToken.symbol}`, disabled: false, action: 'approve' };
      }
    }
    
    if (approval.isApproving) return { text: 'Approving...', disabled: true, action: 'none' };
    if (isBridging) return { text: 'Transferring...', disabled: true, action: 'none' };
    return { text: 'Transfer', disabled: false, action: 'transfer' };
  };

  const buttonState = getButtonState();

  const usdValue = useMemo(() => {
    const price = getTokenPrice(selectedToken.symbol);
    const amountNum = parseFloat(amount || '0');
    return `≈ $${(amountNum * price).toFixed(2)}`;
  }, [amount, selectedToken.symbol]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Transfer Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="w-full max-w-md">
            <div className="p-6">
              <div className="mb-6">
                <h2 className="text-zinc-100">Transfer</h2>
              </div>

              {/* Chain selection */}
              <div className="mb-6">
                <div className="flex items-center gap-3">
                  {/* From Chain - Dropdown if toHub, Fixed if fromHub */}
                  {direction === 'toHub' ? (
                    <ChainSelector
                      label="From"
                      selectedChain={selectedChain}
                      chains={AVAILABLE_CHAINS}
                      onSelect={setSelectedChain}
                    />
                  ) : (
                    <div className="flex-1">
                      <div className="text-zinc-500 mb-2">From</div>
                      <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900/50 rounded-lg">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600" />
                        <span className="text-zinc-100">{HUB_CHAIN.name}</span>
                        <span className="text-zinc-500 text-xs ml-auto">Hub</span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleSwapDirection}
                    className="mt-7 p-2 hover:bg-zinc-800/50 rounded-lg transition-colors"
                  >
                    <ArrowLeftRight className="w-4 h-4 text-zinc-400" />
                  </button>

                  {/* To Chain - Fixed if toHub, Dropdown if fromHub */}
                  {direction === 'toHub' ? (
                    <div className="flex-1">
                      <div className="text-zinc-500 mb-2">To</div>
                      <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900/50 rounded-lg">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600" />
                        <span className="text-zinc-100">{HUB_CHAIN.name}</span>
                        <span className="text-zinc-500 text-xs ml-auto">Hub</span>
                      </div>
                    </div>
                  ) : (
                    <ChainSelector
                      label="To"
                      selectedChain={selectedChain}
                      chains={AVAILABLE_CHAINS}
                      onSelect={setSelectedChain}
                    />
                  )}
                </div>
              </div>

              {/* Receiver address */}
              <div className="mb-6">
                <div className="flex items-center gap-4 border-b border-zinc-800 pb-2">
                  <label className="text-zinc-500 whitespace-nowrap">Receiver</label>
                  <input
                    type="text"
                    value={receiverAddress}
                    onChange={(e) => setReceiverAddress(e.target.value)}
                    placeholder={address || "0x..."}
                    className="flex-1 bg-transparent text-zinc-100 placeholder:text-zinc-600 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <TokenInput
                  label="You send"
                  token={selectedToken}
                  amount={amount}
                  onAmountChange={handleAmountChange}
                  tokens={tokensWithBalances}
                  onTokenChange={handleTokenChange}
                  usdValue={usdValue}
                />

                <div className="relative flex justify-center py-2">
                  <motion.div
                    className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center z-10"
                  >
                    <ArrowDown className="w-5 h-5 text-zinc-400" />
                  </motion.div>
                </div>

                {/* You receive - static display, same token as sending */}
                <div className="py-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-zinc-500">You receive</span>
                    <span className="text-zinc-500">On {toChain.name}</span>
                  </div>

                  <div className="flex items-center gap-3 pb-3 border-b border-zinc-700">
                    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg">
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-gradient-to-br from-zinc-400 to-zinc-500">
                        <Image 
                          src={getTokenLogoBySymbol(selectedToken.symbol)}
                          alt={selectedToken.symbol}
                          width={24}
                          height={24}
                          className="w-full h-full object-cover token-icon"
                        />
                      </div>
                      <span className="text-zinc-100">{selectedToken.symbol}</span>
                    </div>

                    <input
                      type="text"
                      value={amount}
                      readOnly
                      placeholder="0.0"
                      className="flex-1 bg-transparent text-zinc-100 text-right outline-none placeholder:text-zinc-700"
                    />
                  </div>

                  {amount && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-2 text-right text-zinc-600"
                    >
                      {usdValue}
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Transfer Info */}
              {amount && parseFloat(amount) > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 p-3 bg-zinc-800/20 rounded-lg space-y-2"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Route</span>
                    <span className="text-zinc-300">{fromChain.name} → Sonic Hub → {toChain.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Estimated time</span>
                    <span className="text-zinc-300">~2-5 minutes</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Bridge fee</span>
                    <span className="text-zinc-300">~$0.50</span>
                  </div>
                  {/* Allowance indicator for bridge to hub */}
                  {direction === 'toHub' && !isNativeToken && (
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-zinc-700/50">
                      <span className="text-zinc-500">Allowance</span>
                      {approval.isCheckingAllowance ? (
                        <span className="text-zinc-400">Checking...</span>
                      ) : approval.needsApproval ? (
                        <span className="text-amber-400">Approval needed</span>
                      ) : (
                        <span className="text-emerald-400">✓ Approved</span>
                      )}
                    </div>
                  )}
                  {/* Available liquidity on gateway for bridge FROM hub */}
                  {direction === 'fromHub' && !gatewayBalance.error && (
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-zinc-700/50">
                      <span className="text-zinc-500">Available on {toChain.name}</span>
                      {gatewayBalance.isLoading ? (
                        <span className="text-zinc-400">Loading...</span>
                      ) : (
                        <span className="text-zinc-300">
                          {gatewayBalance.balanceFormatted} {gatewayBalance.nativeSymbol}
                        </span>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                disabled={buttonState.disabled}
                onClick={() => {
                  if (buttonState.action === 'approve') {
                    approval.approve();
                  } else if (buttonState.action === 'switch') {
                    const targetChainId = direction === 'toHub' ? selectedChain.id : HUB_CHAIN.id;
                    switchChain?.({ chainId: targetChainId });
                  } else if (buttonState.action === 'transfer') {
                    handleTransfer();
                  }
                }}
                className="w-full mt-6 py-4 bg-zinc-100 hover:bg-white text-zinc-950 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg"
              >
                {buttonState.text}
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Info Section */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="space-y-6"
        >
          <div className="p-6">
            <h3 className="text-zinc-100 text-xl mb-4">Cross-Chain Bridge</h3>
            <p className="text-zinc-500 mb-6">
              Transfer assets between chains seamlessly via Sonic Hub. All transfers are secured by LayerZero cross-chain messaging.
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 flex-shrink-0">
                  1
                </div>
                <div>
                  <div className="text-zinc-300">Select chains</div>
                  <div className="text-zinc-600 text-sm">Choose source and destination chains</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 flex-shrink-0">
                  2
                </div>
                <div>
                  <div className="text-zinc-300">Enter amount</div>
                  <div className="text-zinc-600 text-sm">Specify how much to transfer</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 flex-shrink-0">
                  3
                </div>
                <div>
                  <div className="text-zinc-300">Confirm transfer</div>
                  <div className="text-zinc-600 text-sm">Approve and execute the bridge</div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-zinc-900/30 rounded-xl">
            <h4 className="text-zinc-300 mb-2">Supported Chains</h4>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-zinc-700/50 text-zinc-300 rounded-lg text-sm border border-zinc-600">
                {HUB_CHAIN.name} (Hub)
              </span>
              {AVAILABLE_CHAINS.map((c) => (
                <span key={c.id} className="px-3 py-1 bg-zinc-800/50 text-zinc-400 rounded-lg text-sm">
                  {c.name}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
