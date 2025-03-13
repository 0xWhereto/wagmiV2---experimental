export const CONTRACT_ADDRESSES = {
  TestCrossChainSwapReceiver: {
    sonic: "0x1bbcE9Fc68E47Cd3E4B6bC3BE64E271bcDb3edf1",
  },
  TestCrossChainSwapSender: {
    base: "0x5AafA963D0D448ba3bE2c5940F1778505AcA9512",
    arbitrum: "0x0b3095Cd06d649b66f38a7a17f02e8Ba000b7baF",
  },
};

// Synthetic tokens on Sonic
export const SYNTHETIC_TOKEN_ADDRESSES = {
  tokenA: "0x1227D8C5Bc62fDdE7FB3c539688E316FA4b665AC",
  tokenB: "0x0c347E8172c52125c8b37876c721b2f545dEFF38",
};

// Default token addresses from README.md
export const TOKEN_ADDRESSES = {
  base: {
    tokenA: "0xa2C0a17Af854031C82d5649cf211D66c5dC3C95a",
    tokenB: "0x4596750bb7fDd5e46A65F2913A1b8B15E4BD2aB8",
  },
  arbitrum: {
    tokenA: "0xb8B6513f59fd537f372B4fccF0590aEA3B38b429",
    tokenB: "0x569eC1dd4f669696977265c2DB0e4468A6084064",
  },
};

// Add constants from useSwap.js
export const CONSTANTS = {
  // Gas limit for the swap transaction
  GAS_LIMIT: 700000,

  // Fee buffer percentage (10% buffer)
  FEE_BUFFER_PERCENT: 110,

  // Sonic RPC URL
  SONIC_RPC_URL: "https://rpc.soniclabs.com",
};

// Network names mapping
export const CHAIN_NAMES = {
  30332: "Sonic",
  30184: "Base",
  30110: "Arbitrum",
};

export const TOKENS = {
  base: [
    {
      symbol: "TokenA",
      name: "Test Token A",
      address: TOKEN_ADDRESSES.base.tokenA, // Default address from README
      decimals: 18,
    },
    {
      symbol: "TokenB",
      name: "Test Token B",
      address: TOKEN_ADDRESSES.base.tokenB, // Default address from README
      decimals: 18,
    },
  ],
  arbitrum: [
    {
      symbol: "TokenA",
      name: "Test Token A",
      address: TOKEN_ADDRESSES.arbitrum.tokenA, // Default address from README
      decimals: 18,
    },
    {
      symbol: "TokenB",
      name: "Test Token B",
      address: TOKEN_ADDRESSES.arbitrum.tokenB, // Default address from README
      decimals: 18,
    },
  ],
};
