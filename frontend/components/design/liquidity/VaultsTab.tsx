"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  TrendingUp, 
  Wallet, 
  Info, 
  ExternalLink,
  Lock,
  Loader2
} from 'lucide-react';
import { useAccount, useSwitchChain } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { useAllZeroILVaults } from '@/lib/contracts/magicpool/useZeroILVault';
import { useMIMStaking } from '@/lib/contracts/0IL/use0IL';

// Hub chain ID (Sonic)
const HUB_CHAIN_ID = 146;

export function VaultsTab() {
  const { isConnected, chainId, address } = useAccount();
  const { switchChain } = useSwitchChain();
  const [selectedVault, setSelectedVault] = useState<'sWETH' | 'sWBTC' | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [actionMode, setActionMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Hook into real contracts
  const { wethVault, wbtcVault, refetchAll } = useAllZeroILVaults();
  
  // Get sMIM vault data for available liquidity calculation
  const { totalAssets: sMIMTotalAssets, totalBorrows: sMIMTotalBorrows } = useMIMStaking();
  
  // Calculate available liquidity: (totalAssets * 0.9) - totalBorrows
  const maxUtilization = 0.9; // 90% max utilization
  const totalAssetsNum = parseFloat(sMIMTotalAssets || '0');
  const totalBorrowsNum = parseFloat(sMIMTotalBorrows || '0');
  const availableLiquidity = Math.max(0, (totalAssetsNum * maxUtilization) - totalBorrowsNum);

  // Check if on correct chain
  const isOnHubChain = chainId === HUB_CHAIN_ID;

  // Format numbers for display
  const formatNumber = (value: string | number, decimals = 2) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0.00';
    return num.toLocaleString(undefined, { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    });
  };

  // Format USD
  const formatUSD = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '$0.00';
    return '$' + num.toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  // Build vault data from hooks
  const vaults = [
    {
      id: 'sWETH' as const,
      name: 'sWETH Vault',
      asset: 'sWETH',
      wToken: 'wsWETH',
      icon: '⟠',
      iconBg: 'from-blue-400 to-blue-600',
      description: 'Zero IL sWETH exposure with 2x leveraged LP',
      tvl: formatUSD(parseFloat(wethVault.totalDeposited) * wethVault.assetPrice),
      totalDeposits: `${formatNumber(wethVault.totalDeposited, 4)} sWETH`,
      apr: `${formatNumber(wethVault.apr, 1)}%`,
      utilization: `${formatNumber(wethVault.currentDTV, 1)}%`,
      userDeposit: wethVault.wTokenBalance,
      userValue: formatUSD(parseFloat(wethVault.wTokenBalance) * wethVault.assetPrice),
      dtv: '50%',
      leverage: '2x',
      decimals: 18,
      vault: wethVault,
      isActive: true, // Vault is deployed and functional
    },
    {
      id: 'sWBTC' as const,
      name: 'sWBTC Vault',
      asset: 'sWBTC',
      wToken: 'wBTC',
      icon: '₿',
      iconBg: 'from-orange-400 to-orange-600',
      description: 'Zero IL sWBTC exposure with 2x leveraged LP',
      tvl: formatUSD(parseFloat(wbtcVault.totalDeposited) * wbtcVault.assetPrice),
      totalDeposits: `${formatNumber(wbtcVault.totalDeposited, 6)} sWBTC`,
      apr: `${formatNumber(wbtcVault.apr, 1)}%`,
      utilization: `${formatNumber(wbtcVault.currentDTV, 1)}%`,
      userDeposit: wbtcVault.wTokenBalance,
      userValue: formatUSD(parseFloat(wbtcVault.wTokenBalance) * wbtcVault.assetPrice),
      dtv: '50%',
      leverage: '2x',
      decimals: 8,
      vault: wbtcVault,
      isActive: true, // Vault now deployed and functional!
    },
  ];

  // Get selected vault data
  const getSelectedVaultData = () => {
    if (!selectedVault) return null;
    return vaults.find(v => v.id === selectedVault);
  };

  // Calculate total TVL (only from active vaults)
  const activeVaults = vaults.filter(v => v.isActive);
  const totalTVL = activeVaults.reduce((sum, v) => {
    const tvl = parseFloat(v.vault.totalDeposited) * v.vault.assetPrice;
    return sum + (isNaN(tvl) ? 0 : tvl);
  }, 0);

  // Calculate average APR (only from active vaults)
  const avgAPR = activeVaults.length > 0 
    ? activeVaults.reduce((sum, v) => sum + v.vault.apr, 0) / activeVaults.length 
    : 0;

  // Calculate user total deposits (only from active vaults)
  const userTotalValue = activeVaults.reduce((sum, v) => {
    const val = parseFloat(v.vault.wTokenBalance) * v.vault.assetPrice;
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  // Handle deposit/withdraw
  const handleAction = async () => {
    if (!selectedVault || !depositAmount || parseFloat(depositAmount) <= 0 || !isOnHubChain) return;
    
    const vaultData = getSelectedVaultData();
    if (!vaultData) return;
    
    const amountBigInt = parseUnits(depositAmount, vaultData.decimals);
    
    try {
      if (actionMode === 'deposit') {
        // Check if approval needed
        if (vaultData.vault.needsApproval(amountBigInt)) {
          setIsApproving(true);
          await vaultData.vault.approveAsset(amountBigInt * BigInt(2));
          setIsApproving(false);
        }
        
        setIsProcessing(true);
        await vaultData.vault.deposit(amountBigInt);
      } else {
        setIsProcessing(true);
        await vaultData.vault.withdraw(amountBigInt);
      }
      
      setDepositAmount('');
      setSelectedVault(null);
      refetchAll();
    } catch (error) {
      console.error('Action failed:', error);
    } finally {
      setIsProcessing(false);
      setIsApproving(false);
    }
  };

  // Refetch on mount
  useEffect(() => {
    if (isConnected && isOnHubChain) {
      refetchAll();
    }
  }, [isConnected, isOnHubChain]);

  return (
    <div>
      {/* Hero Section */}
      <div className="mb-12">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <h1 className="text-4xl text-zinc-100">Zero IL Vaults</h1>
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Zero Impermanent Loss
              </span>
            </div>
            <p className="text-zinc-400 mb-3 max-w-2xl">
              Deposit sWETH or sWBTC to earn yield without impermanent loss. Our 2x leverage mechanism 
              mathematically eliminates IL by transforming √p growth to linear p growth. Your deposit 
              tracks the asset price 1:1 while earning trading fees from Uniswap V3 concentrated liquidity.
            </p>
            <a href="#" className="text-zinc-500 hover:text-zinc-300 transition-colors inline-flex items-center gap-1 mb-4">
              Learn how Zero IL works <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-zinc-900/30 rounded-xl">
            <div className="flex items-center gap-2 text-zinc-500 text-sm mb-2">
              <Lock className="w-4 h-4" />
              Total Value Locked
            </div>
            <div className="text-zinc-100 text-2xl">{formatUSD(totalTVL)}</div>
          </div>
          <div className="p-4 bg-zinc-900/30 rounded-xl">
            <div className="flex items-center gap-2 text-zinc-500 text-sm mb-2">
              <TrendingUp className="w-4 h-4" />
              Avg APR
            </div>
            <div className="text-emerald-400 text-2xl">{formatNumber(avgAPR, 1)}%</div>
          </div>
          <div className="p-4 bg-zinc-900/30 rounded-xl">
            <div className="flex items-center gap-2 text-zinc-500 text-sm mb-2">
              <Lock className="w-4 h-4" />
              Available Liquidity
            </div>
            <div className="text-zinc-100 text-2xl">{formatUSD(availableLiquidity)}</div>
          </div>
          <div className="p-4 bg-zinc-900/30 rounded-xl">
            <div className="flex items-center gap-2 text-zinc-500 text-sm mb-2">
              <Wallet className="w-4 h-4" />
              Your Deposits
            </div>
            <div className="text-zinc-100 text-2xl">{formatUSD(userTotalValue)}</div>
          </div>
        </div>
      </div>

      {/* Vaults Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
        {vaults.map((vault, index) => (
          <motion.div
            key={vault.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="p-6 bg-zinc-900/30 rounded-xl hover:bg-zinc-900/40 transition-colors"
          >
            {/* Vault Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${vault.iconBg} flex items-center justify-center text-white text-2xl font-bold shadow-lg`}>
                  {vault.icon}
                </div>
                <div>
                  <h3 className="text-zinc-100 text-xl">{vault.name}</h3>
                  <p className="text-zinc-500 text-sm">{vault.description}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-emerald-400 text-2xl font-medium">{vault.apr}</div>
                <div className="text-zinc-500 text-sm">APR</div>
              </div>
            </div>

            {/* Vault Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <div className="text-zinc-500 text-sm mb-1">TVL</div>
                <div className="text-zinc-100">{vault.tvl}</div>
              </div>
              <div>
                <div className="text-zinc-500 text-sm mb-1">Total Deposits</div>
                <div className="text-zinc-100">{vault.totalDeposits}</div>
              </div>
              <div>
                <div className="text-zinc-500 text-sm mb-1">DTV Ratio</div>
                <div className="text-zinc-100">{vault.utilization}</div>
              </div>
            </div>

            {/* Zero IL Badge */}
            <div className="flex items-center gap-4 p-3 bg-zinc-800/50 rounded-lg mb-6">
              <div className="flex items-center gap-2 text-sm">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="text-zinc-400">Zero IL</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                <span className="text-zinc-400">{vault.leverage} Leverage</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Lock className="w-4 h-4 text-yellow-400" />
                <span className="text-zinc-400">{vault.dtv} DTV</span>
              </div>
            </div>

            {/* User Position (if any) */}
            {isConnected && parseFloat(vault.userDeposit) > 0 && (
              <div className="p-4 bg-zinc-800/30 rounded-lg mb-6 border border-zinc-700/50">
                <div className="text-zinc-500 text-sm mb-3">Your Position</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-zinc-400 text-xs mb-1">Deposited</div>
                    <div className="text-zinc-100">{formatNumber(vault.userDeposit, 6)} {vault.wToken}</div>
                  </div>
                  <div>
                    <div className="text-zinc-400 text-xs mb-1">Value</div>
                    <div className="text-zinc-100">{vault.userValue}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {vault.isActive ? (
                <button
                  onClick={() => {
                    setSelectedVault(vault.id);
                    setActionMode('deposit');
                  }}
                  className="flex-1 py-3 bg-zinc-100 hover:bg-white text-zinc-950 rounded-lg transition-all font-medium"
                >
                  Deposit {vault.asset}
                </button>
              ) : (
                <button
                  disabled
                  className="flex-1 py-3 bg-zinc-800 text-zinc-500 rounded-lg cursor-not-allowed font-medium"
                >
                  Coming Soon
                </button>
              )}
              {isConnected && vault.isActive && parseFloat(vault.userDeposit) > 0 && (
                <button
                  onClick={() => {
                    setSelectedVault(vault.id);
                    setActionMode('withdraw');
                  }}
                  className="px-6 py-3 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-zinc-100 rounded-lg transition-all"
                >
                  Withdraw
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* How Zero IL Works */}
      <div className="p-6 bg-zinc-900/30 rounded-xl">
        <h3 className="text-zinc-100 mb-4 flex items-center gap-2">
          How Zero IL Works
          <Info className="w-4 h-4 text-zinc-500" />
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4 text-sm text-zinc-400">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 text-xs flex-shrink-0">
                1
              </div>
              <p>Deposit sWETH or sWBTC to receive wrapped tokens</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 text-xs flex-shrink-0">
                2
              </div>
              <p>Protocol borrows MIM at 50% DTV ratio (2x leverage)</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 text-xs flex-shrink-0">
                3
              </div>
              <p>Assets + MIM deployed to Uniswap V3 concentrated LP</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 text-xs flex-shrink-0">
                4
              </div>
              <p>2x leverage transforms √p growth → linear p = Zero IL</p>
            </div>
          </div>

          <div className="p-4 bg-zinc-800/50 rounded-lg">
            <div className="text-zinc-300 mb-3 font-medium">The Math</div>
            <div className="font-mono text-xs text-zinc-400 space-y-2">
              <div>Traditional LP: Value = √(p_new/p_old) × Initial</div>
              <div className="text-emerald-400">With 2x Leverage: Value ≈ (p_new/p_old) × Initial</div>
              <div className="pt-2 border-t border-zinc-700 mt-2 text-zinc-300">
                Result: Your position tracks asset price 1:1
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Deposit/Withdraw Modal */}
      <AnimatePresence>
        {selectedVault && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedVault(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md"
            >
              {(() => {
                const vaultData = getSelectedVaultData();
                if (!vaultData) return null;

                const balance = actionMode === 'deposit' 
                  ? vaultData.vault.assetBalance 
                  : vaultData.vault.wTokenBalance;

                return (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${vaultData.iconBg} flex items-center justify-center text-white text-xl font-bold`}>
                          {vaultData.icon}
                        </div>
                        <div>
                          <h3 className="text-zinc-100">{actionMode === 'deposit' ? 'Deposit' : 'Withdraw'}</h3>
                          <p className="text-zinc-500 text-sm">{vaultData.name}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedVault(null)}
                        className="text-zinc-500 hover:text-zinc-300"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Chain warning */}
                    {!isOnHubChain && (
                      <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                        <div className="text-yellow-500 text-sm flex items-center gap-2">
                          Please switch to Sonic chain
                          <button
                            onClick={() => switchChain?.({ chainId: HUB_CHAIN_ID })}
                            className="ml-auto px-3 py-1 bg-yellow-500 text-black rounded text-xs"
                          >
                            Switch
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Toggle */}
                    <div className="flex items-center gap-2 mb-6">
                      <button
                        onClick={() => setActionMode('deposit')}
                        className={`flex-1 py-2 rounded-lg transition-colors ${
                          actionMode === 'deposit'
                            ? 'bg-zinc-100 text-zinc-950'
                            : 'bg-zinc-800/50 text-zinc-400'
                        }`}
                      >
                        Deposit
                      </button>
                      <button
                        onClick={() => setActionMode('withdraw')}
                        className={`flex-1 py-2 rounded-lg transition-colors ${
                          actionMode === 'withdraw'
                            ? 'bg-zinc-100 text-zinc-950'
                            : 'bg-zinc-800/50 text-zinc-400'
                        }`}
                      >
                        Withdraw
                      </button>
                    </div>

                    {/* Amount Input */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-zinc-500 text-sm">Amount</span>
                        <span className="text-zinc-500 text-sm">
                          Balance: {formatNumber(balance, 6)} {actionMode === 'deposit' ? vaultData.asset : vaultData.wToken}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
                        <input
                          type="text"
                          value={depositAmount}
                          onChange={(e) => {
                            if (/^\d*\.?\d*$/.test(e.target.value)) {
                              setDepositAmount(e.target.value);
                            }
                          }}
                          placeholder="0.0"
                          className="flex-1 bg-transparent text-zinc-100 text-xl outline-none placeholder:text-zinc-600"
                        />
                        <button
                          onClick={() => setDepositAmount(balance)}
                          className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-300 text-sm"
                        >
                          MAX
                        </button>
                        <span className="text-zinc-400">{actionMode === 'deposit' ? vaultData.asset : vaultData.wToken}</span>
                      </div>
                      {/* USD Value */}
                      {depositAmount && parseFloat(depositAmount) > 0 && (
                        <p className="text-zinc-500 text-xs mt-1 ml-1">
                          ≈ ${formatNumber(parseFloat(depositAmount) * vaultData.vault.assetPrice, 2)}
                        </p>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3 bg-zinc-800/30 rounded-lg mb-6 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">You receive</span>
                        <span className="text-zinc-100">
                          {depositAmount || '0'} {actionMode === 'deposit' ? vaultData.wToken : vaultData.asset}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Current APR</span>
                        <span className="text-emerald-400">{vaultData.apr}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Zero IL Protection</span>
                        <span className="text-zinc-100 flex items-center gap-1">
                          <Shield className="w-3 h-3 text-emerald-400" />
                          Active
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={handleAction}
                      disabled={!isOnHubChain || !depositAmount || parseFloat(depositAmount) <= 0 || isProcessing || isApproving}
                      className="w-full py-4 bg-zinc-100 hover:bg-white text-zinc-950 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                    >
                      {(isProcessing || isApproving) && <Loader2 className="w-4 h-4 animate-spin" />}
                      {isApproving 
                        ? 'Approving...' 
                        : isProcessing 
                          ? (actionMode === 'deposit' ? 'Depositing...' : 'Withdrawing...')
                          : (actionMode === 'deposit' ? `Deposit ${vaultData.asset}` : `Withdraw ${vaultData.asset}`)
                      }
                    </button>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
