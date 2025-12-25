/**
 * Wagmi Chain Hardhat Network Configuration
 *
 * This file contains the network configuration to add to hardhat.config.ts
 * once the Wagmi Chain is deployed.
 *
 * Usage:
 * 1. Update the values below with actual deployment information
 * 2. Import this configuration into hardhat.config.ts
 * 3. Add the wagmi network to the networks object
 */

import { EndpointId } from "@layerzerolabs/lz-definitions";

/**
 * PLACEHOLDER VALUES - Update these after chain deployment
 */
export const WAGMI_CHAIN_CONFIG = {
  // Chain identification
  CHAIN_ID: 0, // TODO: Update with assigned chain ID
  CHAIN_NAME: "wagmi",

  // LayerZero Endpoint ID (assigned by LayerZero)
  // This will be added to @layerzerolabs/lz-definitions
  // For now, use a placeholder or custom constant
  ENDPOINT_ID: 0, // TODO: Update with assigned EID

  // RPC endpoints (provided by RaaS)
  RPC_URL: "https://rpc.wagmi-chain.io", // TODO: Update with actual RPC
  WS_URL: "wss://ws.wagmi-chain.io", // TODO: Update with actual WebSocket

  // Block explorer
  EXPLORER_URL: "https://explorer.wagmi-chain.io",
  EXPLORER_API_URL: "https://api.explorer.wagmi-chain.io/api",
};

/**
 * Network configuration for hardhat.config.ts
 *
 * Add this to the `networks` object in hardhat.config.ts:
 *
 * ```typescript
 * import { wagmiNetworkConfig } from "./wagmi-chain/config/hardhat-network-config";
 *
 * const config: HardhatUserConfig = {
 *   networks: {
 *     // ... existing networks
 *     wagmi: wagmiNetworkConfig,
 *   }
 * };
 * ```
 */
export const wagmiNetworkConfig = {
  // LayerZero endpoint ID
  // Note: Once LayerZero adds official support, use EndpointId.WAGMI_V2_MAINNET
  eid: WAGMI_CHAIN_CONFIG.ENDPOINT_ID,

  // RPC URL from RaaS provider
  url: WAGMI_CHAIN_CONFIG.RPC_URL,

  // Chain ID assigned by RaaS provider
  chainId: WAGMI_CHAIN_CONFIG.CHAIN_ID,

  // Gas configuration
  gas: "auto",
  gasMultiplier: 1.2,
  gasPrice: "auto",

  // Accounts - uses PRIVATE_KEY from .env
  accounts: [`${process.env.PRIVATE_KEY}`],
};

/**
 * Etherscan verification configuration
 *
 * Add to etherscan.customChains in hardhat.config.ts:
 *
 * ```typescript
 * etherscan: {
 *   apiKey: {
 *     wagmi: "wagmi", // API key if required
 *   },
 *   customChains: [wagmiEtherscanConfig],
 * }
 * ```
 */
export const wagmiEtherscanConfig = {
  network: "wagmi",
  chainId: WAGMI_CHAIN_CONFIG.CHAIN_ID,
  urls: {
    apiURL: WAGMI_CHAIN_CONFIG.EXPLORER_API_URL,
    browserURL: WAGMI_CHAIN_CONFIG.EXPLORER_URL,
  },
};

/**
 * Contract addresses on Wagmi Chain
 * Update these after deployment
 */
export const WAGMI_CONTRACTS = {
  // Core Protocol
  SYNTHETIC_TOKEN_HUB: "", // TODO: Deploy and update
  BALANCER: "", // TODO: Deploy and update
  WETH9: "", // TODO: Deploy and update

  // Uniswap V3
  UNISWAP_FACTORY: "", // TODO: Deploy and update
  UNISWAP_ROUTER: "", // TODO: Deploy and update
  UNISWAP_QUOTER: "", // TODO: Deploy and update
  UNISWAP_POSITION_MANAGER: "", // TODO: Deploy and update
  PERMIT2: "", // TODO: Deploy and update

  // LayerZero
  LZ_ENDPOINT: "0x1a44076050125825900e736c501f859c50fE728c", // V2 standard address
  LZ_SEND_LIBRARY: "", // TODO: Update after LZ deployment
  LZ_RECEIVE_LIBRARY: "", // TODO: Update after LZ deployment
  LZ_EXECUTOR: "", // TODO: Update after LZ deployment
  LZ_DVN_DEFAULT: "", // TODO: Update after LZ deployment
};

/**
 * LayerZero configuration for Wagmi Chain connections
 *
 * This defines the LZ config for messages to/from Wagmi Chain
 */
export const WAGMI_LZ_CONFIG = {
  // Number of confirmations required on Wagmi Chain before message is verified
  confirmations: 20n,

  // Maximum message size in bytes
  maxMessageSize: 10000,

  // DVN configuration
  dvn: {
    required: [] as string[], // TODO: Add required DVN addresses
    optional: [] as string[], // TODO: Add optional DVN addresses
    optionalThreshold: 1,
  },
};

/**
 * Helper function to create a LayerZero connection config
 */
export function createWagmiConnectionConfig(
  sendLib: string,
  receiveLib: string,
  executor: string,
  requiredDVNs: string[],
  optionalDVNs: string[] = [],
  optionalThreshold: number = 1
) {
  return {
    sendLibrary: sendLib,
    receiveLibraryConfig: {
      receiveLibrary: receiveLib,
      gracePeriod: 0n,
    },
    sendConfig: {
      executorConfig: {
        maxMessageSize: WAGMI_LZ_CONFIG.maxMessageSize,
        executor: executor,
      },
      ulnConfig: {
        confirmations: WAGMI_LZ_CONFIG.confirmations,
        requiredDVNs: requiredDVNs,
        optionalDVNs: optionalDVNs,
        optionalDVNThreshold: optionalThreshold,
      },
    },
    receiveConfig: {
      ulnConfig: {
        confirmations: WAGMI_LZ_CONFIG.confirmations,
        requiredDVNs: requiredDVNs,
        optionalDVNs: optionalDVNs,
        optionalDVNThreshold: optionalThreshold,
      },
    },
  };
}


