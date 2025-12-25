"use client";

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Info, 
  ArrowDown, 
  TrendingUp, 
  Wallet, 
  PiggyBank,
  ArrowUpRight,
  Percent,
  Shield,
  Clock,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { useAccount, useSwitchChain } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { useMagicPool } from '@/lib/contracts/magicpool/useMagicPool';

// Interest Rate Model Parameters (from contract)
const RATE_MODEL = {
  baseRate: 10,         // 10% minimum fixed rate
  multiplier: 12,       // 12%
  jumpMultiplier: 100,  // 100%
  kink: 80,             // 80% utilization kink point
};

const MAX_UTILIZATION = 90; // 90% max utilization cap

const INTEREST_RATE_TIERS = [
  { utilization: '0-40%', rate: '10-14.8%', label: 'Low' },
  { utilization: '40-80%', rate: '14.8-19.6%', label: 'Optimal' },
  { utilization: '80-85%', rate: '19.6-24.6%', label: 'High (Kink)' },
  { utilization: '85-90%', rate: '24.6-29.6%', label: 'Max Cap' },
];

type Tab = 'Mint' | 'Supply' | 'Positions';

// Hub chain ID (Sonic)
const HUB_CHAIN_ID = 146;

// Exported as USDWPage for backwards compatibility (displays as MIM/MagicPool in UI)
export function USDWPage() {
  const { isConnected, address, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const [activeTab, setActiveTab] = useState<Tab>('Mint');
  
  // Mint state
  const [mintAmount, setMintAmount] = useState('');
  const [isMinting, setIsMinting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  
  // Supply state
  const [supplyAmount, setSupplyAmount] = useState('');
  const [isSupplying, setIsSupplying] = useState(false);
  const [supplyMode, setSupplyMode] = useState<'supply' | 'withdraw'>('supply');

  // Hook into real contracts
  const { minter, vault, refetchAll } = useMagicPool();

  // Check if on correct chain
  const isOnHubChain = chainId === HUB_CHAIN_ID;

  // Truncate to specific decimal places (for input fields)
  const truncateDecimals = (value: string, decimals = 6): string => {
    const num = parseFloat(value);
    if (isNaN(num)) return '0';
    // Truncate (not round) to avoid exceeding balance
    const factor = Math.pow(10, decimals);
    const truncated = Math.floor(num * factor) / factor;
    return truncated.toString();
  };

  // Format numbers for display
  const formatNumber = (value: string | number, decimals = 2) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0.00';
    return num.toLocaleString(undefined, { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    });
  };

  // Calculate current APR based on real utilization
  const currentAPR = vault.interestRate || RATE_MODEL.baseRate;
  const utilization = vault.utilization || 0;

  const mintUsdValue = useMemo(() => {
    const amount = parseFloat(mintAmount.replace(/,/g, '') || '0');
    return `$${formatNumber(amount)}`;
  }, [mintAmount]);

  const supplyUsdValue = useMemo(() => {
    const amount = parseFloat(supplyAmount.replace(/,/g, '') || '0');
    return `$${formatNumber(amount)}`;
  }, [supplyAmount]);

  // Handle chain switch
  const handleSwitchChain = () => {
    switchChain?.({ chainId: HUB_CHAIN_ID });
  };

  // Handle Mint
  const handleMint = async () => {
    if (!mintAmount || parseFloat(mintAmount) <= 0 || !isOnHubChain) return;
    
    const amountBigInt = parseUnits(mintAmount, 6);
    
    try {
      // Check if approval needed
      if (minter.needsApproval(amountBigInt)) {
        setIsApproving(true);
        await minter.approveSUSDC(amountBigInt); // Approve exact amount needed
        setIsApproving(false);
      }
      
      setIsMinting(true);
      await minter.mintMIM(amountBigInt);
      setMintAmount('');
      refetchAll();
    } catch (error) {
      console.error('Mint failed:', error);
    } finally {
      setIsMinting(false);
      setIsApproving(false);
    }
  };

  // Handle Redeem
  const handleRedeem = async () => {
    if (!mintAmount || parseFloat(mintAmount) <= 0 || !isOnHubChain) return;
    
    // When redeeming, user inputs MIM amount (18 decimals)
    const amountBigInt = parseUnits(mintAmount, 18);
    
    try {
      setIsMinting(true);
      await minter.redeemMIM(amountBigInt);
      setMintAmount('');
      refetchAll();
    } catch (error) {
      console.error('Redeem failed:', error);
    } finally {
      setIsMinting(false);
    }
  };

  // Handle Supply/Withdraw
  const handleSupply = async () => {
    if (!supplyAmount || parseFloat(supplyAmount) <= 0 || !isOnHubChain) return;
    
    // MIM and sMIM both have 18 decimals
    const amountBigInt = parseUnits(supplyAmount, 18);
    
    try {
      if (supplyMode === 'supply') {
        // Check if approval needed
        if (vault.needsApproval(amountBigInt)) {
          setIsApproving(true);
          await vault.approveMIM(amountBigInt); // Approve exact amount needed
          setIsApproving(false);
        }
        
        setIsSupplying(true);
        await vault.deposit(amountBigInt);
      } else {
        setIsSupplying(true);
        await vault.withdraw(amountBigInt);
      }
      
      setSupplyAmount('');
      refetchAll();
    } catch (error) {
      console.error('Supply/Withdraw failed:', error);
    } finally {
      setIsSupplying(false);
      setIsApproving(false);
    }
  };

  // Refetch on mount and when connected
  useEffect(() => {
    if (isConnected && isOnHubChain) {
      refetchAll();
    }
  }, [isConnected, isOnHubChain]);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="mb-8"
      >
        <div className="flex items-center gap-4 mb-3">
          <h1 className="text-zinc-100 text-2xl">MIM Stablecoin</h1>
          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm flex items-center gap-1">
            <Shield className="w-3 h-3" />
            1:1 sUSDC Backed
          </span>
        </div>
        <p className="text-zinc-400 max-w-2xl">
          Mint MIM stablecoins 1:1 with sUSDC, or supply to the StakingVault to earn yield from protocol lending fees.
        </p>
      </motion.div>

      {/* Chain Warning */}
      {isConnected && !isOnHubChain && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              <span className="text-yellow-500">Please switch to Sonic chain to use MagicPool</span>
            </div>
            <button
              onClick={handleSwitchChain}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black rounded-lg transition-colors"
            >
              Switch to Sonic
            </button>
          </div>
        </motion.div>
      )}

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: -10, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
      >
        <div className="p-4 bg-zinc-900/30 rounded-xl">
          <div className="flex items-center gap-2 text-zinc-500 text-sm mb-2">
            <PiggyBank className="w-4 h-4" />
            Total Supplied
          </div>
          <div className="text-zinc-100 text-xl">${formatNumber(vault.totalAssets)}</div>
        </div>
        <div className="p-4 bg-zinc-900/30 rounded-xl">
          <div className="flex items-center gap-2 text-zinc-500 text-sm mb-2">
            <Wallet className="w-4 h-4" />
            Total Borrowed
          </div>
          <div className="text-zinc-100 text-xl">${formatNumber(vault.totalBorrowed)}</div>
        </div>
        <div className="p-4 bg-zinc-900/30 rounded-xl">
          <div className="flex items-center gap-2 text-zinc-500 text-sm mb-2">
            <Percent className="w-4 h-4" />
            Utilization
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-100 text-xl">{formatNumber(utilization, 1)}%</span>
            <span className="text-zinc-500 text-sm">/ {MAX_UTILIZATION}% max</span>
          </div>
        </div>
        <div className="p-4 bg-zinc-900/30 rounded-xl border border-emerald-500/20">
          <div className="flex items-center gap-2 text-zinc-500 text-sm mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Current APR
          </div>
          <div className="text-emerald-400 text-xl font-medium">{formatNumber(currentAPR, 2)}%</div>
        </div>
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Action Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="lg:col-span-2"
        >
          {/* Tabs */}
          <div className="flex items-center gap-6 mb-6 border-b border-zinc-800">
            {(['Mint', 'Supply', 'Positions'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-4 transition-colors relative ${
                  activeTab === tab
                    ? 'text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <motion.div
                    layoutId="magicpoolActiveTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-100"
                  />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Mint Tab */}
              {activeTab === 'Mint' && (
                <div className="p-6 bg-zinc-900/30 rounded-xl">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-zinc-100">Mint MIM</h3>
                    <div className="flex items-center gap-2 text-zinc-500 text-sm">
                      <Info className="w-4 h-4" />
                      1:1 conversion rate
                    </div>
                  </div>

                  {/* From sUSDC */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-zinc-500">You deposit</span>
                      <span className="text-zinc-500">Balance: {formatNumber(minter.sUSDCBalance)} sUSDC</span>
                    </div>
                    <div className="flex items-center gap-3 pb-3 border-b border-zinc-700">
                      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg">
                        <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                          $
                        </div>
                        <span className="text-zinc-100">sUSDC</span>
                      </div>
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={mintAmount}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (/^\d*\.?\d*$/.test(value)) {
                              setMintAmount(value);
                            }
                          }}
                          placeholder="0.0"
                          className="flex-1 bg-transparent text-zinc-100 text-right outline-none placeholder:text-zinc-700"
                        />
                        <button
                          onClick={() => setMintAmount(minter.sUSDCBalance.replace(/,/g, ''))}
                          className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 transition-colors text-sm"
                        >
                          MAX
                        </button>
                      </div>
                    </div>
                    {mintAmount && (
                      <div className="mt-2 text-right text-zinc-600">
                        ≈ {mintUsdValue}
                      </div>
                    )}
                  </div>

                  {/* Arrow */}
                  <div className="flex justify-center py-3">
                    <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center">
                      <ArrowDown className="w-5 h-5 text-zinc-400" />
                    </div>
                  </div>

                  {/* To MIM */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-zinc-500">You receive</span>
                      <span className="text-zinc-500">Balance: {formatNumber(minter.mimBalance)} MIM</span>
                    </div>
                    <div className="flex items-center gap-3 pb-3 border-b border-zinc-700">
                      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                          M
                        </div>
                        <span className="text-zinc-100">MIM</span>
                      </div>
                      <input
                        type="text"
                        value={mintAmount}
                        readOnly
                        placeholder="0.0"
                        className="flex-1 bg-transparent text-zinc-100 text-right outline-none placeholder:text-zinc-700"
                      />
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="p-4 bg-zinc-800/50 rounded-lg mb-6">
                    <div className="flex items-start gap-3">
                      <Info className="w-4 h-4 text-zinc-500 mt-0.5" />
                      <div className="text-sm text-zinc-400">
                        MIM is minted 1:1 with sUSDC. Your sUSDC is deposited into the MIM/sUSDC V3 pool 
                        in a tight range (0.995-1.005) to maintain the peg.
                      </div>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    disabled={!isConnected || !isOnHubChain || !mintAmount || parseFloat(mintAmount) <= 0 || isMinting || isApproving}
                    onClick={handleMint}
                    className="w-full py-4 bg-zinc-100 hover:bg-white text-zinc-950 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
                  >
                    {(isMinting || isApproving) && <Loader2 className="w-4 h-4 animate-spin" />}
                    {!isConnected 
                      ? 'Connect Wallet' 
                      : !isOnHubChain 
                        ? 'Switch to Sonic'
                        : isApproving 
                          ? 'Approving...' 
                          : isMinting 
                            ? 'Minting...' 
                            : 'Mint MIM'}
                  </motion.button>
                </div>
              )}

              {/* Supply Tab */}
              {activeTab === 'Supply' && (
                <div className="p-6 bg-zinc-900/30 rounded-xl">
                  {/* Supply/Withdraw Toggle */}
                  <div className="flex items-center gap-2 mb-6">
                    <button
                      onClick={() => setSupplyMode('supply')}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        supplyMode === 'supply'
                          ? 'bg-zinc-100 text-zinc-950'
                          : 'bg-zinc-800/50 text-zinc-400 hover:text-zinc-300'
                      }`}
                    >
                      Supply
                    </button>
                    <button
                      onClick={() => setSupplyMode('withdraw')}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        supplyMode === 'withdraw'
                          ? 'bg-zinc-100 text-zinc-950'
                          : 'bg-zinc-800/50 text-zinc-400 hover:text-zinc-300'
                      }`}
                    >
                      Withdraw
                    </button>
                  </div>

                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-zinc-100">
                      {supplyMode === 'supply' ? 'Supply to Vault' : 'Withdraw from Vault'}
                    </h3>
                    <div className="flex items-center gap-2 text-emerald-400 text-sm">
                      <TrendingUp className="w-4 h-4" />
                      {formatNumber(currentAPR, 2)}% APR
                    </div>
                  </div>

                  {/* Amount Input */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-zinc-500">
                        {supplyMode === 'supply' ? 'Amount to supply' : 'Amount to withdraw'}
                      </span>
                      <span className="text-zinc-500">
                        Balance: {supplyMode === 'supply' 
                          ? formatNumber(minter.mimBalance) + ' MIM'
                          : formatNumber(vault.sMIMBalance) + ' sMIM'
                        }
                      </span>
                    </div>
                    <div className="flex items-center gap-3 pb-3 border-b border-zinc-700">
                      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                          {supplyMode === 'supply' ? 'M' : 'S'}
                        </div>
                        <span className="text-zinc-100">
                          {supplyMode === 'supply' ? 'MIM' : 'sMIM'}
                        </span>
                      </div>
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={supplyAmount}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (/^\d*\.?\d*$/.test(value)) {
                              setSupplyAmount(value);
                            }
                          }}
                          placeholder="0.0"
                          className="flex-1 bg-transparent text-zinc-100 text-right outline-none placeholder:text-zinc-700"
                        />
                        <button
                          onClick={() => setSupplyAmount(
                            truncateDecimals(supplyMode === 'supply' ? minter.mimBalance : vault.sMIMBalance, 6)
                          )}
                          className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 transition-colors text-sm"
                        >
                          MAX
                        </button>
                      </div>
                    </div>
                    {supplyAmount && (
                      <div className="mt-2 text-right text-zinc-600">
                        ≈ {supplyUsdValue}
                      </div>
                    )}
                  </div>

                  {/* Yield Preview */}
                  {supplyMode === 'supply' && supplyAmount && parseFloat(supplyAmount) > 0 && (
                    <div className="p-4 bg-zinc-800/50 rounded-lg mb-6 space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500">You will receive</span>
                        <span className="text-zinc-100">{formatNumber(supplyAmount, 6)} sMIM</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500">Estimated yearly earnings</span>
                        <span className="text-emerald-400">
                          +${formatNumber(parseFloat(supplyAmount.replace(/,/g, '') || '0') * (currentAPR / 100))}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* sMIM Info */}
                  <div className="p-4 bg-zinc-800/50 rounded-lg mb-6">
                    <div className="flex items-start gap-3">
                      <Info className="w-4 h-4 text-zinc-500 mt-0.5" />
                      <div className="text-sm text-zinc-400">
                        {supplyMode === 'supply' 
                          ? 'sMIM is an interest-bearing token. Its value increases over time as the vault earns lending fees from Zero IL vaults.'
                          : 'Withdraw your sMIM to receive MIM plus accumulated interest. No lock-up period required.'
                        }
                      </div>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    disabled={!isConnected || !isOnHubChain || !supplyAmount || parseFloat(supplyAmount) <= 0 || isSupplying || isApproving}
                    onClick={handleSupply}
                    className="w-full py-4 bg-zinc-100 hover:bg-white text-zinc-950 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
                  >
                    {(isSupplying || isApproving) && <Loader2 className="w-4 h-4 animate-spin" />}
                    {!isConnected 
                      ? 'Connect Wallet' 
                      : !isOnHubChain
                        ? 'Switch to Sonic'
                        : isApproving
                          ? 'Approving...'
                          : isSupplying 
                            ? (supplyMode === 'supply' ? 'Supplying...' : 'Withdrawing...')
                            : (supplyMode === 'supply' ? 'Supply MIM' : 'Withdraw sMIM')
                    }
                  </motion.button>
                </div>
              )}

              {/* Positions Tab */}
              {activeTab === 'Positions' && (
                <div className="space-y-6">
                  {/* User Position Summary */}
                  <div className="p-6 bg-zinc-900/30 rounded-xl">
                    <h3 className="text-zinc-100 mb-6">Your Position</h3>
                    
                    {isConnected && isOnHubChain ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* MIM Balance */}
                        <div className="p-4 bg-zinc-800/30 rounded-lg">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold">
                              M
                            </div>
                            <div>
                              <div className="text-zinc-500 text-sm">MIM Balance</div>
                              <div className="text-zinc-100 text-xl">{formatNumber(minter.mimBalance)}</div>
                            </div>
                          </div>
                          <div className="text-zinc-500 text-sm">≈ ${formatNumber(minter.mimBalance)}</div>
                        </div>

                        {/* sMIM Balance */}
                        <div className="p-4 bg-zinc-800/30 rounded-lg border border-emerald-500/20">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold">
                              S
                            </div>
                            <div>
                              <div className="text-zinc-500 text-sm">sMIM (Staked)</div>
                              <div className="text-zinc-100 text-xl">{formatNumber(vault.sMIMBalance)}</div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-500 text-sm">Value: ${formatNumber(vault.sMIMBalance)}</span>
                            <span className="text-emerald-400 text-sm flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              {formatNumber(currentAPR, 1)}% APR
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="text-zinc-500 mb-4">
                          {!isConnected ? 'Connect your wallet to view positions' : 'Switch to Sonic chain'}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Vault Stats */}
                  {isConnected && isOnHubChain && (
                    <div className="p-6 bg-zinc-900/30 rounded-xl">
                      <h3 className="text-zinc-100 mb-6">Vault Statistics</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-zinc-800/30 rounded-lg">
                          <div className="text-zinc-500 text-sm mb-2">Total Interest Earned</div>
                          <div className="text-emerald-400 text-xl">${formatNumber(vault.totalInterestEarned)}</div>
                        </div>
                        <div className="p-4 bg-zinc-800/30 rounded-lg">
                          <div className="text-zinc-500 text-sm mb-2">Available Liquidity</div>
                          <div className="text-zinc-100 text-xl">${formatNumber(vault.availableLiquidity)}</div>
                        </div>
                        <div className="p-4 bg-zinc-800/30 rounded-lg">
                          <div className="text-zinc-500 text-sm mb-2">Your APR</div>
                          <div className="text-zinc-100 text-xl">{formatNumber(currentAPR, 2)}%</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Right Column - Info Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="space-y-6"
        >
          {/* Max Utilization Warning */}
          {utilization >= 85 && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-yellow-500 font-medium text-sm">High Utilization</div>
                  <div className="text-yellow-500/70 text-sm mt-1">
                    Vault utilization is approaching the 90% cap. New borrows may be limited.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Interest Rate Curve */}
          <div className="p-6 bg-zinc-900/30 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-zinc-100 flex items-center gap-2">
                Interest Rate Curve
                <Info className="w-4 h-4 text-zinc-500" />
              </h3>
              <span className="text-xs text-red-400/70 bg-red-500/10 px-2 py-1 rounded">
                90% Max Cap
              </span>
            </div>

            {/* Rate Model Parameters */}
            <div className="grid grid-cols-2 gap-2 mb-4 p-3 bg-zinc-800/30 rounded-lg text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Base Rate:</span>
                <span className="text-zinc-300">{RATE_MODEL.baseRate}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Multiplier:</span>
                <span className="text-zinc-300">{RATE_MODEL.multiplier}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Kink Point:</span>
                <span className="text-yellow-400">{RATE_MODEL.kink}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Jump Mult:</span>
                <span className="text-red-400">{RATE_MODEL.jumpMultiplier}%</span>
              </div>
            </div>
            
            <div className="space-y-3">
              {INTEREST_RATE_TIERS.map((tier, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-zinc-800/30 rounded-lg"
                >
                  <div>
                    <div className="text-zinc-100 text-sm">{tier.utilization}</div>
                    <div className="text-zinc-500 text-xs">{tier.label}</div>
                  </div>
                  <div className="text-zinc-100">{tier.rate}</div>
                </div>
              ))}
            </div>

            {/* Utilization Bar */}
            <div className="mt-6">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-zinc-500">Current Utilization</span>
                <span className="text-zinc-100">{formatNumber(utilization, 1)}% / {MAX_UTILIZATION}%</span>
              </div>
              <div className="relative h-3 bg-zinc-800 rounded-full overflow-hidden">
                {/* 80% kink point indicator */}
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-yellow-500/60 z-10"
                  style={{ left: `${(RATE_MODEL.kink / MAX_UTILIZATION) * 100}%` }}
                />
                {/* 90% max cap indicator */}
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-red-500/70 z-10"
                  style={{ left: '100%', transform: 'translateX(-2px)' }}
                />
                <div 
                  className={`h-full transition-all ${
                    utilization >= RATE_MODEL.kink 
                      ? 'bg-gradient-to-r from-emerald-500 via-yellow-500 to-red-500' 
                      : utilization >= 60
                        ? 'bg-gradient-to-r from-emerald-500 to-yellow-400'
                        : 'bg-emerald-500'
                  }`}
                  style={{ width: `${(utilization / MAX_UTILIZATION) * 100}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-zinc-600">0%</span>
                <span className="text-yellow-400/70">{RATE_MODEL.kink}% kink</span>
                <span className="text-red-400/70">{MAX_UTILIZATION}% cap</span>
              </div>
            </div>
          </div>

          {/* Protocol Info */}
          <div className="p-6 bg-zinc-900/30 rounded-xl">
            <h3 className="text-zinc-100 mb-4">How it works</h3>
            
            <div className="space-y-4 text-sm text-zinc-400">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 text-xs flex-shrink-0">
                  1
                </div>
                <p>Mint MIM 1:1 with sUSDC through the protocol</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 text-xs flex-shrink-0">
                  2
                </div>
                <p>Supply MIM to the StakingVault and receive sMIM</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 text-xs flex-shrink-0">
                  3
                </div>
                <p>sMIM earns yield from Zero IL vault borrowing fees</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 text-xs flex-shrink-0">
                  4
                </div>
                <p>Withdraw anytime - sMIM converts back to MIM + earnings</p>
              </div>
            </div>

            {/* 90% Cap Notice */}
            <div className="mt-4 pt-4 border-t border-zinc-800">
              <div className="flex items-start gap-2 text-sm">
                <Shield className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                <p className="text-zinc-500">
                  <span className="text-zinc-400">90% Utilization Cap:</span> Protocol limits borrowing to maintain healthy liquidity for withdrawals.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
