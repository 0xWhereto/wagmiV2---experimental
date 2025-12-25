/**
 * Comprehensive Token List
 * Contains token metadata for all supported chains
 */

import { getTokenLogoBySymbol } from './logos';

export interface Token {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
  chainId: number;
  syntheticAddress?: `0x${string}`;
  coingeckoId?: string;
  tags?: string[];
}

export interface TokenList {
  name: string;
  timestamp: string;
  version: {
    major: number;
    minor: number;
    patch: number;
  };
  tokens: Token[];
}

/**
 * Create a token with auto-populated logo
 */
function createToken(
  chainId: number,
  address: `0x${string}`,
  symbol: string,
  name: string,
  decimals: number,
  options?: {
    syntheticAddress?: `0x${string}`;
    coingeckoId?: string;
    tags?: string[];
    logoOverride?: string;
  }
): Token {
  return {
    chainId,
    address,
    symbol,
    name,
    decimals,
    logoURI: options?.logoOverride || getTokenLogoBySymbol(symbol),
    syntheticAddress: options?.syntheticAddress,
    coingeckoId: options?.coingeckoId,
    tags: options?.tags,
  };
}

// ============================================
// ETHEREUM MAINNET (Chain ID: 1)
// ============================================
export const ETHEREUM_TOKENS: Token[] = [
  createToken(1, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 'WETH', 'Wrapped Ether', 18, { coingeckoId: 'weth' }),
  createToken(1, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 'USDC', 'USD Coin', 6, { coingeckoId: 'usd-coin' }),
  createToken(1, '0xdAC17F958D2ee523a2206206994597C13D831ec7', 'USDT', 'Tether USD', 6, { coingeckoId: 'tether' }),
  createToken(1, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 'DAI', 'Dai Stablecoin', 18, { coingeckoId: 'dai' }),
  createToken(1, '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', 'WBTC', 'Wrapped BTC', 8, { coingeckoId: 'wrapped-bitcoin' }),
  createToken(1, '0x514910771AF9Ca656af840dff83E8264EcF986CA', 'LINK', 'Chainlink', 18, { coingeckoId: 'chainlink' }),
  createToken(1, '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', 'UNI', 'Uniswap', 18, { coingeckoId: 'uniswap' }),
  createToken(1, '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', 'AAVE', 'Aave', 18, { coingeckoId: 'aave' }),
  createToken(1, '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', 'MKR', 'Maker', 18, { coingeckoId: 'maker' }),
  createToken(1, '0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F', 'SNX', 'Synthetix', 18, { coingeckoId: 'synthetix-network-token' }),
  createToken(1, '0xc00e94Cb662C3520282E6f5717214004A7f26888', 'COMP', 'Compound', 18, { coingeckoId: 'compound-governance-token' }),
  createToken(1, '0xD533a949740bb3306d119CC777fa900bA034cd52', 'CRV', 'Curve DAO', 18, { coingeckoId: 'curve-dao-token' }),
  createToken(1, '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84', 'stETH', 'Lido Staked ETH', 18, { coingeckoId: 'staked-ether' }),
  createToken(1, '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0', 'wstETH', 'Wrapped stETH', 18, { coingeckoId: 'wrapped-steth' }),
  createToken(1, '0xae78736Cd615f374D3085123A210448E74Fc6393', 'rETH', 'Rocket Pool ETH', 18, { coingeckoId: 'rocket-pool-eth' }),
  createToken(1, '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32', 'LDO', 'Lido DAO', 18, { coingeckoId: 'lido-dao' }),
  createToken(1, '0x853d955aCEf822Db058eb8505911ED77F175b99e', 'FRAX', 'Frax', 18, { coingeckoId: 'frax' }),
  createToken(1, '0x6982508145454Ce325dDbE47a25d4ec3d2311933', 'PEPE', 'Pepe', 18, { coingeckoId: 'pepe' }),
  createToken(1, '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', 'SHIB', 'Shiba Inu', 18, { coingeckoId: 'shiba-inu' }),
];

