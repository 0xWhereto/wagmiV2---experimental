/**
 * Solana Token Registry
 * Popular SPL tokens with metadata and logos
 */

import { TOKEN_LOGOS } from './logos';

export interface SolanaToken {
  address: string; // Base58 mint address
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
  coingeckoId?: string;
  tags?: string[];
}

/**
 * Popular Solana SPL Tokens
 */
export const SOLANA_TOKENS: SolanaToken[] = [
  // Native
  {
    address: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'Wrapped SOL',
    decimals: 9,
    logoURI: TOKEN_LOGOS.SOL,
    coingeckoId: 'solana',
    tags: ['native', 'wrapped'],
  },
  
  // Stablecoins
  {
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoURI: TOKEN_LOGOS.USDC,
    coingeckoId: 'usd-coin',
    tags: ['stablecoin'],
  },
  {
    address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    logoURI: TOKEN_LOGOS.USDT,
    coingeckoId: 'tether',
    tags: ['stablecoin'],
  },
  {
    address: 'USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA',
    symbol: 'USDS',
    name: 'USDS',
    decimals: 6,
    logoURI: TOKEN_LOGOS.DAI, // Similar to DAI
    tags: ['stablecoin'],
  },
  
  // Major DeFi
  {
    address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    symbol: 'JUP',
    name: 'Jupiter',
    decimals: 6,
    logoURI: TOKEN_LOGOS.JUP,
    coingeckoId: 'jupiter-exchange-solana',
    tags: ['defi', 'governance'],
  },
  {
    address: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',
    symbol: 'JTO',
    name: 'Jito',
    decimals: 9,
    logoURI: TOKEN_LOGOS.JTO,
    coingeckoId: 'jito-governance-token',
    tags: ['defi', 'governance'],
  },
  {
    address: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
    symbol: 'PYTH',
    name: 'Pyth Network',
    decimals: 6,
    logoURI: TOKEN_LOGOS.PYTH,
    coingeckoId: 'pyth-network',
    tags: ['oracle', 'governance'],
  },
  {
    address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    symbol: 'RAY',
    name: 'Raydium',
    decimals: 6,
    logoURI: TOKEN_LOGOS.RAY,
    coingeckoId: 'raydium',
    tags: ['defi', 'dex'],
  },
  {
    address: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
    symbol: 'ORCA',
    name: 'Orca',
    decimals: 6,
    logoURI: TOKEN_LOGOS.ORCA,
    coingeckoId: 'orca',
    tags: ['defi', 'dex'],
  },
  {
    address: 'MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey',
    symbol: 'MNDE',
    name: 'Marinade',
    decimals: 9,
    logoURI: 'https://assets.coingecko.com/coins/images/18867/large/MNDE.png',
    coingeckoId: 'marinade',
    tags: ['defi', 'staking'],
  },
  
  // Liquid Staking
  {
    address: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
    symbol: 'mSOL',
    name: 'Marinade Staked SOL',
    decimals: 9,
    logoURI: 'https://assets.coingecko.com/coins/images/17752/large/mSOL.png',
    coingeckoId: 'msol',
    tags: ['liquid-staking'],
  },
  {
    address: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
    symbol: 'jitoSOL',
    name: 'Jito Staked SOL',
    decimals: 9,
    logoURI: 'https://assets.coingecko.com/coins/images/28046/large/JitoSOL-200.png',
    coingeckoId: 'jito-staked-sol',
    tags: ['liquid-staking'],
  },
  {
    address: 'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1',
    symbol: 'bSOL',
    name: 'BlazeStake Staked SOL',
    decimals: 9,
    logoURI: 'https://assets.coingecko.com/coins/images/26636/large/blazesolana.png',
    coingeckoId: 'blazestake-staked-sol',
    tags: ['liquid-staking'],
  },
  
  // Meme Tokens
  {
    address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    symbol: 'BONK',
    name: 'Bonk',
    decimals: 5,
    logoURI: TOKEN_LOGOS.BONK,
    coingeckoId: 'bonk',
    tags: ['meme'],
  },
  {
    address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    symbol: 'WIF',
    name: 'dogwifhat',
    decimals: 6,
    logoURI: TOKEN_LOGOS.WIF,
    coingeckoId: 'dogwifhat',
    tags: ['meme'],
  },
  {
    address: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
    symbol: 'POPCAT',
    name: 'Popcat',
    decimals: 9,
    logoURI: 'https://assets.coingecko.com/coins/images/35449/large/popcat.jpg',
    coingeckoId: 'popcat',
    tags: ['meme'],
  },
  {
    address: 'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',
    symbol: 'MEW',
    name: 'cat in a dogs world',
    decimals: 5,
    logoURI: 'https://assets.coingecko.com/coins/images/36436/large/MEW.png',
    coingeckoId: 'cat-in-a-dogs-world',
    tags: ['meme'],
  },
  
  // Wrapped Assets
  {
    address: '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',
    symbol: 'wBTC',
    name: 'Wrapped BTC (Portal)',
    decimals: 8,
    logoURI: TOKEN_LOGOS.WBTC,
    coingeckoId: 'wrapped-bitcoin',
    tags: ['wrapped', 'bridged'],
  },
  {
    address: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
    symbol: 'wETH',
    name: 'Wrapped ETH (Portal)',
    decimals: 8,
    logoURI: TOKEN_LOGOS.WETH,
    coingeckoId: 'weth',
    tags: ['wrapped', 'bridged'],
  },
];

/**
 * Get Solana token by symbol
 */
export function getSolanaTokenBySymbol(symbol: string): SolanaToken | undefined {
  return SOLANA_TOKENS.find(t => t.symbol.toLowerCase() === symbol.toLowerCase());
}

/**
 * Get Solana token by mint address
 */
export function getSolanaTokenByAddress(address: string): SolanaToken | undefined {
  return SOLANA_TOKENS.find(t => t.address === address);
}

/**
 * Get popular Solana tokens for quick selection
 */
export function getPopularSolanaTokens(): SolanaToken[] {
  const popular = ['SOL', 'USDC', 'USDT', 'JUP', 'JTO', 'BONK', 'WIF'];
  return popular
    .map(symbol => getSolanaTokenBySymbol(symbol))
    .filter((t): t is SolanaToken => t !== undefined);
}

/**
 * Search Solana tokens
 */
export function searchSolanaTokens(query: string): SolanaToken[] {
  const lowerQuery = query.toLowerCase();
  return SOLANA_TOKENS.filter(
    t =>
      t.symbol.toLowerCase().includes(lowerQuery) ||
      t.name.toLowerCase().includes(lowerQuery) ||
      t.address.includes(query)
  );
}

/**
 * Get tokens by tag
 */
export function getSolanaTokensByTag(tag: string): SolanaToken[] {
  return SOLANA_TOKENS.filter(t => t.tags?.includes(tag));
}



