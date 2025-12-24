'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';

/**
 * Contract addresses - UPDATE AFTER DEPLOYMENT
 */
const CONTRACTS = {
  sUSDC: '0x29219dd400f2Bf60E5a23d13Be72B486D4038894',
  MIM: '0x0000000000000000000000000000000000000000', // Update after deploy
  sMIM: '0x0000000000000000000000000000000000000000', // Update after deploy
  MIMMinter: '0x0000000000000000000000000000000000000000', // Update after deploy
};

/**
 * Token decimals - FIX BUG-004: Correct decimal handling
 */
const DECIMALS = {
  sUSDC: 6,  // sUSDC has 6 decimals
  MIM: 6,    // MIM has 6 decimals (matching USDC)
  sMIM: 18,  // sMIM has 18 decimals (standard ERC20)
};

/**
 * ABIs for contract interactions
 */
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
] as const;

const MINTER_ABI = [
  'function mint(uint256 amount) returns (uint256)',
  'function redeem(uint256 amount) returns (uint256)',
  'function getPoolStats() view returns (uint256, uint256, uint256, uint128, int24)',
] as const;

const VAULT_ABI = [
  'function deposit(uint256 assets) returns (uint256)',
  'function withdraw(uint256 shares) returns (uint256)',
  'function convertToShares(uint256 assets) view returns (uint256)',
  'function convertToAssets(uint256 shares) view returns (uint256)',
  'function maxWithdrawableAssets(address) view returns (uint256)',
  'function utilizationRate() view returns (uint256)',
  'function supplyRate() view returns (uint256)',
] as const;

type Tab = 'mint' | 'supply' | 'redeem' | 'withdraw';