// ============================================
// ARBITRUM (Chain ID: 42161)
// ============================================
export const ARBITRUM_TOKENS: Token[] = [
  createToken(42161, '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', 'WETH', 'Wrapped Ether', 18, { coingeckoId: 'weth' }),
  createToken(42161, '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', 'USDC', 'USD Coin', 6, { coingeckoId: 'usd-coin' }),
  createToken(42161, '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', 'USDC.e', 'Bridged USDC', 6, { coingeckoId: 'usd-coin' }),
  createToken(42161, '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', 'USDT', 'Tether USD', 6, { coingeckoId: 'tether' }),
  createToken(42161, '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', 'DAI', 'Dai Stablecoin', 18, { coingeckoId: 'dai' }),
  createToken(42161, '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', 'WBTC', 'Wrapped BTC', 8, { coingeckoId: 'wrapped-bitcoin' }),
  createToken(42161, '0x912CE59144191C1204E64559FE8253a0e49E6548', 'ARB', 'Arbitrum', 18, { coingeckoId: 'arbitrum' }),
  createToken(42161, '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a', 'GMX', 'GMX', 18, { coingeckoId: 'gmx' }),
  createToken(42161, '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4', 'LINK', 'Chainlink', 18, { coingeckoId: 'chainlink' }),
  createToken(42161, '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0', 'UNI', 'Uniswap', 18, { coingeckoId: 'uniswap' }),
  createToken(42161, '0x5979D7b546E38E414F7E9822514be443A4800529', 'wstETH', 'Wrapped stETH', 18, { coingeckoId: 'wrapped-steth' }),
  createToken(42161, '0xEC70Dcb4A1EFa46b8F2D97C310C9c4790ba5ffA8', 'rETH', 'Rocket Pool ETH', 18, { coingeckoId: 'rocket-pool-eth' }),
  createToken(42161, '0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8', 'PENDLE', 'Pendle', 18, { coingeckoId: 'pendle' }),
  createToken(42161, '0x3082CC23568eA640225c2467653dB90e9250AaA0', 'RDNT', 'Radiant', 18, { coingeckoId: 'radiant-capital' }),
  createToken(42161, '0x18c11FD286C5EC11c3b683Caa813B77f5163A122', 'GNS', 'Gains Network', 18, { coingeckoId: 'gains-network' }),
];

// ============================================
// BASE (Chain ID: 8453)
// ============================================
export const BASE_TOKENS: Token[] = [
  createToken(8453, '0x4200000000000000000000000000000000000006', 'WETH', 'Wrapped Ether', 18, { coingeckoId: 'weth' }),
  createToken(8453, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 'USDC', 'USD Coin', 6, { coingeckoId: 'usd-coin' }),
  createToken(8453, '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', 'USDbC', 'Bridged USDC', 6, { coingeckoId: 'usd-coin' }),
  createToken(8453, '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', 'DAI', 'Dai Stablecoin', 18, { coingeckoId: 'dai' }),
  createToken(8453, '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', 'cbETH', 'Coinbase Wrapped Staked ETH', 18, { coingeckoId: 'coinbase-wrapped-staked-eth' }),
  createToken(8453, '0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452', 'wstETH', 'Wrapped stETH', 18, { coingeckoId: 'wrapped-steth' }),
  createToken(8453, '0x0000000000000000000000000000000000000000', 'ETH', 'Ether', 18, { coingeckoId: 'ethereum' }),
];

