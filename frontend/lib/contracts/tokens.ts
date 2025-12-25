// Token configurations per chain
// These are example tokens - update with actual deployed token addresses

export interface TokenConfig {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string;
  syntheticAddress?: `0x${string}`; // Corresponding synthetic token on hub chain
}

export interface ChainTokens {
  [tokenSymbol: string]: TokenConfig;
}

// Token addresses by chain ID
export const TOKENS_BY_CHAIN: Record<number, ChainTokens> = {
  // Sonic (Hub chain - synthetic tokens)
  146: {
    sWAGMI: {
      address: "0x0000000000000000000000000000000000000000", // TODO: Add deployed address
      symbol: "sWAGMI",
      name: "Synthetic WAGMI",
      decimals: 18,
    },
    sETH: {
      address: "0x0000000000000000000000000000000000000000", // TODO: Add deployed address
      symbol: "sETH",
      name: "Synthetic ETH",
      decimals: 18,
    },
    sDAI: {
      address: "0x0000000000000000000000000000000000000000", // TODO: Add deployed address
      symbol: "sDAI",
      name: "Synthetic DAI",
      decimals: 18,
    },
    sUSDC: {
      address: "0x0000000000000000000000000000000000000000", // TODO: Add deployed address
      symbol: "sUSDC",
      name: "Synthetic USDC",
      decimals: 6,
    },
  },
  // Arbitrum
  42161: {
    WETH: {
      address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
      symbol: "WETH",
      name: "Wrapped ETH",
      decimals: 18,
      syntheticAddress: "0x0000000000000000000000000000000000000000",
    },
    DAI: {
      address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
      symbol: "DAI",
      name: "DAI Stablecoin",
      decimals: 18,
      syntheticAddress: "0x0000000000000000000000000000000000000000",
    },
    USDC: {
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      syntheticAddress: "0x0000000000000000000000000000000000000000",
    },
  },
  // Base
  8453: {
    WETH: {
      address: "0x4200000000000000000000000000000000000006",
      symbol: "WETH",
      name: "Wrapped ETH",
      decimals: 18,
      syntheticAddress: "0x0000000000000000000000000000000000000000",
    },
    DAI: {
      address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
      symbol: "DAI",
      name: "DAI Stablecoin",
      decimals: 18,
      syntheticAddress: "0x0000000000000000000000000000000000000000",
    },
    USDbC: {
      address: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA",
      symbol: "USDbC",
      name: "Bridged USDC",
      decimals: 6,
      syntheticAddress: "0x0000000000000000000000000000000000000000",
    },
  },
  // Ethereum
  1: {
    WETH: {
      address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      symbol: "WETH",
      name: "Wrapped ETH",
      decimals: 18,
      syntheticAddress: "0x0000000000000000000000000000000000000000",
    },
    DAI: {
      address: "0x6B175474E89094C44Da98b954EescdeCB5Fc31d92",
      symbol: "DAI",
      name: "DAI Stablecoin",
      decimals: 18,
      syntheticAddress: "0x0000000000000000000000000000000000000000",
    },
    USDC: {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      syntheticAddress: "0x0000000000000000000000000000000000000000",
    },
  },
};

// Get tokens for a specific chain
export function getTokensForChain(chainId: number): TokenConfig[] {
  const chainTokens = TOKENS_BY_CHAIN[chainId];
  if (!chainTokens) return [];
  return Object.values(chainTokens);
}

// Get a specific token by symbol on a chain
export function getTokenBySymbol(chainId: number, symbol: string): TokenConfig | undefined {
  const chainTokens = TOKENS_BY_CHAIN[chainId];
  if (!chainTokens) return undefined;
  return chainTokens[symbol];
}

// Get a specific token by address on a chain
export function getTokenByAddress(chainId: number, address: `0x${string}`): TokenConfig | undefined {
  const chainTokens = TOKENS_BY_CHAIN[chainId];
  if (!chainTokens) return undefined;
  return Object.values(chainTokens).find(
    (t) => t.address.toLowerCase() === address.toLowerCase()
  );
}

// Native token symbols by chain
export const NATIVE_TOKENS: Record<number, { symbol: string; name: string; decimals: number }> = {
  146: { symbol: "S", name: "Sonic", decimals: 18 },
  42161: { symbol: "ETH", name: "Ethereum", decimals: 18 },
  8453: { symbol: "ETH", name: "Ethereum", decimals: 18 },
  1: { symbol: "ETH", name: "Ethereum", decimals: 18 },
};

