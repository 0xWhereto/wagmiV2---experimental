/**
 * Chain Configuration
 * Metadata and configuration for supported chains
 */

import { getChainLogo } from './logos';

export interface ChainInfo {
  id: number;
  name: string;
  shortName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorers: {
    name: string;
    url: string;
  }[];
  logoURI: string;
  layerZeroEid?: number;
  isHub?: boolean;
  color: string;
}

export const SUPPORTED_CHAINS: ChainInfo[] = [
  {
    id: 146,
    name: 'Sonic',
    shortName: 'sonic',
    nativeCurrency: {
      name: 'Sonic',
      symbol: 'S',
      decimals: 18,
    },
    rpcUrls: ['https://rpc.soniclabs.com'],
    blockExplorers: [
      {
        name: 'Sonic Explorer',
        url: 'https://sonicscan.org',
      },
    ],
    logoURI: getChainLogo(146),
    layerZeroEid: 30332,
    isHub: true,
    color: '#00D4FF',
  },
  {
    id: 1,
    name: 'Ethereum',
    shortName: 'eth',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://eth.llamarpc.com', 'https://rpc.ankr.com/eth'],
    blockExplorers: [
      {
        name: 'Etherscan',
        url: 'https://etherscan.io',
      },
    ],
    logoURI: getChainLogo(1),
    layerZeroEid: 30101,
    color: '#627EEA',
  },
  {
    id: 42161,
    name: 'Arbitrum One',
    shortName: 'arb',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://arb1.arbitrum.io/rpc'],
    blockExplorers: [
      {
        name: 'Arbiscan',
        url: 'https://arbiscan.io',
      },
    ],
    logoURI: getChainLogo(42161),
    layerZeroEid: 30110,
    color: '#28A0F0',
  },
  {
    id: 8453,
    name: 'Base',
    shortName: 'base',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://mainnet.base.org'],
    blockExplorers: [
      {
        name: 'BaseScan',
        url: 'https://basescan.org',
      },
    ],
    logoURI: getChainLogo(8453),
    layerZeroEid: 30184,
    color: '#0052FF',
  },
  {
    id: 501, // Pseudo chain ID for Solana
    name: 'Solana',
    shortName: 'sol',
    nativeCurrency: {
      name: 'Solana',
      symbol: 'SOL',
      decimals: 9,
    },
    rpcUrls: ['https://api.mainnet-beta.solana.com'],
    blockExplorers: [
      {
        name: 'Solscan',
        url: 'https://solscan.io',
      },
    ],
    logoURI: getChainLogo(501),
    layerZeroEid: 30168,
    color: '#9945FF',
  },
];

/**
 * Get chain info by ID
 */
export function getChainById(chainId: number): ChainInfo | undefined {
  return SUPPORTED_CHAINS.find(c => c.id === chainId);
}

/**
 * Get chain info by name
 */
export function getChainByName(name: string): ChainInfo | undefined {
  const lowerName = name.toLowerCase();
  return SUPPORTED_CHAINS.find(
    c => c.name.toLowerCase() === lowerName || c.shortName === lowerName
  );
}

/**
 * Get hub chain
 */
export function getHubChain(): ChainInfo {
  return SUPPORTED_CHAINS.find(c => c.isHub)!;
}

/**
 * Get spoke chains (non-hub)
 */
export function getSpokeChains(): ChainInfo[] {
  return SUPPORTED_CHAINS.filter(c => !c.isHub);
}

/**
 * Get EVM chains only
 */
export function getEVMChains(): ChainInfo[] {
  return SUPPORTED_CHAINS.filter(c => c.id !== 501);
}

/**
 * Check if chain is supported
 */
export function isChainSupported(chainId: number): boolean {
  return SUPPORTED_CHAINS.some(c => c.id === chainId);
}

/**
 * Chain ID to LayerZero Endpoint ID mapping
 */
export const CHAIN_TO_LZ_EID: Record<number, number> = {
  1: 30101,    // Ethereum
  42161: 30110, // Arbitrum
  8453: 30184,  // Base
  146: 30332,   // Sonic
  501: 30168,   // Solana
};

/**
 * LayerZero Endpoint ID to Chain ID mapping
 */
export const LZ_EID_TO_CHAIN: Record<number, number> = Object.entries(CHAIN_TO_LZ_EID).reduce(
  (acc, [chainId, eid]) => {
    acc[eid] = parseInt(chainId);
    return acc;
  },
  {} as Record<number, number>
);



