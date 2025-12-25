"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowDown, Settings2, Info, ArrowLeftRight, Plus, X } from 'lucide-react';
import { TokenInput } from './TokenInput';
import { ChainSelector } from './ChainSelector';
import { SwapDetails } from './SwapDetails';
import { motion } from 'framer-motion';
import { useAccount, useSwitchChain } from 'wagmi';
import { parseUnits } from 'viem';
import { useAllTokenBalances } from '@/hooks/useTokenBalances';
import { useTokenApproval } from '@/hooks/useTokenApproval';
import { useSwapTransaction, useSwapQuote, useBridgeTransaction } from '@/hooks/useBridgeTransaction';
import { getTokensForChain, type Token } from '@/lib/tokens/tokenList';
import { CHAIN_CONFIG, getChainConfig } from '@/lib/contracts/config';

// Hub chain ID (Sonic)
const HUB_CHAIN_ID = 146;

// Available chains
const AVAILABLE_CHAINS = [
  { id: 146, name: 'Sonic' },
  { id: 42161, name: 'Arbitrum' },
  { id: 8453, name: 'Base' },
  { id: 1, name: 'Ethereum' },
];

// Mock prices
const TOKEN_PRICES: Record<string, number> = {
  ETH: 3370, WETH: 3370, USDC: 1, USDT: 1, DAI: 1, WBTC: 95000,
  S: 0.5, WAGMI: 0.85, sWETH: 3370, sUSDC: 1, sUSDT: 1, sDAI: 1,
  MIM: 1, sMIM: 1, sWBTC: 95000,
};

const getTokenPrice = (symbol: string) => TOKEN_PRICES[symbol] || 0;

interface TokenWithBalance {
  symbol: string;
  name: string;
  balance: string;
  balanceRaw?: string;  // Full precision balance for MAX button
  address?: string;
  decimals?: number;
}

interface SwapCardProps {
  onTokensChange?: (fromSymbol: string, toSymbol: string) => void;
}

