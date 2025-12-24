import Navigation from '@/components/Navigation';
import VaultsTabFixed from '@/components/VaultsTabFixed';

export default function Home() {
  return (
    <main className="min-h-screen">
      <Navigation />

      {/* Hero Section */}
      <div className="bg-gradient-to-b from-emerald-900/20 to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-4">
              Zero Impermanent Loss Vaults
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Earn yield on your assets through leveraged liquidity provision
              without exposure to impermanent loss.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-gray-800/50 rounded-xl p-4 text-center">
              <p className="text-gray-400 text-sm">Total Value Locked</p>
              <p className="text-2xl font-bold text-white">$0.00</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 text-center">
              <p className="text-gray-400 text-sm">Protocol Revenue</p>
              <p className="text-2xl font-bold text-emerald-400">$0.00</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 text-center">
              <p className="text-gray-400 text-sm">Active Vaults</p>
              <p className="text-2xl font-bold text-white">1</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 text-center">
              <p className="text-gray-400 text-sm">Cycle Period</p>
              <p className="text-2xl font-bold text-white">7h</p>
            </div>
          </div>
        </div>
      </div>

      {/* Vaults Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <VaultsTabFixed />
      </div>

      {/* Info Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-gray-800/50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2">
              Zero IL Strategy
            </h3>
            <p className="text-gray-400 text-sm">
              Your deposits are wrapped into receipt tokens while the underlying
              assets provide liquidity. You only hold receipts, never LP tokens.
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2">
              2x Leverage
            </h3>
            <p className="text-gray-400 text-sm">
              Protocol borrows MIM against your deposit to double the liquidity
              position, generating higher fees without additional capital.
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2">
              Weekly Fee Distribution
            </h3>
            <p className="text-gray-400 text-sm">
              Fees are collected and distributed every 7 hours (test mode).
              Interest is paid to MIM stakers, remainder to vault depositors.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
