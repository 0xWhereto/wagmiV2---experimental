/**
 * Token Logo Sources
 * Unified logo fetching from multiple reliable CDNs
 */

// Trust Wallet Assets CDN
const TRUST_WALLET_CDN = 'https://raw.githubusercontent.com/trustwallet/assets/master';

// CoinGecko CDN
const COINGECKO_CDN = 'https://assets.coingecko.com/coins/images';

// Chain-specific asset paths for Trust Wallet
const CHAIN_PATHS: Record<number, string> = {
  1: 'ethereum',
  56: 'smartchain',
  137: 'polygon',
  42161: 'arbitrum',
  10: 'optimism',
  43114: 'avalanchec',
  8453: 'base',
  324: 'zksync',
  250: 'fantom',
  146: 'sonic', // May not exist, fallback to custom
};

/**
 * Get token logo URL from Trust Wallet Assets
 */
export function getTrustWalletLogo(chainId: number, tokenAddress: string): string {
  const chainPath = CHAIN_PATHS[chainId];
  if (!chainPath) {
    return getDefaultTokenLogo();
  }
  // Trust Wallet uses checksummed addresses
  return `${TRUST_WALLET_CDN}/blockchains/${chainPath}/assets/${tokenAddress}/logo.png`;
}

/**
 * Get native token logo for a chain
 */
export function getNativeTokenLogo(chainId: number): string {
  const logos: Record<number, string> = {
    1: `${TRUST_WALLET_CDN}/blockchains/ethereum/info/logo.png`,
    56: `${TRUST_WALLET_CDN}/blockchains/smartchain/info/logo.png`,
    137: `${TRUST_WALLET_CDN}/blockchains/polygon/info/logo.png`,
    42161: `${TRUST_WALLET_CDN}/blockchains/arbitrum/info/logo.png`,
    10: `${TRUST_WALLET_CDN}/blockchains/optimism/info/logo.png`,
    43114: `${TRUST_WALLET_CDN}/blockchains/avalanchec/info/logo.png`,
    8453: `${TRUST_WALLET_CDN}/blockchains/base/info/logo.png`,
    250: `${TRUST_WALLET_CDN}/blockchains/fantom/info/logo.png`,
    146: '/images/tokens/sonic.svg', // Custom Sonic logo
  };
  return logos[chainId] || getDefaultTokenLogo();
}

/**
 * Get default/fallback token logo
 */
export function getDefaultTokenLogo(): string {
  return '/images/tokens/unknown.svg';
}

/**
 * Popular token logos by symbol (cross-chain)
 * These are reliable, high-quality logos from known sources
 */