export default function USDWPageFixed() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<Tab>('mint');
  const [amount, setAmount] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============ Balance Queries ============

  // sUSDC balance
  const { data: sUSDCBalance } = useBalance({
    address,
    token: CONTRACTS.sUSDC as `0x${string}`,
  });

  // MIM balance
  const { data: mimBalance } = useBalance({
    address,
    token: CONTRACTS.MIM as `0x${string}`,
  });

  // sMIM balance
  const { data: smimBalance } = useBalance({
    address,
    token: CONTRACTS.sMIM as `0x${string}`,
  });

  // ============ Allowance Queries ============

  const { data: sUSDCAllowance } = useReadContract({
    address: CONTRACTS.sUSDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACTS.MIMMinter as `0x${string}`] : undefined,
  });

  const { data: mimAllowance } = useReadContract({
    address: CONTRACTS.MIM as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACTS.sMIM as `0x${string}`] : undefined,
  });

  // ============ Vault Stats ============

  const { data: maxWithdrawable } = useReadContract({
    address: CONTRACTS.sMIM as `0x${string}`,
    abi: VAULT_ABI,
    functionName: 'maxWithdrawableAssets',
    args: address ? [address] : undefined,
  });

  const { data: utilizationRate } = useReadContract({
    address: CONTRACTS.sMIM as `0x${string}`,
    abi: VAULT_ABI,
    functionName: 'utilizationRate',
  });

  const { data: supplyRate } = useReadContract({
    address: CONTRACTS.sMIM as `0x${string}`,
    abi: VAULT_ABI,
    functionName: 'supplyRate',
  });

  // ============ Write Functions ============

  const { writeContract, data: txHash, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // ============ Helpers ============

  /**
   * Get the correct decimals for current operation
   * FIX BUG-004: Use correct decimals for each token
   */
  const getDecimals = (): number => {
    switch (activeTab) {
      case 'mint':
        return DECIMALS.sUSDC; // Input is sUSDC (6 decimals)
      case 'redeem':
        return DECIMALS.MIM;   // Input is MIM (6 decimals)
      case 'supply':
        return DECIMALS.MIM;   // Input is MIM (6 decimals)
      case 'withdraw':
        return DECIMALS.sMIM;  // Input is sMIM (18 decimals)
      default:
        return 18;
    }
  };

  /**
   * Get current balance for display
   */
  const getCurrentBalance = (): string => {
    switch (activeTab) {
      case 'mint':
        return sUSDCBalance?.formatted || '0';
      case 'redeem':
      case 'supply':
        return mimBalance?.formatted || '0';
      case 'withdraw':
        return smimBalance?.formatted || '0';
      default:
        return '0';
    }
  };

  /**
   * Get current balance value (bigint)
   */
  const getCurrentBalanceValue = (): bigint => {
    switch (activeTab) {
      case 'mint':
        return sUSDCBalance?.value || 0n;
      case 'redeem':
      case 'supply':
        return mimBalance?.value || 0n;
      case 'withdraw':
        return smimBalance?.value || 0n;
      default:
        return 0n;
    }
  };

  /**
   * Validate amount before transaction
   * FIX BUG-010: Add balance pre-check
   */
  const validateAmount = (): boolean => {
    setError(null);

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return false;
    }

    const decimals = getDecimals();
    const amountBigInt = parseUnits(amount, decimals);
    const balance = getCurrentBalanceValue();

    if (amountBigInt > balance) {
      setError('Insufficient balance');
      return false;
    }

    return true;
  };

  /**
   * Check if approval is needed
   */
  const needsApproval = (): boolean => {
    if (!amount) return false;

    const decimals = getDecimals();
    const amountBigInt = parseUnits(amount, decimals);

    if (activeTab === 'mint') {
      return (sUSDCAllowance as bigint || 0n) < amountBigInt;
    }
    if (activeTab === 'supply') {
      return (mimAllowance as bigint || 0n) < amountBigInt;
    }

    return false;
  };

  /**
   * Handle approve
   * FIX BUG-011: Remove 2x approval logic, use exact amount or max
   */
  const handleApprove = async () => {
    if (!validateAmount()) return;

    setIsApproving(true);
    const decimals = getDecimals();
    const amountBigInt = parseUnits(amount, decimals);

    try {
      if (activeTab === 'mint') {
        writeContract({
          address: CONTRACTS.sUSDC as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [CONTRACTS.MIMMinter as `0x${string}`, amountBigInt],
        });
      } else if (activeTab === 'supply') {
        writeContract({
          address: CONTRACTS.MIM as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [CONTRACTS.sMIM as `0x${string}`, amountBigInt],
        });
      }
    } catch (err) {
      setError('Approval failed');
      console.error(err);
    } finally {
      setIsApproving(false);
    }
  };

  /**
   * Handle main action (mint/redeem/supply/withdraw)
   */
  const handleAction = async () => {
    if (!validateAmount()) return;

    const decimals = getDecimals();
    const amountBigInt = parseUnits(amount, decimals);

    try {
      switch (activeTab) {
        case 'mint':
          writeContract({
            address: CONTRACTS.MIMMinter as `0x${string}`,
            abi: MINTER_ABI,
            functionName: 'mint',
            args: [amountBigInt],
          });
          break;

        case 'redeem':
          // FIX BUG-004: Use correct 6 decimals for MIM
          writeContract({
            address: CONTRACTS.MIMMinter as `0x${string}`,
            abi: MINTER_ABI,
            functionName: 'redeem',
            args: [amountBigInt],
          });
          break;

        case 'supply':
          writeContract({
            address: CONTRACTS.sMIM as `0x${string}`,
            abi: VAULT_ABI,
            functionName: 'deposit',
            args: [amountBigInt],
          });
          break;

        case 'withdraw':
          writeContract({
            address: CONTRACTS.sMIM as `0x${string}`,
            abi: VAULT_ABI,
            functionName: 'withdraw',
            args: [amountBigInt],
          });
          break;
      }
    } catch (err) {
      setError('Transaction failed');
      console.error(err);
    }
  };

  /**
   * Set max amount
   */
  const handleSetMax = () => {
    const balance = getCurrentBalance();
    // Truncate to avoid precision issues
    const truncated = parseFloat(balance).toFixed(getDecimals() === 6 ? 6 : 8);
    setAmount(truncated);
  };

  // Clear error on amount change
  useEffect(() => {
    setError(null);
  }, [amount, activeTab]);

  // ============ Render ============

  return (
    <div className="max-w-md mx-auto p-6 bg-gray-900 rounded-xl">
      <h2 className="text-2xl font-bold text-white mb-6">MIM Stablecoin</h2>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        {(['mint', 'supply', 'redeem', 'withdraw'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setAmount('');
            }}
            className={`px-4 py-2 rounded-lg capitalize ${
              activeTab === tab
                ? 'bg-emerald-500 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Input Section */}
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <div className="flex justify-between mb-2">
          <span className="text-gray-400 text-sm">
            {activeTab === 'mint' && 'sUSDC'}
            {activeTab === 'redeem' && 'MIM'}
            {activeTab === 'supply' && 'MIM'}
            {activeTab === 'withdraw' && 'sMIM'}
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
          <span className="text-gray-400 text-sm">You Receive</span>
        </div>
        <div className="text-white text-2xl">
          {amount ? parseFloat(amount).toFixed(4) : '0.00'}{' '}
          <span className="text-gray-400 text-lg">
            {activeTab === 'mint' && 'MIM'}
            {activeTab === 'redeem' && 'sUSDC'}
            {activeTab === 'supply' && 'sMIM'}
            {activeTab === 'withdraw' && 'MIM'}
          </span>
        </div>
      </div>

      {/* Vault Stats (for supply/withdraw) */}
      {(activeTab === 'supply' || activeTab === 'withdraw') && (
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <h3 className="text-gray-400 text-sm mb-2">Vault Stats</h3>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Supply APY</span>
              <span className="text-emerald-400">
                {supplyRate ? (Number(supplyRate) / 1e16).toFixed(2) : '0'}%
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Utilization</span>
              <span className="text-white">
                {utilizationRate ? (Number(utilizationRate) / 1e16).toFixed(2) : '0'}%
              </span>
            </div>
            {activeTab === 'withdraw' && maxWithdrawable && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Max Withdrawable</span>
                <span className="text-white">
                  {formatUnits(maxWithdrawable as bigint, DECIMALS.MIM)} MIM
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
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
          disabled={isApproving || isPending || isConfirming}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-50"
        >
          {isApproving || isPending || isConfirming ? 'Approving...' : 'Approve'}
        </button>
      ) : (
        <button
          onClick={handleAction}
          disabled={!amount || parseFloat(amount) <= 0 || isPending || isConfirming}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-50 capitalize"
        >
          {isPending || isConfirming ? 'Processing...' : activeTab}
        </button>
      )}

      {/* Transaction Status */}
      {txHash && (
        <div className="mt-4 p-3 bg-gray-800 rounded-lg">
          <p className="text-gray-400 text-sm">
            Transaction: {txHash.slice(0, 10)}...{txHash.slice(-8)}
          </p>
          {isConfirming && <p className="text-yellow-400 text-sm">Confirming...</p>}
          {isSuccess && <p className="text-emerald-400 text-sm">Success!</p>}
        </div>
      )}
    </div>
  );
}
