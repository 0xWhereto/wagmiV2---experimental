export const NETWORKS = {
  BASE: {
    id: 8453,
    name: "Base",
    chainId: "0x2105", // hexadecimal chainId
    rpcUrl: process.env.REACT_APP_BASE_RPC || "https://mainnet.base.org",
    blockExplorerUrl: "https://basescan.org",
    eid: 30184, // LayerZero endpoint ID for Base from swap.ts
    nativeCurrency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
    },
  },
  ARBITRUM: {
    id: 42161,
    name: "Arbitrum",
    chainId: "0xa4b1", // hexadecimal chainId
    rpcUrl: process.env.REACT_APP_ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc",
    blockExplorerUrl: "https://arbiscan.io",
    eid: 30110, // LayerZero endpoint ID for Arbitrum from swap.ts
    nativeCurrency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
    },
  },
  SONIC: {
    id: 146,
    name: "Sonic",
    chainId: "0x10f1", // hexadecimal chainId
    rpcUrl: process.env.REACT_APP_SONIC_RPC || "https://rpc.soniclabs.com",
    blockExplorerUrl: "https://explorer.sonic.com",
    eid: 30332, // LayerZero endpoint ID for Sonic from swap.ts
    nativeCurrency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
    },
  },
};

export const EID_TO_NETWORK = {
  30184: NETWORKS.BASE,
  30110: NETWORKS.ARBITRUM,
  30332: NETWORKS.SONIC,
};

export const NETWORK_NAMES = {
  BASE: "base",
  ARBITRUM: "arbitrum",
  SONIC: "sonic",
};

export const SUPPORTED_SWAP_SOURCES = [NETWORKS.BASE.name, NETWORKS.ARBITRUM.name];

export const SUPPORTED_SWAP_DESTINATIONS = {
  Base: ["Arbitrum"],
  Arbitrum: ["Base"],
  Sonic: [], // Sonic is the intermediate chain and not a direct source/destination
};
