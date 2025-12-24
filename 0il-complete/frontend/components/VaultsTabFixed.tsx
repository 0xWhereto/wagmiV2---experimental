'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';

/**
 * Contract addresses - UPDATE AFTER DEPLOYMENT
 */
const VAULTS = {
  sWETH: {
    underlying: '0x50c42dEAcD8Fc9773493ED674b675bE577f2634b',
    wToken: '0x0000000000000000000000000000000000000000', // Update after deploy
    decimals: 18,
    symbol: 'sWETH',
    name: 'Sonic Wrapped ETH',
  },
};

/**
 * ABIs
 */
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
] as const;

const WTOKEN_ABI = [
  'function deposit(uint256 amount, uint256 minShares) returns (uint256)',
  'function withdraw(uint256 shares, uint256 minUnderlying) returns (uint256)',
  'function pricePerShare() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function totalAssets() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function underlying() view returns (address)',
] as const;

type VaultKey = keyof typeof VAULTS;

interface VaultData {
  key: VaultKey;
  config: typeof VAULTS[VaultKey];
  underlyingBalance: bigint;
  shareBalance: bigint;
  pricePerShare: bigint;
  totalAssets: bigint;
  allowance: bigint;
}

export default function VaultsTabFixed() {
  const { address, isConnected } = useAccount();
  const [selectedVault, setSelectedVault] = useState<VaultKey>('sWETH');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [error, setError] = useState<string | null>(null);

  const vault = VAULTS[selectedVault];

  // ============ Balance Queries ============

  const { data: underlyingBalance } = useBalance({
    address,
    token: vault.underlying as `0x${string}`,
  });

  const { data: shareBalance } = useReadContract({
    address: vault.wToken as `0x${string}`,
    abi: WTOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  // ============ Vault Stats ============

  const { data: pricePerShare } = useReadContract({
    address: vault.wToken as `0x${string}`,
    abi: WTOKEN_ABI,
    functionName: 'pricePerShare',
  });

  const { data: totalAssets } = useReadContract({
    address: vault.wToken as `0x${string}`,
    abi: WTOKEN_ABI,
    functionName: 'totalAssets',
  });

  const { data: allowance } = useReadContract({
    address: vault.underlying as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, vault.wToken as `0x${string}`] : undefined,
  });

  // ============ Write Functions ============

  const { writeContract, data: txHash, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // ============ Helpers ============

  const getCurrentBalance = (): string => {
    if (mode === 'deposit') {
      return underlyingBalance?.formatted || '0';
    }
    if (shareBalance) {
      return formatUnits(shareBalance as bigint, vault.decimals);
    }
    return '0';
  };

  const getCurrentBalanceValue = (): bigint => {
    if (mode === 'deposit') {
      return underlyingBalance?.value || 0n;
    }
    return (shareBalance as bigint) || 0n;
  };

  /**
   * Validate amount
   * FIX BUG-010: Proper balance validation
   */
  const validateAmount = (): boolean => {
    setError(null);

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return false;
    }

    const amountBigInt = parseUnits(amount, vault.decimals);
    const balance = getCurrentBalanceValue();

    if (amountBigInt > balance) {
      setError('Insufficient balance');
      return false;
    }

    return true;
  };

  /**
   * Check if approval needed
   */
  const needsApproval = (): boolean => {
    if (mode !== 'deposit' || !amount) return false;

    const amountBigInt = parseUnits(amount, vault.decimals);
    return (allowance as bigint || 0n) < amountBigInt;
  };

  /**
   * Handle approve
   * FIX BUG-011: Use exact amount, not 2x
   */
  const handleApprove = async () => {
    if (!validateAmount()) return;

    const amountBigInt = parseUnits(amount, vault.decimals);

    writeContract({
      address: vault.underlying as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [vault.wToken as `0x${string}`, amountBigInt],
    });
  };

  /**
   * Handle deposit/withdraw
   */
  const handleAction = async () => {
    if (!validateAmount()) return;

    const amountBigInt = parseUnits(amount, vault.decimals);

    if (mode === 'deposit') {
      writeContract({
        address: vault.wToken as `0x${string}`,
        abi: WTOKEN_ABI,
        functionName: 'deposit',
        args: [amountBigInt, 0n], // 0 minShares for simplicity
      });
    } else {
      writeContract({
        address: vault.wToken as `0x${string}`,
        abi: WTOKEN_ABI,
        functionName: 'withdraw',
        args: [amountBigInt, 0n], // 0 minUnderlying for simplicity
      });
    }
  };

  const handleSetMax = () => {
    const balance = getCurrentBalance();
    setAmount(parseFloat(balance).toFixed(8));
  };

  // Clear error on changes
  useEffect(() => {
    setError(null);
  }, [amount, mode, selectedVault]);

  // Calculate estimated output
  const getEstimatedOutput = (): string => {
    if (!amount || !pricePerShare) return '0.00';

    const amountBigInt = parseUnits(amount, vault.decimals);
    const price = pricePerShare as bigint;

    if (mode === 'deposit') {
      // shares = amount * 1e18 / pricePerShare
      const shares = (amountBigInt * BigInt(1e18)) / price;
      return formatUnits(shares, vault.decimals);
    } else {
      // underlying = shares * pricePerShare / 1e18
      const underlying = (amountBigInt * price) / BigInt(1e18);
      return formatUnits(underlying, vault.decimals);
    }
  };

  // ============ Render ============

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Zero IL Vaults</h2>

      {/* Vault Selection */}
      <div className="grid grid-cols-1 gap-4 mb-6">
        {Object.entries(VAULTS).map(([key, config]) => (
          <div
            key={key}
            onClick={() => setSelectedVault(key as VaultKey)}
            className={`p-4 rounded-lg cursor-pointer transition-all ${
              selectedVault === key
                ? 'bg-emerald-900/50 border-2 border-emerald-500'
                : 'bg-gray-800 border-2 border-transparent hover:border-gray-600'
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-white font-semibold">{config.symbol}</h3>
                <p className="text-gray-400 text-sm">{config.name}</p>
              </div>
              <div className="text-right">
                <p className="text-white">
                  {shareBalance
                    ? formatUnits(shareBalance as bigint, config.decimals)
                    : '0'}{' '}
                  w{config.symbol}
                </p>
                <p className="text-gray-400 text-sm">
                  TVL: {totalAssets ? formatUnits(totalAssets as bigint, config.decimals) : '0'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => {
            setMode('deposit');
            setAmount('');
          }}
          className={`flex-1 py-2 rounded-lg ${
            mode === 'deposit'
              ? 'bg-emerald-500 text-white'
              : 'bg-gray-800 text-gray-400'
          }`}
        >
          Deposit
        </button>
        <button
          onClick={() => {
            setMode('withdraw');
            setAmount('');
          }}
          className={`flex-1 py-2 rounded-lg ${
            mode === 'withdraw'
              ? 'bg-emerald-500 text-white'
              : 'bg-gray-800 text-gray-400'
          }`}
        >
          Withdraw
        </button>
      </div>

      {/* Input */}
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <div className="flex justify-between mb-2">
          <span className="text-gray-400 text-sm">
            {mode === 'deposit' ? vault.symbol : `w${vault.symbol}`}
          </span>
          <span className="text-gray-400 text-sm">
            Balance: {getCurrentBalance()}
          </span>
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="flex-1 bg-transparent text-white text-2xl outline-none"
          />
          <button
            onClick={handleSetMax}
            className="text-emerald-400 text-sm hover:text-emerald-300"
          >
            MAX
          </button>
        </div>
      </div>

      {/* Output Preview */}
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <div className="flex justify-between mb-2">
          <span className="text-gray-400 text-sm">You Receive (Estimated)</span>
        </div>
        <p className="text-white text-2xl">
          {getEstimatedOutput()}{' '}
          <span className="text-gray-400 text-lg">
            {mode === 'deposit' ? `w${vault.symbol}` : vault.symbol}
          </span>
        </p>
      </div>

      {/* Vault Info */}
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <h3 className="text-gray-400 text-sm mb-2">Vault Info</h3>
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Price per Share</span>
            <span className="text-white">
              {pricePerShare
                ? (Number(pricePerShare) / 1e18).toFixed(6)
                : '1.000000'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Total Value Locked</span>
            <span className="text-white">
              {totalAssets
                ? formatUnits(totalAssets as bigint, vault.decimals)
                : '0'}{' '}
              {vault.symbol}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Leverage</span>
            <span className="text-emerald-400">2x</span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-3 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Action Button */}
      {!isConnected ? (
        <button className="w-full py-3 bg-gray-700 text-gray-400 rounded-lg cursor-not-allowed">
          Connect Wallet
        </button>
      ) : needsApproval() ? (
        <button
          onClick={handleApprove}
          disabled={isPending || isConfirming}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-50"
        >
          {isPending || isConfirming ? 'Approving...' : 'Approve'}
        </button>
      ) : (
        <button
          onClick={handleAction}
          disabled={!amount || parseFloat(amount) <= 0 || isPending || isConfirming}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-50 capitalize"
        >
          {isPending || isConfirming ? 'Processing...' : mode}
        </button>
      )}

      {/* Transaction Status */}
      {txHash && (
        <div className="mt-4 p-3 bg-gray-800 rounded-lg">
          <p className="text-gray-400 text-sm">
            TX: {txHash.slice(0, 10)}...{txHash.slice(-8)}
          </p>
          {isConfirming && <p className="text-yellow-400 text-sm">Confirming...</p>}
          {isSuccess && <p className="text-emerald-400 text-sm">Success!</p>}
        </div>
      )}
    </div>
  );
}
