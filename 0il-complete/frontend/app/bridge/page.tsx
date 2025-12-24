'use client';

import Navigation from '@/components/Navigation';
import { useState } from 'react';
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';

const CHAINS = {
  sonic: { id: 146, name: 'Sonic', lzEndpoint: 30332 },
  arbitrum: { id: 42161, name: 'Arbitrum', lzEndpoint: 30110 },
  base: { id: 8453, name: 'Base', lzEndpoint: 30184 },
  ethereum: { id: 1, name: 'Ethereum', lzEndpoint: 30101 },
};

const TOKENS = {
  ETH: {
    symbol: 'ETH',
    decimals: 18,
    sonic: '0x50c42dEAcD8Fc9773493ED674b675bE577f2634b', // sWETH
    arbitrum: '0x0000000000000000000000000000000000000000',
    base: '0x0000000000000000000000000000000000000000',
  },
  USDC: {
    symbol: 'USDC',
    decimals: 6,
    sonic: '0x29219dd400f2Bf60E5a23d13Be72B486D4038894', // sUSDC
    arbitrum: '0x0000000000000000000000000000000000000000',
    base: '0x0000000000000000000000000000000000000000',
  },
};

type ChainKey = keyof typeof CHAINS;
type TokenKey = keyof typeof TOKENS;

export default function BridgePage() {
  const { address, isConnected } = useAccount();
  const [fromChain, setFromChain] = useState<ChainKey>('arbitrum');
  const [toChain, setToChain] = useState<ChainKey>('sonic');
  const [selectedToken, setSelectedToken] = useState<TokenKey>('ETH');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const handleBridge = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setError(null);
    // Bridge logic would go here - calls to LayerZero OApp
    console.log('Bridge:', {
      from: fromChain,
      to: toChain,
      token: selectedToken,
      amount,
    });
  };

  const swapChains = () => {
    const temp = fromChain;
    setFromChain(toChain);
    setToChain(temp);
  };

  return (
    <main className="min-h-screen">
      <Navigation />

      {/* Header */}
      <div className="bg-gradient-to-b from-purple-900/20 to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-4">
              Cross-Chain Bridge
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Bridge assets to Sonic using LayerZero for 0IL protocol participation.
            </p>
          </div>
        </div>
      </div>

      {/* Bridge Interface */}
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          {/* From Chain */}
          <div className="mb-4">
            <label className="block text-gray-400 text-sm mb-2">From</label>
            <div className="bg-gray-800 rounded-lg p-4">
              <select
                value={fromChain}
                onChange={(e) => setFromChain(e.target.value as ChainKey)}
                className="w-full bg-transparent text-white outline-none cursor-pointer"
              >
                {Object.entries(CHAINS).map(([key, chain]) => (
                  <option key={key} value={key} className="bg-gray-800">
                    {chain.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Swap Button */}
          <div className="flex justify-center -my-2 relative z-10">
            <button
              onClick={swapChains}
              className="bg-gray-700 hover:bg-gray-600 p-2 rounded-lg transition-colors"
            >
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                />
              </svg>
            </button>
          </div>

          {/* To Chain */}
          <div className="mb-4">
            <label className="block text-gray-400 text-sm mb-2">To</label>
            <div className="bg-gray-800 rounded-lg p-4">
              <select
                value={toChain}
                onChange={(e) => setToChain(e.target.value as ChainKey)}
                className="w-full bg-transparent text-white outline-none cursor-pointer"
              >
                {Object.entries(CHAINS).map(([key, chain]) => (
                  <option key={key} value={key} className="bg-gray-800">
                    {chain.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Token Selection */}
          <div className="mb-4">
            <label className="block text-gray-400 text-sm mb-2">Token</label>
            <div className="flex gap-2">
              {Object.entries(TOKENS).map(([key, token]) => (
                <button
                  key={key}
                  onClick={() => setSelectedToken(key as TokenKey)}
                  className={`flex-1 py-2 rounded-lg ${
                    selectedToken === key
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  {token.symbol}
                </button>
              ))}
            </div>
          </div>

          {/* Amount Input */}
          <div className="mb-6">
            <label className="block text-gray-400 text-sm mb-2">Amount</label>
            <div className="bg-gray-800 rounded-lg p-4">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-transparent text-white text-2xl outline-none"
              />
            </div>
          </div>

          {/* Bridge Fee Estimate */}
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Bridge Fee</span>
              <span className="text-white">~0.0001 ETH</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Estimated Time</span>
              <span className="text-white">~2 minutes</span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-900/50 border border-red-500 rounded-lg p-3 mb-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Bridge Button */}
          {!isConnected ? (
            <button className="w-full py-3 bg-gray-700 text-gray-400 rounded-lg cursor-not-allowed">
              Connect Wallet
            </button>
          ) : fromChain === toChain ? (
            <button className="w-full py-3 bg-gray-700 text-gray-400 rounded-lg cursor-not-allowed">
              Select Different Chains
            </button>
          ) : (
            <button
              onClick={handleBridge}
              disabled={!amount || parseFloat(amount) <= 0 || isPending || isConfirming}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-50"
            >
              {isPending || isConfirming ? 'Bridging...' : 'Bridge'}
            </button>
          )}

          {/* Transaction Status */}
          {txHash && (
            <div className="mt-4 p-3 bg-gray-800 rounded-lg">
              <p className="text-gray-400 text-sm">
                TX: {txHash.slice(0, 10)}...{txHash.slice(-8)}
              </p>
              {isConfirming && <p className="text-yellow-400 text-sm">Confirming...</p>}
              {isSuccess && <p className="text-emerald-400 text-sm">Bridged!</p>}
            </div>
          )}
        </div>

        {/* LayerZero Info */}
        <div className="mt-6 text-center text-gray-500 text-sm">
          <p>Powered by LayerZero V2</p>
          <p className="mt-1">DVN Security: LayerZero + Polyhedra</p>
        </div>
      </div>

      {/* Rescue Section */}
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-yellow-900/20 border border-yellow-500/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-yellow-400 mb-2">
            Asset Recovery
          </h3>
          <p className="text-gray-400 text-sm mb-4">
            If a cross-chain transfer fails, you can recover your assets after a 24-hour timeout period using the rescue function.
          </p>
          <button className="w-full py-2 bg-yellow-600/50 hover:bg-yellow-600/70 text-yellow-200 rounded-lg text-sm">
            Check Pending Deposits
          </button>
        </div>
      </div>
    </main>
  );
}
