// Contract addresses by chain
// Update these with your deployed contract addresses

export const CHAIN_CONFIG = {
  // Sonic - Hub chain (where SyntheticTokenHub is deployed)
  sonic: {
    chainId: 146,
    eid: 30332, // LayerZero Endpoint ID for Sonic V2
    name: "Sonic",
    rpcUrl: "https://rpc.soniclabs.com",
    explorer: "https://sonicscan.org",
    isHubChain: true,
    contracts: {
      syntheticTokenHub: "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd",
      balancer: "0x3a27f366e09fe76A50DD50D415c770f6caf0F3E6",
      syntheticTokenHubGetters: "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e",
      // Uniswap V3 contracts on Sonic (deployed)
      weth9: "0xBFF7867E7e5e8D656Fc0B567cE7672140D208235",
      uniswapV3Factory: "0x3a1713B6C3734cfC883A3897647f3128Fe789f39",
      swapRouter: "0x8BbF9fF8CE8060B85DFe48d7b7E897d09418De9B",
      nonfungiblePositionManager: "0x5826e10B513C891910032F15292B2F1b3041C3Df",
      quoterV2: "0x57e3e0a9DfB3DA34cc164B2C8dD1EBc404c45d47",
      // 0IL Protocol V3 - Clean deployment with full MIM (USDC backing + auto-LP)
      mim: "0xf3DBF67010C7cAd25c152AB772F8Ef240Cc9c14f", // Full MIM with mintWithUSDC
      stakingVault: "0x263ee9b0327E2A103F0D9808110a02c82E1A979d", // MIMStakingVaultV2
      mimUsdcPool: "0x3Be1A1975D2bd22fDE3079f2eee7140Cb55BE556", // MIM/sUSDC pool (0.01%)
      swethMimPool: "0x1b287D79E341C52B2aeC78a3803042D222C8Ab24", // sWETH/MIM pool (0.01%)
      oracleAdapter: "0xA5725c6694DcDC1fba1BB26115c16DA633B41dbA", // SimpleOracle
      v3LPVault: "0x40a8af8516cC5557127e6601cC5c794EDB5F97C8", // V3LPVault
      leverageAMM: "0x1f0447A083fDD5099a310F1e1897F9Fb1043c875", // LeverageAMMV2
      wETH: "0x6dbB555EaD5D236e912fCFe28cec0C737E9E1D04", // Zero-IL wETH
    },
    nativeCurrency: {
      name: "Sonic",
      symbol: "S",
      decimals: 18,
    },
  },
  // Arbitrum - Gateway chain
  arbitrum: {
    chainId: 42161,
    eid: 30110, // LayerZero Endpoint ID for Arbitrum V2
    name: "Arbitrum",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    explorer: "https://arbiscan.io",
    isHubChain: false,
    contracts: {
      gatewayVault: "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e", // OLD GATEWAY (no rescue, but works)
    },
    nativeCurrency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
    },
  },
  // Base - Gateway chain
  base: {
    chainId: 8453,
    eid: 30184, // LayerZero Endpoint ID for Base V2
    name: "Base",
    rpcUrl: "https://mainnet.base.org",
    explorer: "https://basescan.org",
    isHubChain: false,
    contracts: {
      gatewayVault: "0xB712543E7fB87C411AAbB10c6823cf39bbEBB4Bb", // NEW GATEWAY
    },
    nativeCurrency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
    },
  },
  // Ethereum Mainnet - Gateway chain
  ethereum: {
    chainId: 1,
    eid: 30101, // LayerZero Endpoint ID for Ethereum V2
    name: "Ethereum",
    rpcUrl: "https://ethereum-rpc.publicnode.com",
    explorer: "https://etherscan.io",
    isHubChain: false,
    contracts: {
      gatewayVault: "0xba36FC6568B953f691dd20754607590C59b7646a", // NEW GATEWAY
    },
    nativeCurrency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
    },
  },
} as const;

// Get chain config by chainId
export function getChainConfig(chainId: number) {
  return Object.values(CHAIN_CONFIG).find((c) => c.chainId === chainId);
}

// Get chain config by name
export function getChainConfigByName(name: string) {
  return CHAIN_CONFIG[name as keyof typeof CHAIN_CONFIG];
}

// Get hub chain config
export function getHubChainConfig() {
  return Object.values(CHAIN_CONFIG).find((c) => c.isHubChain);
}

// Get all gateway chains
export function getGatewayChains() {
  return Object.values(CHAIN_CONFIG).filter((c) => !c.isHubChain);
}

// Supported chains for the UI
export const SUPPORTED_CHAINS = Object.values(CHAIN_CONFIG);

// Chain ID to LayerZero EID mapping
export const CHAIN_ID_TO_EID: Record<number, number> = Object.fromEntries(
  Object.values(CHAIN_CONFIG).map((c) => [c.chainId, c.eid])
);

// LayerZero EID to Chain ID mapping
export const EID_TO_CHAIN_ID: Record<number, number> = Object.fromEntries(
  Object.values(CHAIN_CONFIG).map((c) => [c.eid, c.chainId])
);