// ============================================
// SONIC (Chain ID: 146) - Hub Chain
// ============================================
export const SONIC_TOKENS: Token[] = [
  // Native
  createToken(146, '0x0000000000000000000000000000000000000000', 'S', 'Sonic', 18, { coingeckoId: 'sonic' }),
  // Synthetic tokens - DEPLOYED ADDRESSES
  createToken(146, '0x5E501C482952c1F2D58a4294F9A97759968c5125', 'sWETH', 'Synthetic WETH', 18, { 
    tags: ['synthetic'],
    coingeckoId: 'weth', // Use WETH price
  }),
  createToken(146, '0x72dFC771E515423E5B0CD2acf703d0F7eb30bdEa', 'sUSDT', 'Synthetic USDT', 6, { 
    tags: ['synthetic'],
    coingeckoId: 'tether', // Use USDT price
  }),
  createToken(146, '0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B', 'sUSDC', 'Synthetic USDC', 6, { 
    tags: ['synthetic'],
    coingeckoId: 'usd-coin', // Use USDC price
  }),
  createToken(146, '0x2F0324268031E6413280F3B5ddBc4A97639A284a', 'sWBTC', 'Synthetic WBTC', 8, { 
    tags: ['synthetic'],
    coingeckoId: 'wrapped-bitcoin', // Use WBTC price
  }),
  // 0IL Protocol V3 - Clean deployment with full MIM
  createToken(146, '0xf3DBF67010C7cAd25c152AB772F8Ef240Cc9c14f', 'MIM', 'Magic Internet Money', 18, { 
    tags: ['stablecoin', '0IL'],
    coingeckoId: 'usd-coin', // Track 1:1 with USD
  }),
  createToken(146, '0x263ee9b0327E2A103F0D9808110a02c82E1A979d', 'sMIM', 'Staked MIM', 18, {
    tags: ['stablecoin', '0IL', 'staked'],
    coingeckoId: 'usd-coin', // Track 1:1 with USD
  }),
  createToken(146, '0x6dbB555EaD5D236e912fCFe28cec0C737E9E1D04', 'wETH', 'Zero-IL Wrapped ETH', 18, { 
    tags: ['0IL', 'leveraged'],
    coingeckoId: 'weth', // Track ETH price 1:1
  }),
];

// ============================================
// All Tokens by Chain ID
// ============================================
export const TOKENS_BY_CHAIN: Record<number, Token[]> = {
  1: ETHEREUM_TOKENS,
  42161: ARBITRUM_TOKENS,
  8453: BASE_TOKENS,
  146: SONIC_TOKENS,
};

// ============================================
// Helper Functions
// ============================================

/**
 * Get all tokens for a chain
 */
export function getTokensForChain(chainId: number): Token[] {
  return TOKENS_BY_CHAIN[chainId] || [];
}

/**
 * Get token by symbol on a chain
 */
export function getTokenBySymbol(chainId: number, symbol: string): Token | undefined {
  const tokens = TOKENS_BY_CHAIN[chainId];
  if (!tokens) return undefined;
  return tokens.find(t => t.symbol.toLowerCase() === symbol.toLowerCase());
}

/**
 * Get token by address on a chain
 */
export function getTokenByAddress(chainId: number, address: string): Token | undefined {
  const tokens = TOKENS_BY_CHAIN[chainId];
  if (!tokens) return undefined;
  return tokens.find(t => t.address.toLowerCase() === address.toLowerCase());
}

/**
 * Search tokens across all chains
 */
export function searchTokens(query: string): Token[] {
  const lowerQuery = query.toLowerCase();
  const results: Token[] = [];
  
  for (const tokens of Object.values(TOKENS_BY_CHAIN)) {
    for (const token of tokens) {
      if (
        token.symbol.toLowerCase().includes(lowerQuery) ||
        token.name.toLowerCase().includes(lowerQuery) ||
        token.address.toLowerCase().includes(lowerQuery)
      ) {
        results.push(token);
      }
    }
  }
  
  return results;
}

/**
 * Get popular/featured tokens for quick selection
 */
export function getPopularTokens(chainId: number): Token[] {
  const popular: Record<number, string[]> = {
    1: ['WETH', 'USDC', 'USDT', 'DAI', 'WBTC'],
    42161: ['WETH', 'USDC', 'ARB', 'GMX', 'WBTC'],
    8453: ['WETH', 'USDC', 'USDbC', 'DAI', 'cbETH'],
    146: ['S', 'sWETH', 'sUSDT', 'sUSDC', 'sWBTC'],
  };
  
  const popularSymbols = popular[chainId] || [];
  return popularSymbols
    .map(symbol => getTokenBySymbol(chainId, symbol))
    .filter((t): t is Token => t !== undefined);
}

/**
 * Complete token list in standard format
 */
export const WAGMI_TOKEN_LIST: TokenList = {
  name: 'Wagmi Omnichain Token List',
  timestamp: new Date().toISOString(),
  version: {
    major: 1,
    minor: 0,
    patch: 0,
  },
  tokens: [
    ...ETHEREUM_TOKENS,
    ...ARBITRUM_TOKENS,
    ...BASE_TOKENS,
    ...SONIC_TOKENS,
  ],
};

