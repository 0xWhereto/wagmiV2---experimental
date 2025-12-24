'use client';

import Navigation from '@/components/Navigation';
import { useAccount, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';

// Placeholder contract addresses - update after deployment
const CONTRACTS = {
  MIM: '0x0000000000000000000000000000000000000000',
  sMIM: '0x0000000000000000000000000000000000000000',
  wETH: '0x0000000000000000000000000000000000000000',
  LeverageAMM: '0x0000000000000000000000000000000000000000',
};

export default function DashboardPage() {
  const { address, isConnected } = useAccount();

  // These would be populated with actual contract reads
  const protocolStats = {
    totalValueLocked: '0',
    totalMIMSupply: '0',
    totalMIMBorrowed: '0',
    utilizationRate: '0',
    currentAPY: '0',
    lastCyclePayment: 'Never',
    nextCyclePayment: 'N/A',
    cycleNumber: '0',
  };

  const userStats = {
    mimBalance: '0',
    smimBalance: '0',
    wethShares: '0',
    pendingRewards: '0',
    estimatedValue: '0',
  };

  return (
    <main className="min-h-screen">
      <Navigation />

      {/* Header */}
      <div className="bg-gradient-to-b from-gray-800/50 to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-4xl font-bold text-white mb-4">Dashboard</h1>
          <p className="text-xl text-gray-400">
            Protocol analytics and your position overview
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Protocol Stats */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Protocol Stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800/50 rounded-xl p-4">
              <p className="text-gray-400 text-sm">Total Value Locked</p>
              <p className="text-2xl font-bold text-white">
                ${protocolStats.totalValueLocked}
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4">
              <p className="text-gray-400 text-sm">MIM Supply</p>
              <p className="text-2xl font-bold text-white">
                {protocolStats.totalMIMSupply} MIM
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4">
              <p className="text-gray-400 text-sm">Utilization Rate</p>
              <p className="text-2xl font-bold text-emerald-400">
                {protocolStats.utilizationRate}%
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4">
              <p className="text-gray-400 text-sm">Current APY</p>
              <p className="text-2xl font-bold text-emerald-400">
                {protocolStats.currentAPY}%
              </p>
            </div>
          </div>
        </div>

        {/* Cycle Info */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Cycle Status</h2>
          <div className="bg-gray-800/50 rounded-xl p-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <p className="text-gray-400 text-sm mb-1">Current Cycle</p>
                <p className="text-xl font-semibold text-white">
                  #{protocolStats.cycleNumber}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1">Last Payment</p>
                <p className="text-xl font-semibold text-white">
                  {protocolStats.lastCyclePayment}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1">Next Payment</p>
                <p className="text-xl font-semibold text-emerald-400">
                  {protocolStats.nextCyclePayment}
                </p>
              </div>
            </div>

            {/* Cycle Progress */}
            <div className="mt-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Cycle Progress</span>
                <span className="text-white">0%</span>
              </div>
              <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                  style={{ width: '0%' }}
                ></div>
              </div>
              <p className="text-gray-500 text-xs mt-2">
                7-hour cycle (test mode) - fees collected and distributed at cycle end
              </p>
            </div>
          </div>
        </div>

        {/* User Position */}
        {isConnected ? (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Your Position</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {/* MIM Staking */}
              <div className="bg-gray-800/50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">MIM Staking</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">MIM Balance</span>
                    <span className="text-white">{userStats.mimBalance} MIM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">sMIM Balance</span>
                    <span className="text-white">{userStats.smimBalance} sMIM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Pending Rewards</span>
                    <span className="text-emerald-400">{userStats.pendingRewards} MIM</span>
                  </div>
                </div>
              </div>

              {/* Vault Position */}
              <div className="bg-gray-800/50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Vault Position</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">wETH Shares</span>
                    <span className="text-white">{userStats.wethShares} wsWETH</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Estimated Value</span>
                    <span className="text-white">${userStats.estimatedValue}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">IL Exposure</span>
                    <span className="text-emerald-400">0% (Protected)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-800/50 rounded-xl p-8 text-center">
            <p className="text-gray-400 mb-4">Connect wallet to view your position</p>
          </div>
        )}

        {/* Fee Distribution Chart Placeholder */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Fee Distribution</h2>
          <div className="bg-gray-800/50 rounded-xl p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-gray-400 text-sm mb-4">Collected Fees</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-white">V3 LP Fees</span>
                    <span className="text-emerald-400">$0.00</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white">Interest Income</span>
                    <span className="text-emerald-400">$0.00</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-gray-400 text-sm mb-4">Distribution</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-white">To sMIM Stakers</span>
                    <span className="text-white">85%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white">To wToken Holders</span>
                    <span className="text-white">~85% of remainder</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white">Protocol Treasury</span>
                    <span className="text-white">15%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
