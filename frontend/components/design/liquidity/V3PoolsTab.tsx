"use client";

import { useState, useMemo, useEffect } from 'react';
import { Waves, TrendingUp, DollarSign, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PoolAnalytics } from './PoolAnalytics';
import Image from 'next/image';
import { useAccount } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { getTokenLogoBySymbol } from '@/lib/tokens/logos';
import { getTokensForChain, type Token } from '@/lib/tokens/tokenList';
import { useAllPools, type PoolData } from '@/lib/contracts/hooks/usePoolData';
import { 
  useLiquidity, 
  usePoolExists,
  usePoolInfo,
  FEE_TIERS,
  priceToTick,
  tickToPrice,
  nearestUsableTick,
  getTickSpacing,
  MIN_TICK,
  MAX_TICK,
} from '@/lib/contracts/hooks/useLiquidity';
import { useToast } from '@/components/Toast';
import { useAllTokenBalances } from '@/hooks/useTokenBalances';

const HUB_CHAIN_ID = 146;

// Format large numbers
function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

// Token Selector Modal
function TokenSelectorModal({
  isOpen,
  onClose,
  onSelect,
  tokens,
  excludeToken,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (symbol: string) => void;
  tokens: Token[];
  excludeToken?: string;
}) {
  const [search, setSearch] = useState('');
  const { balances } = useAllTokenBalances(HUB_CHAIN_ID);

  const filteredTokens = tokens
    .filter((t) => t.symbol !== excludeToken)
    .filter((t) =>
      t.symbol.toLowerCase().includes(search.toLowerCase()) ||
      t.name.toLowerCase().includes(search.toLowerCase())
    )
    .map((token) => ({
      ...token,
      balance: balances[token.symbol]?.balanceFormatted || '0.00',
    }));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm rounded-xl overflow-hidden"
        style={{ background: '#0f0f0f', border: '1px solid #1f1f1f' }}
      >
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-medium">Select Token</h3>
            <button onClick={onClose} className="text-zinc-500 hover:text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            className="w-full px-3 py-2 bg-zinc-900 text-white text-sm rounded-lg placeholder-zinc-500 focus:outline-none"
          />
        </div>
        <div className="max-h-64 overflow-y-auto">
          {filteredTokens.map((token) => (
            <button
              key={token.symbol}
              onClick={() => { onSelect(token.symbol); onClose(); setSearch(''); }}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-700">
                  <Image src={getTokenLogoBySymbol(token.symbol)} alt={token.symbol} width={32} height={32} />
                </div>
                <div className="text-left">
                  <div className="text-white text-sm">{token.symbol}</div>
                  <div className="text-zinc-500 text-xs">{token.name}</div>
                </div>
              </div>
              <span className="text-zinc-400 text-sm">{token.balance}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// Add Liquidity Modal
function AddLiquidityModal({
  isOpen,
  onClose,
  preselectedPool,
}: {
  isOpen: boolean;
  onClose: () => void;
  preselectedPool?: PoolData;
}) {
  const { address } = useAccount();
  const { addToast } = useToast();
  const { balances } = useAllTokenBalances(HUB_CHAIN_ID);
  const hubTokens = getTokensForChain(HUB_CHAIN_ID);
  
  const [token0Symbol, setToken0Symbol] = useState(preselectedPool?.token0Symbol || 'sWETH');
  const [token1Symbol, setToken1Symbol] = useState(preselectedPool?.token1Symbol || 'sUSDC');
  const [amount0, setAmount0] = useState('');
  const [amount1, setAmount1] = useState('');
  const [selectedFee, setSelectedFee] = useState(preselectedPool?.fee || 3000);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [initialPrice, setInitialPrice] = useState('');
  const [showToken0Selector, setShowToken0Selector] = useState(false);
  const [showToken1Selector, setShowToken1Selector] = useState(false);
  // Price display direction: false = token1 per token0, true = token0 per token1
  const [invertPrice, setInvertPrice] = useState(false);
  // Range mode: 'full' = full range, 'normal' = ±50%, 'expert' = ±10%
  const [rangeMode, setRangeMode] = useState<'full' | 'normal' | 'expert'>('normal');
  // Track which input was last changed
  const [lastEditedAmount, setLastEditedAmount] = useState<'0' | '1' | null>(null);

  useEffect(() => {
    if (preselectedPool) {
      setToken0Symbol(preselectedPool.token0Symbol);
      setToken1Symbol(preselectedPool.token1Symbol);
      setSelectedFee(preselectedPool.fee);
    }
  }, [preselectedPool]);

  const token0 = hubTokens.find(t => t.symbol === token0Symbol);
  const token1 = hubTokens.find(t => t.symbol === token1Symbol);

  const [sortedToken0, sortedToken1] = useMemo(() => {
    if (!token0?.address || !token1?.address) return [token0, token1];
    return token0.address.toLowerCase() < token1.address.toLowerCase()
      ? [token0, token1]
      : [token1, token0];
  }, [token0, token1]);

  const { poolAddress, exists: poolExists } = usePoolExists(
    (sortedToken0?.address || '0x0') as `0x${string}`,
    (sortedToken1?.address || '0x0') as `0x${string}`,
    selectedFee
  );

  const { sqrtPriceX96 } = usePoolInfo(poolAddress as `0x${string}` | undefined);

  // Calculate current price from sqrtPriceX96
  // Uniswap V3: sqrtPriceX96 = sqrt(token1/token0) * 2^96
  // So price = (sqrtPriceX96 / 2^96)^2 = token1/token0 in raw terms
  // Adjusted price = raw_price * 10^(token0_decimals - token1_decimals)
  const currentPriceRaw = useMemo(() => {
    if (!sqrtPriceX96 || !sortedToken0 || !sortedToken1) return undefined;
    const Q96 = 2 ** 96; // Use regular number, not BigInt
    const sqrtPrice = Number(sqrtPriceX96) / Q96;
    const rawPrice = sqrtPrice * sqrtPrice; // sortedToken1 per sortedToken0 in raw terms
    const decimalAdjustment = Math.pow(10, (sortedToken0.decimals || 18) - (sortedToken1.decimals || 18));
    return rawPrice * decimalAdjustment; // sortedToken1 per sortedToken0 in human terms
  }, [sqrtPriceX96, sortedToken0, sortedToken1]);

  // Display price calculation
  // We want to show "[priceQuoteToken] per [priceBaseToken]"
  // priceBaseToken = invertPrice ? token1Symbol : token0Symbol (the one we measure "per")
  // currentPriceRaw = sortedToken1/sortedToken0
  const displayPrice = useMemo(() => {
    if (!currentPriceRaw || !sortedToken0 || !sortedToken1) return undefined;
    
    // What does the user want to see?
    const priceBase = invertPrice ? token1Symbol : token0Symbol;
    const priceQuote = invertPrice ? token0Symbol : token1Symbol;
    
    // What does the raw price represent?
    // currentPriceRaw = sortedToken1 / sortedToken0
    const sorted0Symbol = sortedToken0.symbol;
    const sorted1Symbol = sortedToken1.symbol;
    
    // We want: priceQuote / priceBase
    // Raw gives us: sorted1 / sorted0
    
    // Case 1: priceBase=sorted0, priceQuote=sorted1 -> use raw price
    // Case 2: priceBase=sorted1, priceQuote=sorted0 -> invert (1/raw)
    // Other cases shouldn't happen with 2 tokens
    
    if (priceBase === sorted0Symbol && priceQuote === sorted1Symbol) {
      // User wants sorted1/sorted0, which is what we have
      return currentPriceRaw;
    } else if (priceBase === sorted1Symbol && priceQuote === sorted0Symbol) {
      // User wants sorted0/sorted1, need to invert
      return 1 / currentPriceRaw;
    }
    
    // Fallback (shouldn't happen)
    console.warn('Unexpected price direction', { priceBase, priceQuote, sorted0Symbol, sorted1Symbol });
    return currentPriceRaw;
  }, [currentPriceRaw, invertPrice, token0Symbol, token1Symbol, sortedToken0, sortedToken1]);

  // Debug logging (remove in production)
  useEffect(() => {
    if (sortedToken0 && sortedToken1 && currentPriceRaw) {
      const priceBase = invertPrice ? token1Symbol : token0Symbol;
      const priceQuote = invertPrice ? token0Symbol : token1Symbol;
      console.log('Price Debug:', {
        token0Symbol,
        token1Symbol,
        sorted0: sortedToken0.symbol,
        sorted1: sortedToken1.symbol,
        currentPriceRaw,
        invertPrice,
        priceBase,
        priceQuote,
        displayPrice,
        expected: priceBase === sortedToken0.symbol ? currentPriceRaw : 1/currentPriceRaw
      });
    }
  }, [token0Symbol, token1Symbol, sortedToken0, sortedToken1, currentPriceRaw, invertPrice, displayPrice]);

  // Format price nicely
  const formatPrice = (price: number) => {
    if (price >= 1000) return price.toFixed(2);
    if (price >= 1) return price.toFixed(4);
    if (price >= 0.0001) return price.toFixed(6);
    return price.toExponential(4);
  };

  // Get the effective price in sortedToken1/sortedToken0 direction (contract direction)
  // This is needed for consistent calculations regardless of display direction
  const effectivePriceInContractDirection = useMemo(() => {
    if (poolExists && currentPriceRaw) return currentPriceRaw;
    if (!poolExists && initialPrice) {
      // initialPrice is entered as priceQuoteToken per priceBaseToken
      // priceBase = invertPrice ? token1Symbol : token0Symbol
      const priceBase = invertPrice ? token1Symbol : token0Symbol;
      const priceBaseIsSorted0 = priceBase === sortedToken0?.symbol;
      // If priceBase is sorted0, initialPrice = sorted1/sorted0 (contract direction)
      // If priceBase is sorted1, initialPrice = sorted0/sorted1, so contract = 1/initialPrice
      const parsed = parseFloat(initialPrice);
      return priceBaseIsSorted0 ? parsed : (1 / parsed);
    }
    return undefined;
  }, [poolExists, currentPriceRaw, initialPrice, invertPrice, token0Symbol, token1Symbol, sortedToken0]);

  // Get the effective price for display (priceQuoteToken per priceBaseToken)
  const effectiveDisplayPrice = useMemo(() => {
    if (poolExists && displayPrice) return displayPrice;
    if (!poolExists && initialPrice) return parseFloat(initialPrice);
    return undefined;
  }, [poolExists, displayPrice, initialPrice]);

  // Auto-calculate counter asset amount when one amount changes
  // We need to use the price in terms of the tokens being edited
  useEffect(() => {
    if (!effectivePriceInContractDirection || !lastEditedAmount) return;
    if (!sortedToken0 || !sortedToken1) return;
    
    // effectivePriceInContractDirection = sortedToken1 per sortedToken0
    // We need: how much of counterToken for 1 unit of editedToken
    
    if (lastEditedAmount === '0' && amount0) {
      const amt0 = parseFloat(amount0);
      if (!isNaN(amt0) && amt0 > 0) {
        // User edited token0Symbol, calculate token1Symbol amount
        // If token0Symbol is sorted0: token1 = amt0 * price (price = sorted1/sorted0)
        // If token0Symbol is sorted1: token1 = amt0 / price (price = sorted1/sorted0, so sorted0 = amt * sorted0/sorted1)
        const token0IsSorted0 = token0Symbol === sortedToken0.symbol;
        const counterAmount = token0IsSorted0 
          ? (amt0 * effectivePriceInContractDirection) 
          : (amt0 / effectivePriceInContractDirection);
        setAmount1(counterAmount.toFixed(6));
      }
    } else if (lastEditedAmount === '1' && amount1) {
      const amt1 = parseFloat(amount1);
      if (!isNaN(amt1) && amt1 > 0) {
        // User edited token1Symbol, calculate token0Symbol amount
        // If token1Symbol is sorted0: token0 = amt1 * price
        // If token1Symbol is sorted1: token0 = amt1 / price
        const token1IsSorted0 = token1Symbol === sortedToken0.symbol;
        const counterAmount = token1IsSorted0 
          ? (amt1 * effectivePriceInContractDirection) 
          : (amt1 / effectivePriceInContractDirection);
        setAmount0(counterAmount.toFixed(6));
      }
    }
  }, [amount0, amount1, lastEditedAmount, effectivePriceInContractDirection, token0Symbol, token1Symbol, sortedToken0, sortedToken1]);

  // Auto-set price range based on range mode
  useEffect(() => {
    if (!effectiveDisplayPrice) return;
    
    if (rangeMode === 'full') {
      setMinPrice('');
      setMaxPrice('');
    } else if (rangeMode === 'normal') {
      // ±50%
      setMinPrice((effectiveDisplayPrice * 0.5).toFixed(4));
      setMaxPrice((effectiveDisplayPrice * 1.5).toFixed(4));
    } else if (rangeMode === 'expert') {
      // ±10%
      setMinPrice((effectiveDisplayPrice * 0.9).toFixed(4));
      setMaxPrice((effectiveDisplayPrice * 1.1).toFixed(4));
    }
  }, [rangeMode, effectiveDisplayPrice]);

  // Price display labels
  const priceBaseToken = invertPrice ? token1Symbol : token0Symbol;
  const priceQuoteToken = invertPrice ? token0Symbol : token1Symbol;

  const { addLiquidity, isLoading } = useLiquidity();

  const handleAddLiquidity = async () => {
    if (!sortedToken0?.address || !sortedToken1?.address || !address) return;

    try {
      const token0Decimals = sortedToken0.decimals || 18;
      const token1Decimals = sortedToken1.decimals || 18;

      // Parse amounts, ensuring at least 1 wei for each (Sonic Uniswap V3 requires non-zero for both)
      let amount0Wei = parseUnits(amount0 || '0', token0Decimals);
      let amount1Wei = parseUnits(amount1 || '0', token1Decimals);
      
      // Ensure minimum 1 wei for both tokens (required by this Uniswap V3 implementation)
      if (amount0Wei === BigInt(0)) amount0Wei = BigInt(1);
      if (amount1Wei === BigInt(0)) amount1Wei = BigInt(1);

      const tickSpacing = getTickSpacing(selectedFee);
      const decimalAdjustment = Math.pow(10, token1Decimals - token0Decimals);
      
      // Determine if we need to convert user's price to contract price
      // User's base token is determined by invertPrice toggle
      const userBaseToken = invertPrice ? token1Symbol : token0Symbol;
      // Contract needs price as: sortedToken1 per sortedToken0
      // If user's base token matches sortedToken0, no inversion needed
      // If user's base token matches sortedToken1, we need to invert
      const needsPriceInversion = userBaseToken === sortedToken1?.symbol;
      
      // Convert prices based on whether user's direction matches contract direction
      let minPriceValue = minPrice ? parseFloat(minPrice) : 0;
      let maxPriceValue = maxPrice ? parseFloat(maxPrice) : Infinity;
      
      if (needsPriceInversion) {
        // Invert prices and swap min/max (since inverting flips the range)
        const temp = minPriceValue;
        minPriceValue = maxPriceValue === Infinity ? 0 : 1 / maxPriceValue;
        maxPriceValue = temp === 0 ? Infinity : 1 / temp;
      }
      
      const minTick = minPriceValue > 0 ? nearestUsableTick(
        priceToTick(minPriceValue * decimalAdjustment),
        tickSpacing
      ) : MIN_TICK;
      const maxTick = maxPriceValue < Infinity ? nearestUsableTick(
        priceToTick(maxPriceValue * decimalAdjustment),
        tickSpacing
      ) : MAX_TICK;

      addToast({ title: 'Adding Liquidity', message: 'Please confirm the transaction...', type: 'pending' });

      // Calculate initial price for the contract
      // Contract expects: token1 per token0 (sorted order)
      // sortedToken0 < sortedToken1 by address
      // User enters price as: priceQuoteToken per priceBaseToken
      // priceBaseToken = invertPrice ? token1Symbol : token0Symbol
      // priceQuoteToken = invertPrice ? token0Symbol : token1Symbol
      let priceForPool: number | undefined = undefined;
      if (!poolExists && initialPrice) {
        const parsedPrice = parseFloat(initialPrice);
        
        // Determine what the user entered
        const userBaseToken = invertPrice ? token1Symbol : token0Symbol;
        
        // Contract needs: sortedToken1 per sortedToken0
        // If user's base token is sortedToken0, price is already correct
        // If user's base token is sortedToken1, we need to invert
        const needsInversion = userBaseToken === sortedToken1?.symbol;
        
        priceForPool = needsInversion ? (1 / parsedPrice) : parsedPrice;
        
        console.log('Price calculation:', {
          userBaseToken,
          sortedToken0: sortedToken0?.symbol,
          sortedToken1: sortedToken1?.symbol,
          needsInversion,
          parsedPrice,
          priceForPool,
        });
      }

      const result = await addLiquidity({
        token0: sortedToken0.address as `0x${string}`,
        token1: sortedToken1.address as `0x${string}`,
        fee: selectedFee,
        tickLower: minTick,
        tickUpper: maxTick,
        amount0Desired: amount0Wei,
        amount1Desired: amount1Wei,
        amount0Min: BigInt(0),
        amount1Min: BigInt(0),
        initialPrice: priceForPool,
        token0Decimals: sortedToken0.decimals || 18,
        token1Decimals: sortedToken1.decimals || 18,
      });

      if (result) {
        addToast({ title: 'Success!', message: 'Liquidity added successfully', type: 'success', txHash: result });
        onClose();
      }
    } catch (error: any) {
      addToast({ title: 'Failed', message: error.message || 'Could not add liquidity', type: 'error' });
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-xl p-6 max-h-[90vh] overflow-y-auto"
          style={{ background: '#0f0f0f', border: '1px solid #1f1f1f' }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white">Add Liquidity</h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Token Pair */}
          <div className="mb-6">
            <div className="text-sm text-zinc-500 mb-2">Select Pair</div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowToken0Selector(true)}
                className="flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
              >
                <div className="w-5 h-5 rounded-full overflow-hidden bg-zinc-700">
                  <Image src={getTokenLogoBySymbol(token0Symbol)} alt={token0Symbol} width={20} height={20} />
                </div>
                <span className="text-white">{token0Symbol}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
              </button>
              <span className="text-zinc-500">/</span>
              <button
                onClick={() => setShowToken1Selector(true)}
                className="flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
              >
                <div className="w-5 h-5 rounded-full overflow-hidden bg-zinc-700">
                  <Image src={getTokenLogoBySymbol(token1Symbol)} alt={token1Symbol} width={20} height={20} />
                </div>
                <span className="text-white">{token1Symbol}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
              </button>
            </div>
          </div>

          {/* Fee Tier */}
          <div className="mb-6">
            <div className="text-sm text-zinc-500 mb-2">Fee Tier</div>
            <div className="grid grid-cols-4 gap-2">
              {FEE_TIERS.map((tier) => (
                <button
                  key={tier.fee}
                  onClick={() => setSelectedFee(tier.fee)}
                  className={`py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedFee === tier.fee
                      ? 'bg-zinc-100 text-zinc-950'
                      : 'bg-transparent text-zinc-500 border border-zinc-700 hover:border-zinc-500'
                  }`}
                >
                  {tier.label}
                </button>
              ))}
            </div>
          </div>

          {/* Current Price Display */}
          <div className="mb-6 p-4 bg-zinc-800/40 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-500">
                {poolExists ? 'Current Price' : 'Set Initial Price'}
              </span>
              {/* Price direction toggle */}
              <button
                onClick={() => setInvertPrice(!invertPrice)}
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors px-2 py-1 rounded bg-zinc-700/50 hover:bg-zinc-700"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                <span>Switch</span>
              </button>
            </div>
            
            {poolExists && displayPrice ? (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-white">
                  {formatPrice(displayPrice)}
                </span>
                <span className="text-sm text-zinc-400">
                  {priceQuoteToken} per {priceBaseToken}
                </span>
              </div>
            ) : !poolExists ? (
              <div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={initialPrice}
                    onChange={(e) => setInitialPrice(e.target.value)}
                    placeholder="Enter price..."
                    className="flex-1 bg-zinc-900 text-white text-lg px-3 py-2 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500"
                  />
                </div>
                <div className="text-xs text-zinc-500 mt-2">
                  1 {priceBaseToken} = {initialPrice || '?'} {priceQuoteToken}
                </div>
                <div className="text-xs text-amber-500/80 mt-1">
                  ⚠️ This pool doesn't exist yet. You'll set the initial price.
                </div>
              </div>
            ) : (
              <div className="text-zinc-500">Loading price...</div>
            )}
          </div>

          {/* Amounts */}
          <div className="mb-6">
            <div className="text-sm text-zinc-500 mb-2">Deposit Amounts</div>
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-700">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full overflow-hidden bg-zinc-700">
                    <Image src={getTokenLogoBySymbol(token0Symbol)} alt={token0Symbol} width={20} height={20} />
                  </div>
                  <span className="text-white text-sm">{token0Symbol}</span>
                  <span className="text-xs text-zinc-500">(Bal: {balances[token0Symbol]?.balanceFormatted || '0'})</span>
                </div>
                <input
                  type="number"
                  value={amount0}
                  onChange={(e) => {
                    setAmount0(e.target.value);
                    setLastEditedAmount('0');
                  }}
                  placeholder="0.0"
                  className="bg-transparent text-right text-lg text-white focus:outline-none w-32"
                />
              </div>
              <div className="flex items-center justify-between pb-3 border-b border-zinc-700">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full overflow-hidden bg-zinc-700">
                    <Image src={getTokenLogoBySymbol(token1Symbol)} alt={token1Symbol} width={20} height={20} />
                  </div>
                  <span className="text-white text-sm">{token1Symbol}</span>
                  <span className="text-xs text-zinc-500">(Bal: {balances[token1Symbol]?.balanceFormatted || '0'})</span>
                </div>
                <input
                  type="number"
                  value={amount1}
                  onChange={(e) => {
                    setAmount1(e.target.value);
                    setLastEditedAmount('1');
                  }}
                  placeholder="0.0"
                  className="bg-transparent text-right text-lg text-white focus:outline-none w-32"
                />
              </div>
            </div>
          </div>

          {/* Range Mode */}
          <div className="mb-6">
            <div className="text-sm text-zinc-500 mb-2">Range Mode</div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'full' as const, label: 'Full Range', desc: 'Entire price range', color: 'text-green-400' },
                { id: 'normal' as const, label: 'Normal', desc: '±50% of price', color: 'text-amber-400' },
                { id: 'expert' as const, label: 'Expert', desc: '±10% of price', color: 'text-red-400' },
              ].map(({ id, label, desc, color }) => (
                <button
                  key={id}
                  onClick={() => setRangeMode(id)}
                  className={`py-3 px-2 rounded-xl text-center transition-all ${
                    rangeMode === id
                      ? 'bg-zinc-800 border-2 border-zinc-600'
                      : 'bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className={`text-sm font-medium ${rangeMode === id ? 'text-white' : 'text-zinc-400'}`}>
                    {label}
                  </div>
                  <div className={`text-[10px] mt-0.5 ${rangeMode === id ? color : 'text-zinc-600'}`}>
                    {desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Price Range Input */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-zinc-500">Price Range</span>
              <span className="text-xs text-zinc-600">
                {priceQuoteToken} per {priceBaseToken}
              </span>
            </div>
            
            {rangeMode === 'full' ? (
              <div className="text-center py-4 bg-zinc-800/30 rounded-xl">
                <div className="text-lg text-white font-medium">Full Range</div>
                <div className="text-xs text-zinc-500 mt-1">
                  Liquidity will be active across all prices (0 → ∞)
                </div>
                <div className="text-xs text-green-500/80 mt-2">
                  ✓ Lower impermanent loss risk, lower fee earnings
                </div>
              </div>
            ) : (
              <>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-zinc-500 mb-1 block">Min Price</label>
                    <input
                      type="number"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      placeholder="0"
                      className="w-full bg-zinc-900 text-white text-lg px-3 py-2 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500 font-mono"
                    />
                    <div className="text-[10px] text-zinc-600 mt-1">
                      {minPrice ? `1 ${priceBaseToken} = ${minPrice} ${priceQuoteToken}` : 'Enter min price'}
                    </div>
                  </div>
                  <div className="flex items-center text-zinc-600 pt-5">→</div>
                  <div className="flex-1">
                    <label className="text-xs text-zinc-500 mb-1 block">Max Price</label>
                    <input
                      type="number"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      placeholder="∞"
                      className="w-full bg-zinc-900 text-white text-lg px-3 py-2 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500 font-mono"
                    />
                    <div className="text-[10px] text-zinc-600 mt-1">
                      {maxPrice ? `1 ${priceBaseToken} = ${maxPrice} ${priceQuoteToken}` : 'Enter max price'}
                    </div>
                  </div>
                </div>
                <div className={`text-xs mt-3 text-center ${rangeMode === 'expert' ? 'text-red-400/80' : 'text-amber-400/80'}`}>
                  {rangeMode === 'expert' 
                    ? '⚡ Higher fee earnings, higher impermanent loss risk'
                    : '⚖️ Balanced fee earnings and impermanent loss'}
                </div>
              </>
            )}
          </div>

          <button
            onClick={handleAddLiquidity}
            disabled={isLoading || !amount0 || !amount1 || (!poolExists && !initialPrice)}
            className={`w-full py-4 rounded-xl font-semibold transition-all ${
              isLoading || !amount0 || !amount1 || (!poolExists && !initialPrice)
                ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                : 'bg-zinc-100 hover:bg-white text-zinc-950'
            }`}
          >
            {isLoading ? 'Adding...' : poolExists ? 'Add Liquidity' : 'Create Pool & Add Liquidity'}
          </button>
        </motion.div>
      </div>

      <TokenSelectorModal
        isOpen={showToken0Selector}
        onClose={() => setShowToken0Selector(false)}
        onSelect={setToken0Symbol}
        tokens={hubTokens}
        excludeToken={token1Symbol}
      />
      <TokenSelectorModal
        isOpen={showToken1Selector}
        onClose={() => setShowToken1Selector(false)}
        onSelect={setToken1Symbol}
        tokens={hubTokens}
        excludeToken={token0Symbol}
      />
    </>
  );
}

// Manage Position Modal
function ManagePositionModal({
  isOpen,
  onClose,
  position,
}: {
  isOpen: boolean;
  onClose: () => void;
  position: any;
}) {
  const [view, setView] = useState<'overview' | 'remove' | 'increase'>('overview');
  const [percentage, setPercentage] = useState(50);
  const [invertPrice, setInvertPrice] = useState(false);
  const { addToast } = useToast();
  const { removeLiquidity, collectFees, isLoading } = useLiquidity();

  // Reset view when modal opens
  useEffect(() => {
    if (isOpen) {
      setView('overview');
      setPercentage(50);
    }
  }, [isOpen]);

  if (!isOpen || !position) return null;

  const symbol0 = position.token0Symbol || '???';
  const symbol1 = position.token1Symbol || '???';
  const decimal0 = position.token0Decimals || 18;
  const decimal1 = position.token1Decimals || 18;
  const feeTier = (position.fee / 10000).toFixed(2);

  // Calculate prices from ticks (always use original token order for calculations)
  const priceLower = Math.pow(1.0001, position.tickLower);
  const priceUpper = Math.pow(1.0001, position.tickUpper);
  const decimalAdj = Math.pow(10, decimal0 - decimal1);
  
  // Original prices (token1 per token0) - used for calculations
  const origMinPrice = priceLower * decimalAdj;
  const origMaxPrice = priceUpper * decimalAdj;
  const origCurrentPrice = position.currentPrice || ((origMinPrice + origMaxPrice) / 2);

  // Token prices in USD
  const getTokenPrice = (sym: string) => {
    if (sym === 'sWETH' || sym === 'wETH') return 3370;
    if (sym === 'sWBTC') return 95000;
    if (sym === 'MIM' || sym === 'sUSDC' || sym === 'sUSDT' || sym === 'sMIM') return 1;
    return 1;
  };
  
  const price0 = getTokenPrice(symbol0);
  const price1 = getTokenPrice(symbol1);

  // Calculate token amounts from liquidity using Uniswap V3 math (always with original prices)
  const sqrtPriceLower = Math.sqrt(origMinPrice > 0 ? origMinPrice : 0.0001);
  const sqrtPriceUpper = Math.sqrt(origMaxPrice > 0 && origMaxPrice < Infinity ? origMaxPrice : 10000);
  const sqrtPriceCurrent = Math.sqrt(origCurrentPrice > 0 ? origCurrentPrice : (origMinPrice + origMaxPrice) / 2);
  
  const liquidityNum = Number(position.liquidity);
  // Calculate raw amounts
  const amount0Raw = liquidityNum * (sqrtPriceUpper - sqrtPriceCurrent) / (sqrtPriceCurrent * sqrtPriceUpper);
  const amount1Raw = liquidityNum * (sqrtPriceCurrent - sqrtPriceLower);
  
  // Convert to actual amounts with decimals
  const amount0 = Math.abs(amount0Raw) / Math.pow(10, decimal0);
  const amount1 = Math.abs(amount1Raw) / Math.pow(10, decimal1);
  
  // Calculate USD values
  const value0 = amount0 * price0;
  const value1 = amount1 * price1;
  const estimatedValue = value0 + value1;
  
  // Pool ratio by USD value
  const totalValueForRatio = value0 + value1;
  const ratio0 = totalValueForRatio > 0 ? (value0 / totalValueForRatio) * 100 : 50;
  const ratio1 = 100 - ratio0;

  // Display prices (can be inverted for user preference)
  let displayMinPrice = origMinPrice;
  let displayMaxPrice = origMaxPrice;
  let displayCurrentPrice = origCurrentPrice;
  let priceBase = symbol0;
  let priceQuote = symbol1;
  
  if (invertPrice) {
    displayMinPrice = 1 / origMaxPrice;
    displayMaxPrice = 1 / origMinPrice;
    displayCurrentPrice = 1 / origCurrentPrice;
    priceBase = symbol1;
    priceQuote = symbol0;
  }

  // Check if in range (use original prices)
  const isInRange = origCurrentPrice >= origMinPrice && origCurrentPrice <= origMaxPrice;

  // Claimable fees (from position data)
  const fees0 = Number(position.tokensOwed0 || 0) / Math.pow(10, decimal0);
  const fees1 = Number(position.tokensOwed1 || 0) / Math.pow(10, decimal1);
  const totalFees = fees0 + fees1; // Simplified

  const formatPrice = (p: number) => {
    if (!isFinite(p) || isNaN(p)) return '∞';
    if (p >= 1000000) return p.toExponential(2);
    if (p >= 1000) return p.toFixed(0);
    if (p >= 1) return p.toFixed(2);
    if (p >= 0.0001) return p.toFixed(6);
    return p.toExponential(2);
  };

  const formatAmount = (a: number) => {
    if (!isFinite(a) || isNaN(a)) return '0';
    if (Math.abs(a) >= 1000000) return (a / 1000000).toFixed(2) + 'M';
    if (Math.abs(a) >= 1000) return (a / 1000).toFixed(2) + 'K';
    if (Math.abs(a) >= 1) return a.toFixed(2);
    return a.toFixed(6);
  };

  const handleRemove = async () => {
    try {
      const liquidityToRemove = (position.liquidity * BigInt(percentage)) / BigInt(100);
      addToast({ title: 'Removing Liquidity', message: 'Please confirm the transaction...', type: 'pending' });

      const result = await removeLiquidity(position.tokenId, liquidityToRemove);
      if (result) {
        addToast({ title: 'Success!', message: 'Liquidity removed successfully', type: 'success', txHash: result });
        onClose();
      }
    } catch (error: any) {
      addToast({ title: 'Failed', message: error.message || 'Could not remove liquidity', type: 'error' });
    }
  };

  const handleCollect = async () => {
    try {
      addToast({ title: 'Collecting Fees', message: 'Please confirm the transaction...', type: 'pending' });
      const result = await collectFees(position.tokenId);
      if (result) {
        addToast({ title: 'Success!', message: 'Fees collected successfully', type: 'success', txHash: result });
      }
    } catch (error: any) {
      addToast({ title: 'Failed', message: error.message || 'Could not collect fees', type: 'error' });
    }
  };

  // Remove Liquidity View
  if (view === 'remove') {
    const removeAmount0 = Math.abs(amount0) * (percentage / 100);
    const removeAmount1 = Math.abs(amount1) * (percentage / 100);
    const removeValue = estimatedValue * (percentage / 100);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-lg rounded-xl overflow-hidden"
          style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <button 
              onClick={() => setView('overview')}
              className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <span className="text-white font-medium">Remove Liquidity</span>
            <button onClick={onClose} className="text-zinc-500 hover:text-white p-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-5">
            {/* Percentage Display */}
            <div className="text-center mb-4">
              <div className="text-5xl font-semibold text-white">{percentage}%</div>
              <div className="text-xs text-zinc-500 mt-1">{symbol0}/{symbol1} · {feeTier}%</div>
            </div>

            {/* Quick Select Buttons */}
            <div className="flex gap-2 mb-3">
              {[25, 50, 75].map((p) => (
                <button
                  key={p}
                  onClick={() => setPercentage(p)}
                  className={`flex-1 py-2 rounded text-sm font-medium transition-all ${
                    percentage === p
                      ? 'bg-white text-black'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {p}%
                </button>
              ))}
              <button
                onClick={() => setPercentage(100)}
                className={`flex-1 py-2 rounded text-sm font-medium transition-all ${
                  percentage === 100
                    ? 'bg-white text-black'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                max
              </button>
            </div>

            {/* Slider */}
            <div className="mb-5">
              <input
                type="range"
                min="1"
                max="100"
                value={percentage}
                onChange={(e) => setPercentage(parseInt(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #fff 0%, #fff ${percentage}%, #27272a ${percentage}%, #27272a 100%)`
                }}
              />
            </div>

            {/* You will receive */}
            <div className="rounded-lg p-4 border border-zinc-800 mb-4">
              <div className="text-xs text-zinc-500 mb-3">You will receive</div>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center text-xs text-white">
                      {symbol0.charAt(0)}
                    </div>
                    <span className="text-white text-sm">{symbol0}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-white text-sm font-medium">{formatAmount(removeAmount0)}</span>
                    <span className="text-zinc-500 text-xs ml-2">${formatAmount(removeValue * (ratio0 / 100))}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-zinc-600 flex items-center justify-center text-xs text-white">
                      {symbol1.charAt(0)}
                    </div>
                    <span className="text-white text-sm">{symbol1}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-white text-sm font-medium">{formatAmount(removeAmount1)}</span>
                    <span className="text-zinc-500 text-xs ml-2">${formatAmount(removeValue * (ratio1 / 100))}</span>
                  </div>
                </div>
              </div>
              <div className="border-t border-zinc-800 mt-3 pt-3 flex justify-between">
                <span className="text-xs text-zinc-500">Total value</span>
                <span className="text-white font-medium">${removeValue.toFixed(2)}</span>
              </div>
            </div>

            {/* Confirm Button */}
            <button
              onClick={handleRemove}
              disabled={isLoading}
              className="w-full py-3 rounded-lg font-medium text-white transition-all bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40"
            >
              {isLoading ? 'Removing...' : 'Confirm Removal'}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Main Overview View
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-3xl rounded-xl overflow-hidden"
        style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-1.5">
              <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-medium text-white border border-zinc-600">
                {symbol0.charAt(0)}
              </div>
              <div className="w-7 h-7 rounded-full bg-zinc-600 flex items-center justify-center text-xs font-medium text-white border border-zinc-500">
                {symbol1.charAt(0)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white font-medium">{symbol0}/{symbol1}</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{feeTier}%</span>
              <span className="text-xs text-zinc-500">#{position.tokenId?.toString()}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white p-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex">
          {/* Left Panel */}
          <div className="flex-1 p-5">
            {/* Value & Actions Row */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div>
                  <div className="text-xs text-zinc-500">Value</div>
                  <div className="text-2xl font-semibold text-white">${estimatedValue > 0.01 ? estimatedValue.toFixed(2) : '<0.01'}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${isInRange ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  {isInRange ? '● In range' : '● Out of range'}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setView('remove')}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 transition-all border border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/50"
                >
                  Remove
                </button>
                <button
                  onClick={() => addToast({ title: 'Coming Soon', message: 'Increase liquidity feature coming soon', type: 'pending' })}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all bg-zinc-800 hover:bg-zinc-700"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Pool Composition */}
            <div className="rounded-lg p-4 mb-4 border border-zinc-800">
              <div className="flex items-center justify-between mb-3 text-xs text-zinc-500">
                <span>Pool composition</span>
                <div className="flex gap-12">
                  <span>Ratio</span>
                  <span>Value</span>
                </div>
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center text-xs text-white">
                      {symbol0.charAt(0)}
                    </div>
                    <span className="text-white text-sm">{symbol0}</span>
                    <span className="text-zinc-500 text-sm">{formatAmount(amount0)}</span>
                  </div>
                  <div className="flex gap-12 text-sm">
                    <span className="text-zinc-400 w-12 text-right">{ratio0.toFixed(0)}%</span>
                    <span className="text-white w-20 text-right">${formatAmount(value0)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-zinc-600 flex items-center justify-center text-xs text-white">
                      {symbol1.charAt(0)}
                    </div>
                    <span className="text-white text-sm">{symbol1}</span>
                    <span className="text-zinc-500 text-sm">{formatAmount(amount1)}</span>
                  </div>
                  <div className="flex gap-12 text-sm">
                    <span className="text-zinc-400 w-12 text-right">{ratio1.toFixed(0)}%</span>
                    <span className="text-white w-20 text-right">${formatAmount(value1)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Claimable Fees */}
            <div className="rounded-lg p-4 border border-zinc-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-zinc-500">Claimable fees</span>
                <div className="flex items-center gap-3">
                  <span className="text-white font-medium">${(fees0 + fees1).toFixed(2)}</span>
                  <button
                    onClick={handleCollect}
                    disabled={isLoading || (fees0 === 0 && fees1 === 0)}
                    className="px-3 py-1.5 rounded text-xs font-medium transition-all bg-zinc-800 hover:bg-zinc-700 text-white disabled:opacity-40"
                  >
                    Collect
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] text-white">
                      {symbol0.charAt(0)}
                    </div>
                    <span className="text-zinc-400">{symbol0}</span>
                    <span className="text-zinc-300">{formatAmount(fees0)}</span>
                  </div>
                  <span className="text-zinc-500">${fees0.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-zinc-600 flex items-center justify-center text-[10px] text-white">
                      {symbol1.charAt(0)}
                    </div>
                    <span className="text-zinc-400">{symbol1}</span>
                    <span className="text-zinc-300">{formatAmount(fees1)}</span>
                  </div>
                  <span className="text-zinc-500">${fees1.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Price Range */}
          <div className="w-64 p-5 border-l border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-zinc-400">Price range</span>
            </div>

            {/* Price Toggle */}
            <div className="flex gap-1 mb-4 p-0.5 rounded bg-zinc-800/50 text-[11px]">
              <button
                onClick={() => setInvertPrice(false)}
                className={`flex-1 py-1.5 rounded transition-all ${
                  !invertPrice ? 'bg-zinc-700 text-white' : 'text-zinc-500'
                }`}
              >
                {symbol1}/{symbol0}
              </button>
              <button
                onClick={() => setInvertPrice(true)}
                className={`flex-1 py-1.5 rounded transition-all ${
                  invertPrice ? 'bg-zinc-700 text-white' : 'text-zinc-500'
                }`}
              >
                {symbol0}/{symbol1}
              </button>
            </div>

            {/* Prices */}
            <div className="space-y-2">
              <div className="rounded-lg p-3 text-center border border-zinc-800">
                <div className="text-[10px] text-zinc-500 mb-0.5">Max</div>
                <div className="text-lg font-medium text-white">{formatPrice(displayMaxPrice)}</div>
              </div>
              <div className="rounded-lg p-3 text-center border border-zinc-600 bg-zinc-800/30">
                <div className="text-[10px] text-zinc-500 mb-0.5">Current</div>
                <div className="text-lg font-medium text-white">{formatPrice(displayCurrentPrice)}</div>
              </div>
              <div className="rounded-lg p-3 text-center border border-zinc-800">
                <div className="text-[10px] text-zinc-500 mb-0.5">Min</div>
                <div className="text-lg font-medium text-white">{formatPrice(displayMinPrice)}</div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function V3PoolsTab() {
  const { address, isConnected } = useAccount();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'positions'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedPool, setSelectedPool] = useState<PoolData | undefined>(undefined);
  const [selectedPosition, setSelectedPosition] = useState<any>(null);
  const [invertPositionPrices, setInvertPositionPrices] = useState(false);
  const [analyticsPool, setAnalyticsPool] = useState<PoolData | null>(null);

  // Fetch real pool data from V3 contracts
  const { pools, stats, isLoading: poolsLoading } = useAllPools();
  
  // Fetch user's positions
  const { positions, isLoading: positionsLoading } = useLiquidity();

  // Filter pools by search
  const filteredPools = useMemo(() => {
    if (!searchQuery) return pools;
    const query = searchQuery.toLowerCase();
    return pools.filter(p =>
      p.token0Symbol.toLowerCase().includes(query) ||
      p.token1Symbol.toLowerCase().includes(query)
    );
  }, [pools, searchQuery]);

  // Map positions to pools for "My Liquidity" display
  const poolPositions = useMemo(() => {
    const map: Record<string, any> = {};
    for (const pos of positions) {
      const key = `${pos.token0.toLowerCase()}-${pos.token1.toLowerCase()}-${pos.fee}`;
      if (!map[key]) {
        map[key] = pos;
      }
    }
    return map;
  }, [positions]);

  const hasPositionInPool = (pool: PoolData) => {
    const key = `${pool.token0Address.toLowerCase()}-${pool.token1Address.toLowerCase()}-${pool.fee}`;
    return !!poolPositions[key];
  };

  const getPositionForPool = (pool: PoolData) => {
    const key = `${pool.token0Address.toLowerCase()}-${pool.token1Address.toLowerCase()}-${pool.fee}`;
    return poolPositions[key];
  };

  // Calculate user's total liquidity
  const userTotalLiquidity = useMemo(() => {
    // Simple estimate based on number of positions
    return positions.length > 0 ? stats.totalTvlUsd * 0.05 : 0; // Mock: 5% of TVL if has positions
  }, [positions, stats.totalTvlUsd]);

  const isLoading = poolsLoading || positionsLoading;

  // Show analytics page if a pool is selected
  if (analyticsPool) {
    return (
      <PoolAnalytics
        poolAddress={analyticsPool.address}
        token0Symbol={analyticsPool.token0Symbol}
        token1Symbol={analyticsPool.token1Symbol}
        fee={analyticsPool.fee}
        onBack={() => setAnalyticsPool(null)}
      />
    );
  }

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="p-6 bg-zinc-900/30 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Waves className="w-4 h-4 text-zinc-400" />
            <span className="text-zinc-500">Total Value Locked</span>
          </div>
          <div className="text-zinc-100 text-2xl">
            {isLoading ? '...' : formatUsd(stats.totalTvlUsd)}
          </div>
        </div>
        <div className="p-6 bg-zinc-900/30 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-zinc-400" />
            <span className="text-zinc-500">24h Volume</span>
          </div>
          <div className="text-zinc-100 text-2xl">
            {isLoading ? '...' : formatUsd(stats.totalVolume24h)}
          </div>
        </div>
        <div className="p-6 bg-zinc-900/30 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-zinc-400" />
            <span className="text-zinc-500">Your Liquidity</span>
          </div>
          <div className="text-zinc-100 text-2xl">
            {isLoading ? '...' : formatUsd(userTotalLiquidity)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setViewMode('all')}
            className={`px-4 py-2 rounded-lg transition-all ${
              viewMode === 'all'
                ? 'bg-zinc-100 text-zinc-950'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            All Pools
          </button>
          <button
            onClick={() => setViewMode('positions')}
            className={`px-4 py-2 rounded-lg transition-all ${
              viewMode === 'positions'
                ? 'bg-zinc-100 text-zinc-950'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            My Positions {positions.length > 0 && `(${positions.length})`}
          </button>
        </div>

        <input
          type="text"
          placeholder="Search pools..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-4 py-2 bg-zinc-900/30 text-zinc-100 placeholder:text-zinc-600 rounded-lg outline-none focus:ring-1 focus:ring-zinc-700 transition-all"
        />
      </div>

      {/* Pools List or Positions List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-12 text-zinc-500">Loading...</div>
        ) : viewMode === 'positions' ? (
          // Show user's positions directly
          positions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-zinc-500 mb-4">You don't have any liquidity positions yet</div>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-6 py-3 bg-zinc-100 text-zinc-950 rounded-lg hover:bg-white transition-colors"
              >
                Create New Pool
              </button>
            </div>
          ) : (
            <>
              {/* Price direction toggle */}
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => setInvertPositionPrices(!invertPositionPrices)}
                  className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-800"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                  <span>Switch Price Direction</span>
                </button>
              </div>
              {positions.map((pos, index) => {
              const symbol0 = pos.token0Symbol || '???';
              const symbol1 = pos.token1Symbol || '???';
              
              // Convert tick to price (token1 per token0)
              const priceLower = Math.pow(1.0001, pos.tickLower);
              const priceUpper = Math.pow(1.0001, pos.tickUpper);
              
              // Adjust for decimals
              const decimal0 = pos.token0Decimals || 18;
              const decimal1 = pos.token1Decimals || 18;
              const decimalAdj = Math.pow(10, decimal0 - decimal1);
              
              let adjustedPriceLower = priceLower * decimalAdj;
              let adjustedPriceUpper = priceUpper * decimalAdj;
              
              // If inverted, swap and invert prices
              let priceBaseSymbol = symbol0;
              let priceQuoteSymbol = symbol1;
              
              if (invertPositionPrices) {
                const tempLower = adjustedPriceLower;
                adjustedPriceLower = 1 / adjustedPriceUpper;
                adjustedPriceUpper = 1 / tempLower;
                priceBaseSymbol = symbol1;
                priceQuoteSymbol = symbol0;
              }
              
              // Format price nicely
              const formatPriceRange = (price: number) => {
                if (price >= 1000) return price.toFixed(0);
                if (price >= 1) return price.toFixed(2);
                if (price >= 0.0001) return price.toFixed(6);
                return price.toExponential(2);
              };
              
              // Token prices in USD
              const getTokenPrice = (sym: string) => {
                if (sym === 'sWETH' || sym === 'wETH') return 3370;
                if (sym === 'sWBTC') return 95000;
                if (sym === 'MIM' || sym === 'sUSDC' || sym === 'sUSDT' || sym === 'sMIM') return 1;
                return 1;
              };
              
              // Calculate token amounts from liquidity using Uniswap V3 math
              const sqrtPriceLower = Math.sqrt(adjustedPriceLower > 0 ? adjustedPriceLower : 0.0001);
              const sqrtPriceUpper = Math.sqrt(adjustedPriceUpper > 0 ? adjustedPriceUpper : 10000);
              const sqrtPriceCurrent = Math.sqrt((adjustedPriceLower + adjustedPriceUpper) / 2);
              
              const liquidityNum = Number(pos.liquidity);
              // Simplified amount calculation
              const amount0Raw = liquidityNum * (sqrtPriceUpper - sqrtPriceCurrent) / (sqrtPriceCurrent * sqrtPriceUpper);
              const amount1Raw = liquidityNum * (sqrtPriceCurrent - sqrtPriceLower);
              
              const amount0 = Math.abs(amount0Raw) / Math.pow(10, decimal0);
              const amount1 = Math.abs(amount1Raw) / Math.pow(10, decimal1);
              
              const price0 = getTokenPrice(symbol0);
              const price1 = getTokenPrice(symbol1);
              const estimatedValue = (amount0 * price0) + (amount1 * price1);
              
              return (
                <motion.div
                  key={pos.tokenId.toString()}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="p-6 bg-zinc-900/30 rounded-xl hover:bg-zinc-900/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex -space-x-2">
                          <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-zinc-950 bg-zinc-700">
                            <Image src={getTokenLogoBySymbol(symbol0)} alt={symbol0} width={32} height={32} />
                          </div>
                          <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-zinc-950 bg-zinc-700">
                            <Image src={getTokenLogoBySymbol(symbol1)} alt={symbol1} width={32} height={32} />
                          </div>
                        </div>
                        <h3 className="text-zinc-100">{symbol0} / {symbol1}</h3>
                        <span className="text-xs text-zinc-500 px-2 py-1 bg-zinc-800/50 rounded">
                          {pos.fee / 10000}%
                        </span>
                        <span className="text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded">
                          #{pos.tokenId.toString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-zinc-500">
                        <span>
                          Price Range: {formatPriceRange(adjustedPriceLower)} → {formatPriceRange(adjustedPriceUpper)} {priceQuoteSymbol} per {priceBaseSymbol}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xs text-zinc-500 mb-1">Value</div>
                        <div className="text-lg text-zinc-100 font-medium">
                          ${estimatedValue > 0.01 ? estimatedValue.toFixed(2) : '<0.01'}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          // Find the pool for this position to open analytics
                          const poolForPosition = pools.find(p => 
                            p.token0Address.toLowerCase() === (pos.token0 || '').toLowerCase() &&
                            p.token1Address.toLowerCase() === (pos.token1 || '').toLowerCase() &&
                            p.fee === pos.fee
                          );
                          if (poolForPosition) {
                            setAnalyticsPool(poolForPosition);
                          }
                        }}
                        className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all"
                        title="Pool Analytics"
                      >
                        <Info className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPosition(pos);
                          setShowManageModal(true);
                        }}
                        className="px-6 py-3 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 transition-all"
                      >
                        Manage
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
            </>
          )
        ) : filteredPools.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            {searchQuery ? 'No pools found matching your search' : 'No pools available yet'}
          </div>
        ) : (
          filteredPools.map((pool, index) => {
              const hasPosition = hasPositionInPool(pool);
              return (
                <motion.div
                  key={pool.address}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="p-6 bg-zinc-900/30 rounded-xl hover:bg-zinc-900/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex -space-x-2">
                          <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-zinc-950 bg-zinc-700">
                            <Image src={getTokenLogoBySymbol(pool.token0Symbol)} alt={pool.token0Symbol} width={32} height={32} />
                          </div>
                          <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-zinc-950 bg-zinc-700">
                            <Image src={getTokenLogoBySymbol(pool.token1Symbol)} alt={pool.token1Symbol} width={32} height={32} />
                          </div>
                        </div>
                        <h3 className="text-zinc-100">{pool.token0Symbol} / {pool.token1Symbol}</h3>
                        <span className="text-xs text-zinc-500 px-2 py-1 bg-zinc-800/50 rounded">
                          {pool.fee / 10000}%
                        </span>
                        {hasPosition && (
                          <span className="text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded">
                            Active
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAnalyticsPool(pool);
                          }}
                          className="p-1.5 hover:bg-zinc-700 rounded-lg transition-colors group"
                          title="View Pool Analytics"
                        >
                          <Info className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <div className="text-zinc-500 mb-1">TVL</div>
                        <div className="text-zinc-100">{formatUsd(pool.tvlUsd)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-zinc-500 mb-1">24h Volume</div>
                        <div className="text-zinc-100">{formatUsd(pool.volume24h)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-zinc-500 mb-1">APY</div>
                        <div className="text-zinc-100 text-xl">{pool.apy.toFixed(1)}%</div>
                      </div>
                      {hasPosition ? (
                        <div className="w-32" />
                      ) : (
                        <div className="w-32" />
                      )}
                      <button
                        onClick={() => {
                          if (hasPosition) {
                            const pos = getPositionForPool(pool);
                            setSelectedPosition(pos);
                            setShowManageModal(true);
                          } else {
                            setSelectedPool(pool);
                            setShowAddModal(true);
                          }
                        }}
                        className={`px-6 py-3 rounded-lg transition-all ${
                          hasPosition
                            ? 'bg-zinc-100 hover:bg-white text-zinc-950'
                            : 'bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300'
                        }`}
                      >
                        {hasPosition ? 'Manage' : 'Add Liquidity'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })
        )}
      </div>

      {/* Create Pool Button */}
      <div className="mt-8 p-6 bg-zinc-900/30 rounded-xl text-center">
        <p className="text-zinc-400 mb-4">Don't see a pool you're looking for?</p>
        <button
          onClick={() => { setSelectedPool(undefined); setShowAddModal(true); }}
          className="px-6 py-3 bg-zinc-100 hover:bg-white text-zinc-950 rounded-lg transition-all"
        >
          Create New Pool
        </button>
      </div>

      {/* Modals */}
      <AddLiquidityModal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setSelectedPool(undefined); }}
        preselectedPool={selectedPool}
      />
      <ManagePositionModal
        isOpen={showManageModal}
        onClose={() => { setShowManageModal(false); setSelectedPosition(null); }}
        position={selectedPosition}
      />
    </div>
  );
}