export function SwapCard({ onTokensChange }: SwapCardProps = {}) {
  const { address, isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();

  const [swapMode, setSwapMode] = useState<'cross-chain' | 'wagmi'>('cross-chain');
  const [fromChain, setFromChain] = useState(AVAILABLE_CHAINS[1]); // Arbitrum
  const [toChain, setToChain] = useState(AVAILABLE_CHAINS[0]); // Sonic
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [receiverAddress, setReceiverAddress] = useState('');
  
  // Additional tokens for multi-token swap
  const [additionalFromTokens, setAdditionalFromTokens] = useState<Array<{
    token: TokenWithBalance;
    amount: string;
  }>>([]);

  // Get tokens for current chain
  const sourceChainId = swapMode === 'cross-chain' ? fromChain.id : HUB_CHAIN_ID;
  const sourceTokens = useMemo(() => getTokensForChain(sourceChainId), [sourceChainId]);
  const hubTokens = useMemo(() => getTokensForChain(HUB_CHAIN_ID), []);

  // Balances - refetch when chain or account changes
  const { balances: sourceBalances, isLoading: sourceLoading, refetch: refetchSource } = useAllTokenBalances(sourceChainId);
  const { balances: hubBalances, isLoading: hubLoading, refetch: refetchHub } = useAllTokenBalances(HUB_CHAIN_ID);

  // Refetch balances when account or chain changes
  useEffect(() => {
    if (isConnected && address) {
      refetchSource();
      refetchHub();
    }
  }, [isConnected, address, chain?.id]);

  // Determine if bridging to or from Hub
  const isBridgingToHub = swapMode === 'cross-chain' && fromChain.id !== HUB_CHAIN_ID && toChain.id === HUB_CHAIN_ID;
  const isBridgingFromHub = swapMode === 'cross-chain' && fromChain.id === HUB_CHAIN_ID && toChain.id !== HUB_CHAIN_ID;

  // Convert tokens to format with balances - separate lists for "from" and "to"
  const fromTokensWithBalances = useMemo(() => {
    if (swapMode === 'cross-chain') {
      // Cross-chain: "from" tokens are from source chain
      return sourceTokens.map((token) => ({
        ...token,
        symbol: token.symbol,
        name: token.name,
        balance: sourceBalances[token.symbol]?.balanceFormatted || '0.00',
        balanceRaw: sourceBalances[token.symbol]?.balanceRaw || '0', // Full precision for MAX
        address: token.address,
        decimals: token.decimals,
      }));
    } else {
      // Wagmi swap: both from Hub chain
      return hubTokens.map((token) => ({
        ...token,
        symbol: token.symbol,
        name: token.name,
        balance: hubBalances[token.symbol]?.balanceFormatted || '0.00',
        balanceRaw: hubBalances[token.symbol]?.balanceRaw || '0', // Full precision for MAX
        address: token.address,
        decimals: token.decimals,
      }));
    }
  }, [swapMode, sourceBalances, hubBalances, sourceTokens, hubTokens]);

  const toTokensWithBalances = useMemo(() => {
    if (swapMode === 'cross-chain') {
      // Cross-chain bridging TO Hub: show only synthetic tokens (starting with 's')
      if (isBridgingToHub) {
        const syntheticTokens = hubTokens.filter(t => t.symbol.startsWith('s') || t.symbol === 'S');
        return syntheticTokens.map((token) => ({
          ...token,
          symbol: token.symbol,
          name: token.name,
          balance: hubBalances[token.symbol]?.balanceFormatted || '0.00',
          balanceRaw: hubBalances[token.symbol]?.balanceRaw || '0',
          address: token.address,
          decimals: token.decimals,
        }));
      }
      // Cross-chain bridging FROM Hub: show destination chain tokens
      if (isBridgingFromHub) {
        const destTokens = getTokensForChain(toChain.id);
        // We don't have balances for destination chain, show 0
        return destTokens.map((token) => ({
          ...token,
          symbol: token.symbol,
          name: token.name,
          balance: '0.00',
          balanceRaw: '0',
          address: token.address,
          decimals: token.decimals,
        }));
      }
    }
    // Wagmi swap: both from Hub chain
    return hubTokens.map((token) => ({
      ...token,
      symbol: token.symbol,
      name: token.name,
      balance: hubBalances[token.symbol]?.balanceFormatted || '0.00',
      balanceRaw: hubBalances[token.symbol]?.balanceRaw || '0',
      address: token.address,
      decimals: token.decimals,
    }));
  }, [swapMode, isBridgingToHub, isBridgingFromHub, hubBalances, hubTokens, toChain.id]);

  // For backward compatibility
  const tokensWithBalances = fromTokensWithBalances;

  const defaultToken: TokenWithBalance = { symbol: 'WETH', name: 'Wrapped Ether', balance: '0.00', decimals: 18 };
  const [fromToken, setFromToken] = useState<TokenWithBalance>(defaultToken);
  const [toToken, setToToken] = useState<TokenWithBalance>({ symbol: 'sUSDT', name: 'Synthetic USDT', balance: '0.00', decimals: 6 });

  // Update tokens ONLY when swap mode or chain changes (not on every balance update)
  const prevSwapModeRef = useRef(swapMode);
  const prevFromChainRef = useRef(fromChain.id);
  const prevToChainRef = useRef(toChain.id);
  
  useEffect(() => {
    const modeChanged = prevSwapModeRef.current !== swapMode;
    const fromChainChanged = prevFromChainRef.current !== fromChain.id;
    const toChainChanged = prevToChainRef.current !== toChain.id;
    
    prevSwapModeRef.current = swapMode;
    prevFromChainRef.current = fromChain.id;
    prevToChainRef.current = toChain.id;
    
    // Only reset tokens if mode or chain actually changed
    if (modeChanged || fromChainChanged) {
      if (fromTokensWithBalances.length > 0) {
        const currentFrom = fromTokensWithBalances.find(t => t.symbol === fromToken.symbol);
        if (!currentFrom) {
          setFromToken(fromTokensWithBalances[0]);
        }
      }
    }
    
    if (modeChanged || toChainChanged) {
      if (toTokensWithBalances.length > 0) {
        const currentTo = toTokensWithBalances.find(t => t.symbol === toToken.symbol);
        if (!currentTo) {
          setToToken(toTokensWithBalances[0]);
        }
      }
    }
  }, [swapMode, fromChain.id, toChain.id, fromTokensWithBalances, toTokensWithBalances]);

  // Notify parent of token changes for chart (use first input token only)
  // Note: intentionally not including onTokensChange in deps to avoid infinite loops
  useEffect(() => {
    onTokensChange?.(fromToken.symbol, toToken.symbol);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromToken.symbol, toToken.symbol]);

  // Swap quote for Wagmi Swap mode
  const swapRouterAddress = useMemo(() => {
    const chainConfig = getChainConfig(HUB_CHAIN_ID);
    return (chainConfig?.contracts as Record<string, string>)?.swapRouter as `0x${string}` || '0x0000000000000000000000000000000000000000';
  }, []);

  // Safe parseUnits helper
  const safeParseUnits = (value: string, decimals: number): bigint => {
    try {
      if (!value || parseFloat(value) <= 0) return BigInt(0);
      return parseUnits(value, decimals);
    } catch {
      return BigInt(0);
    }
  };

  const { 
    amountOut: swapQuoteAmount, 
    priceImpact, 
    isLoading: isQuoteLoading,
    poolExists,
    hasLiquidity,
    fee: quotedFee,
  } = useSwapQuote({
    chainId: HUB_CHAIN_ID,
    tokenIn: swapMode === 'wagmi' ? fromToken.symbol : '',
    tokenOut: swapMode === 'wagmi' ? toToken.symbol : '',
    amountIn: fromAmount && parseFloat(fromAmount) > 0 ? fromAmount : '0',
  });

  // Token approval
  const {
    needsApproval,
    isApproving,
    approve,
  } = useTokenApproval({
    tokenSymbol: fromToken.symbol || 'WETH',
    amount: fromAmount || '0',
    chainId: HUB_CHAIN_ID,
    spenderAddress: swapRouterAddress,
  });

  // Swap transaction
  const { executeSwap, isLoading: isSwapping } = useSwapTransaction();

  // Bridge transaction (for cross-chain)
  const { bridgeToHub, bridgeFromHub, isLoading: isBridging } = useBridgeTransaction();

  // Update toAmount when quote changes
  useEffect(() => {
    if (swapMode === 'wagmi' && swapQuoteAmount && parseFloat(swapQuoteAmount) > 0) {
      setToAmount(parseFloat(swapQuoteAmount).toFixed(6));
    }
  }, [swapQuoteAmount, swapMode]);

  const handleSwapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    const tempAmount = fromAmount;
    setFromAmount(toAmount);
    setToAmount(tempAmount);
  };

  const handleSwapChains = () => {
    const temp = fromChain;
    setFromChain(toChain);
    setToChain(temp);
  };

  const handleFromAmountChange = (value: string) => {
    setFromAmount(value);
    if (!value || parseFloat(value) === 0) {
      setToAmount('');
    }
    // For cross-chain, use mock rate
    if (swapMode === 'cross-chain' && value) {
      const fromPrice = getTokenPrice(fromToken.symbol);
      const toPrice = getTokenPrice(toToken.symbol);
      if (fromPrice && toPrice) {
        const usdValue = parseFloat(value) * fromPrice;
        const toValue = usdValue / toPrice;
        setToAmount(toValue.toFixed(6));
      }
    }
  };

  const handleSwap = async () => {
    if (!isConnected || !fromAmount || !fromToken.address) return;

    if (swapMode === 'wagmi') {
      // Wagmi Swap on Hub chain
      if (chain?.id !== HUB_CHAIN_ID) {
        switchChain?.({ chainId: HUB_CHAIN_ID });
        return;
      }

      if (needsApproval) {
        await approve();
        return;
      }

      const slippage = 0.5;
      const amountOutFloat = parseFloat(swapQuoteAmount || '0');
      const minAmountOut = (amountOutFloat * (100 - slippage) / 100).toString();

      await executeSwap({
        chainId: HUB_CHAIN_ID,
        tokenIn: fromToken.symbol,
        tokenOut: toToken.symbol,
        amountIn: fromAmount,
        amountOutMin: minAmountOut,
        receiverAddress: address as `0x${string}`,
        fee: quotedFee || 3000,
      });
    } else {
      // Cross-chain bridge
      const isToHub = toChain.id === HUB_CHAIN_ID;
      const targetChainId = isToHub ? fromChain.id : HUB_CHAIN_ID;
      
      if (chain?.id !== targetChainId) {
        switchChain?.({ chainId: targetChainId });
        return;
      }

      if (isToHub) {
        // Bridge TO Hub (Sonic)
        await bridgeToHub({
          sourceChainId: fromChain.id,
          tokenSymbol: fromToken.symbol,
          amount: fromAmount,
          receiverAddress: (receiverAddress || address || '0x0000000000000000000000000000000000000000') as `0x${string}`,
        });
      } else {
        // Bridge FROM Hub (Sonic) to another chain
        await bridgeFromHub({
          destChainId: toChain.id,
          tokenSymbol: fromToken.symbol,
          amount: fromAmount,
          receiverAddress: (receiverAddress || address || '0x0000000000000000000000000000000000000000') as `0x${string}`,
        });
      }
    }
  };

  const getButtonText = () => {
    if (!isConnected) return 'Connect Wallet';
    if (!fromAmount) return 'Enter amount';
    
    if (swapMode === 'wagmi') {
      if (chain?.id !== HUB_CHAIN_ID) return 'Switch to Sonic';
      if (isQuoteLoading) return 'Getting quote...';
      if (!poolExists) return 'Pool does not exist';
      if (!hasLiquidity) return 'Insufficient liquidity';
      if (needsApproval) {
        if (isApproving) return 'Approving...';
        return 'Approve ' + fromToken.symbol;
      }
      if (isSwapping) return 'Swapping...';
      return 'Swap';
    } else {
      const isToHub = toChain.id === HUB_CHAIN_ID;
      const targetChainId = isToHub ? fromChain.id : HUB_CHAIN_ID;
      const targetChainName = isToHub ? fromChain.name : 'Sonic';
      
      if (chain?.id !== targetChainId) return `Switch to ${targetChainName}`;
      if (isBridging) return 'Bridging...';
      return 'Bridge';
    }
  };

  const isButtonDisabled = () => {
    if (!isConnected) return true;
    if (!fromAmount || parseFloat(fromAmount) === 0) return true;
    if (swapMode === 'wagmi') {
      if (isQuoteLoading || isApproving || isSwapping) return true;
      if (!poolExists || !hasLiquidity) return true;
    } else {
      if (isBridging) return true;
    }
    return false;
  };

  const fromUsdValue = useMemo(() => {
    const price = getTokenPrice(fromToken.symbol);
    const amount = parseFloat(fromAmount || '0');
    return `≈ $${(amount * price).toFixed(2)}`;
  }, [fromAmount, fromToken.symbol]);

  const toUsdValue = useMemo(() => {
    const price = getTokenPrice(toToken.symbol);
    const amount = parseFloat(toAmount || '0');
    return `≈ $${(amount * price).toFixed(2)}`;
  }, [toAmount, toToken.symbol]);

  return (
    <div className="w-full max-w-md">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-zinc-100">Swap</h2>
          <button className="p-2 hover:bg-zinc-800/50 rounded-lg transition-colors group">
            <Settings2 className="w-5 h-5 text-zinc-400 group-hover:text-zinc-300 transition-colors" />
          </button>
        </div>

        {/* Swap mode tabs */}
        <div className="flex items-center gap-6 mb-6 border-b border-zinc-800 pb-4">
          <button
            onClick={() => setSwapMode('cross-chain')}
            className={`pb-2 transition-colors relative ${
              swapMode === 'cross-chain'
                ? 'text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Cross Chain
            {swapMode === 'cross-chain' && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-100"
              />
            )}
          </button>
          <button
            onClick={() => setSwapMode('wagmi')}
            className={`pb-2 transition-colors relative ${
              swapMode === 'wagmi'
                ? 'text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Wagmi Swap
            {swapMode === 'wagmi' && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-100"
              />
            )}
          </button>
        </div>

        {/* Chain selection */}
        {swapMode === 'cross-chain' && (
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <ChainSelector
                label="From"
                selectedChain={fromChain}
                chains={AVAILABLE_CHAINS}
                onSelect={setFromChain}
              />

              <button
                onClick={handleSwapChains}
                className="mt-7 p-2 hover:bg-zinc-800/50 rounded-lg transition-colors"
              >
                <ArrowLeftRight className="w-4 h-4 text-zinc-400" />
              </button>

              <ChainSelector
                label="To"
                selectedChain={toChain}
                chains={AVAILABLE_CHAINS}
                onSelect={setToChain}
              />
            </div>
          </div>
        )}

        {/* Receiver address */}
        {swapMode === 'cross-chain' && (
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
        )}

        <div className="space-y-1">
          <TokenInput
            label="You pay"
            token={fromToken}
            amount={fromAmount}
            onAmountChange={handleFromAmountChange}
            tokens={fromTokensWithBalances}
            onTokenChange={setFromToken}
            usdValue={fromUsdValue}
          />

          {/* Additional token inputs */}
          {additionalFromTokens.map((item, index) => (
            <div key={index} className="relative">
              <TokenInput
                label={`Token ${index + 2}`}
                token={item.token}
                amount={item.amount}
                onAmountChange={(value) => {
                  const updated = [...additionalFromTokens];
                  updated[index].amount = value;
                  setAdditionalFromTokens(updated);
                }}
                tokens={fromTokensWithBalances.filter(t => 
                  t.symbol !== fromToken.symbol && 
                  !additionalFromTokens.some((a, i) => i !== index && a.token.symbol === t.symbol)
                )}
                onTokenChange={(token) => {
                  const updated = [...additionalFromTokens];
                  updated[index].token = token;
                  setAdditionalFromTokens(updated);
                }}
                usdValue={`≈ $${(parseFloat(item.amount || '0') * getTokenPrice(item.token.symbol)).toFixed(2)}`}
              />
              {/* Remove button */}
              <button
                onClick={() => {
                  setAdditionalFromTokens(additionalFromTokens.filter((_, i) => i !== index));
                }}
                className="absolute top-4 right-0 p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          {/* Add token button */}
          <button
            onClick={() => {
              // Find a token that's not already selected
              const availableToken = fromTokensWithBalances.find(t => 
                t.symbol !== fromToken.symbol && 
                !additionalFromTokens.some(a => a.token.symbol === t.symbol)
              );
              if (availableToken) {
                setAdditionalFromTokens([...additionalFromTokens, { token: availableToken, amount: '' }]);
              }
            }}
            className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors py-2"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">Add another token</span>
          </button>

          <div className="relative flex justify-center py-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSwapTokens}
              className="w-10 h-10 bg-zinc-100 hover:bg-white rounded-xl flex items-center justify-center transition-colors z-10 shadow-lg"
            >
              <ArrowDown className="w-5 h-5 text-zinc-950" />
            </motion.button>
          </div>

          <TokenInput
            label="You receive"
            token={toToken}
            amount={toAmount}
            onAmountChange={setToAmount}
            tokens={toTokensWithBalances}
            onTokenChange={setToToken}
            readOnly
            usdValue={toUsdValue}
          />
        </div>

        {fromAmount && parseFloat(fromAmount) > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4"
          >
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-between p-3 hover:bg-zinc-800/30 rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-zinc-500" />
                <span className="text-zinc-400">
                  1 {fromToken.symbol} = {(getTokenPrice(toToken.symbol) > 0 ? (getTokenPrice(fromToken.symbol) / getTokenPrice(toToken.symbol)).toFixed(4) : '0.0000')} {toToken.symbol}
                </span>
              </div>
              <motion.div
                animate={{ rotate: showDetails ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ArrowDown className="w-4 h-4 text-zinc-500 group-hover:text-zinc-400" />
              </motion.div>
            </button>

            {showDetails && (
              <SwapDetails 
                priceImpact={priceImpact ? `${priceImpact.toFixed(2)}%` : '<0.01%'}
                priceImpactSubtext={priceImpact && priceImpact > 1 ? 'Moderate' : 'Minimal'}
                minimumReceived={`${parseFloat(toAmount || '0').toFixed(4)} ${toToken.symbol}`}
                lpFee={`${(parseFloat(fromAmount || '0') * 0.003).toFixed(4)} ${fromToken.symbol}`}
              />
            )}
          </motion.div>
        )}

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          disabled={isButtonDisabled()}
          onClick={handleSwap}
          className="w-full mt-6 py-4 bg-zinc-100 hover:bg-white text-zinc-950 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg"
        >
          {getButtonText()}
        </motion.button>
      </div>
    </div>
  );
}

