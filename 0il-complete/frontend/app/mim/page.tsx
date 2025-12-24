import Navigation from '@/components/Navigation';
import USDWPageFixed from '@/components/USDWPageFixed';

export default function MIMPage() {
  return (
    <main className="min-h-screen">
      <Navigation />

      {/* Header */}
      <div className="bg-gradient-to-b from-blue-900/20 to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-4">
              MIM Stablecoin
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Mint MIM with sUSDC, stake to earn yield, or redeem back to sUSDC.
            </p>
          </div>
        </div>
      </div>

      {/* MIM Operations */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <USDWPageFixed />
      </div>

      {/* MIM Info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-800/50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              How MIM Works
            </h3>
            <ul className="space-y-3 text-gray-400 text-sm">
              <li className="flex items-start">
                <span className="text-emerald-400 mr-2">1.</span>
                Deposit sUSDC to mint MIM at 1:1 ratio
              </li>
              <li className="flex items-start">
                <span className="text-emerald-400 mr-2">2.</span>
                Stake MIM in the vault to receive sMIM and earn yield
              </li>
              <li className="flex items-start">
                <span className="text-emerald-400 mr-2">3.</span>
                Yield comes from interest paid by leveraged vaults
              </li>
              <li className="flex items-start">
                <span className="text-emerald-400 mr-2">4.</span>
                Redeem MIM back to sUSDC anytime (subject to liquidity)
              </li>
            </ul>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              Yield Distribution
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">To sMIM Stakers</span>
                  <span className="text-white">85%</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full">
                  <div className="h-2 bg-emerald-500 rounded-full w-[85%]"></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Protocol Treasury</span>
                  <span className="text-white">15%</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full">
                  <div className="h-2 bg-blue-500 rounded-full w-[15%]"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