export const TOKEN_LOGOS: Record<string, string> = {
  // Stablecoins
  USDC: `${COINGECKO_CDN}/6319/large/usdc.png`,
  USDT: `${COINGECKO_CDN}/325/large/Tether.png`,
  DAI: `${COINGECKO_CDN}/9956/large/Badge_Dai.png`,
  FRAX: `${COINGECKO_CDN}/13422/large/FRAX_icon.png`,
  LUSD: `${COINGECKO_CDN}/14666/large/Group_3.png`,
  TUSD: `${COINGECKO_CDN}/3449/large/tusd.png`,
  BUSD: `${COINGECKO_CDN}/9576/large/BUSD.png`,
  USDbC: `${COINGECKO_CDN}/6319/large/usdc.png`, // Bridged USDC uses USDC logo
  'USDC.e': `${COINGECKO_CDN}/6319/large/usdc.png`,

  // ETH & Wrapped
  ETH: `${COINGECKO_CDN}/279/large/ethereum.png`,
  WETH: `${COINGECKO_CDN}/2518/large/weth.png`,
  stETH: `${COINGECKO_CDN}/13442/large/steth_logo.png`,
  wstETH: `${COINGECKO_CDN}/18834/large/wstETH.png`,
  rETH: `${COINGECKO_CDN}/20764/large/reth.png`,
  cbETH: `${COINGECKO_CDN}/27008/large/cbeth.png`,

  // BTC & Wrapped
  BTC: `${COINGECKO_CDN}/1/large/bitcoin.png`,
  WBTC: `${COINGECKO_CDN}/7598/large/wrapped_bitcoin_wbtc.png`,
  tBTC: `${COINGECKO_CDN}/11224/large/0x18084fba666a33d37592fa2633fd49a74dd93a88.png`,
  renBTC: `${COINGECKO_CDN}/11370/large/renBTC.png`,

  // Major DeFi
  UNI: `${COINGECKO_CDN}/12504/large/uniswap-logo.png`,
  AAVE: `${COINGECKO_CDN}/12645/large/AAVE.png`,
  LINK: `${COINGECKO_CDN}/877/large/chainlink-new-logo.png`,
  CRV: `${COINGECKO_CDN}/12124/large/Curve.png`,
  MKR: `${COINGECKO_CDN}/1364/large/Mark_Maker.png`,
  SNX: `${COINGECKO_CDN}/3406/large/SNX.png`,
  COMP: `${COINGECKO_CDN}/10775/large/COMP.png`,
  LDO: `${COINGECKO_CDN}/13573/large/Lido_DAO.png`,
  RPL: `${COINGECKO_CDN}/2325/large/Rocket_Pool_%28RPL%29.png`,
  GMX: `${COINGECKO_CDN}/18323/large/arbit.png`,
  GNS: `${COINGECKO_CDN}/19741/large/gns.png`,
  RDNT: `${COINGECKO_CDN}/26536/large/radiant.png`,
  PENDLE: `${COINGECKO_CDN}/15069/large/Pendle_Logo_Normal-03.png`,

  // L2 Tokens
  ARB: `${COINGECKO_CDN}/16547/large/photo_2023-03-29_21.47.00.jpeg`,
  OP: `${COINGECKO_CDN}/25244/large/Optimism.png`,
  MATIC: `${COINGECKO_CDN}/4713/large/polygon.png`,
  AVAX: `${COINGECKO_CDN}/12559/large/Avalanche_Circle_RedWhite_Trans.png`,
  FTM: `${COINGECKO_CDN}/4001/large/Fantom_round.png`,

  // Meme/Popular
  SHIB: `${COINGECKO_CDN}/11939/large/shiba.png`,
  PEPE: `${COINGECKO_CDN}/29850/large/pepe-token.jpeg`,
  DOGE: `${COINGECKO_CDN}/5/large/dogecoin.png`,
  FLOKI: `${COINGECKO_CDN}/16746/large/PNG_image.png`,

  // Gaming/Metaverse
  APE: `${COINGECKO_CDN}/24383/large/apecoin.jpg`,
  SAND: `${COINGECKO_CDN}/12129/large/sandbox_logo.jpg`,
  MANA: `${COINGECKO_CDN}/878/large/decentraland-mana.png`,
  AXS: `${COINGECKO_CDN}/13029/large/axie_infinity_logo.png`,

  // Solana Ecosystem
  SOL: `${COINGECKO_CDN}/4128/large/solana.png`,
  JTO: `${COINGECKO_CDN}/33228/large/jito.png`,
  JUP: `${COINGECKO_CDN}/34188/large/jup.png`,
  PYTH: `${COINGECKO_CDN}/31924/large/pyth.png`,
  BONK: `${COINGECKO_CDN}/28600/large/bonk.jpg`,
  WIF: `${COINGECKO_CDN}/33566/large/dogwifhat.jpg`,
  RAY: `${COINGECKO_CDN}/13928/large/PSigc4ie_400x400.jpg`,
  ORCA: `${COINGECKO_CDN}/17547/large/ORCA.png`,
  MNGO: `${COINGECKO_CDN}/18081/large/mango-logo.png`,

  // Sonic & Wagmi
  S: '/images/tokens/sonic.svg',
  SONIC: '/images/tokens/sonic.svg',
  WAGMI: '/images/tokens/wagmi.svg',
  sWAGMI: '/images/tokens/wagmi.svg',
  // Synthetic tokens on Hub (Sonic) - use underlying asset logos
  sWETH: `${COINGECKO_CDN}/2518/large/weth.png`,
  sETH: `${COINGECKO_CDN}/279/large/ethereum.png`,
  sUSDT: `${COINGECKO_CDN}/325/large/Tether.png`,
  sUSDC: `${COINGECKO_CDN}/6319/large/usdc.png`,
  sDAI: `${COINGECKO_CDN}/9956/large/Badge_Dai.png`,
  sWBTC: `${COINGECKO_CDN}/7598/large/wrapped_bitcoin_wbtc.png`,
  sSOL: `${COINGECKO_CDN}/4128/large/solana.png`,
};

/**
 * Get token logo by symbol (preferred method)
 */
export function getTokenLogoBySymbol(symbol: string): string {
  // Check exact match
  if (TOKEN_LOGOS[symbol]) {
    return TOKEN_LOGOS[symbol];
  }
  
  // Check without 's' prefix (synthetic tokens)
  if (symbol.startsWith('s') && TOKEN_LOGOS[symbol.slice(1)]) {
    return TOKEN_LOGOS[symbol.slice(1)];
  }
  
  // Check uppercase
  const upper = symbol.toUpperCase();
  if (TOKEN_LOGOS[upper]) {
    return TOKEN_LOGOS[upper];
  }
  
  return getDefaultTokenLogo();
}

/**
 * Get token logo with fallback chain
 */
export function getTokenLogo(
  symbol: string,
  chainId?: number,
  tokenAddress?: string
): string {
  // First try by symbol (most reliable)
  const symbolLogo = getTokenLogoBySymbol(symbol);
  if (symbolLogo !== getDefaultTokenLogo()) {
    return symbolLogo;
  }
  
  // Then try Trust Wallet by address
  if (chainId && tokenAddress) {
    return getTrustWalletLogo(chainId, tokenAddress);
  }
  
  return getDefaultTokenLogo();
}

/**
 * Chain logos
 */
export const CHAIN_LOGOS: Record<number, string> = {
  1: `${COINGECKO_CDN}/279/large/ethereum.png`,
  56: `${COINGECKO_CDN}/825/large/bnb-icon2_2x.png`,
  137: `${COINGECKO_CDN}/4713/large/polygon.png`,
  42161: `${COINGECKO_CDN}/16547/large/photo_2023-03-29_21.47.00.jpeg`,
  10: `${COINGECKO_CDN}/25244/large/Optimism.png`,
  43114: `${COINGECKO_CDN}/12559/large/Avalanche_Circle_RedWhite_Trans.png`,
  8453: '/images/chains/base.svg',
  324: '/images/chains/zksync.svg',
  250: `${COINGECKO_CDN}/4001/large/Fantom_round.png`,
  146: '/images/chains/sonic.svg',
  // Solana
  501: `${COINGECKO_CDN}/4128/large/solana.png`,
};

export function getChainLogo(chainId: number): string {
  return CHAIN_LOGOS[chainId] || getDefaultTokenLogo();
}

