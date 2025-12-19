/**
 * LayerZero Configuration for Wagmi Chain
 *
 * This configuration file defines the LayerZero OApp connections
 * for the SyntheticTokenHub on Wagmi Chain.
 *
 * Usage:
 * After Wagmi Chain is deployed and LayerZero is integrated:
 * 1. Update the placeholder values with actual addresses
 * 2. Run: npx hardhat lz:oapp:wire --oapp-config wagmi-chain/config/layerzero.wagmi.config.ts
 */

import { EndpointId } from "@layerzerolabs/lz-definitions";
import type {
  OAppOmniGraphHardhat,
  OmniPointHardhat,
} from "@layerzerolabs/toolbox-hardhat";

// ============================================================================
// PLACEHOLDER VALUES - UPDATE AFTER DEPLOYMENT
// ============================================================================

/**
 * Custom Endpoint ID for Wagmi Chain
 * This will be assigned by LayerZero during integration
 * Once official, use EndpointId.WAGMI_V2_MAINNET
 */
const WAGMI_ENDPOINT_ID = 0 as EndpointId; // TODO: Update with assigned EID

// ============================================================================
// CONTRACT DEFINITIONS
// ============================================================================

/**
 * SyntheticTokenHub on Wagmi Chain (HUB)
 */
const wagmiHubContract: OmniPointHardhat = {
  eid: WAGMI_ENDPOINT_ID,
  contractName: "SyntheticTokenHub",
  address: "0x0000000000000000000000000000000000000000", // TODO: Update after deployment
};

/**
 * GatewayVault on Sonic
 */
const sonicGatewayContract: OmniPointHardhat = {
  eid: EndpointId.SONIC_V2_MAINNET,
  contractName: "GatewayVault",
  address: "0x1bbcE9Fc68E47Cd3E4B6bC3BE64E271bcDb3edf1", // Existing contract
};

/**
 * GatewayVault on Base
 */
const baseGatewayContract: OmniPointHardhat = {
  eid: EndpointId.BASE_V2_MAINNET,
  contractName: "GatewayVault",
  address: "0x5AafA963D0D448ba3bE2c5940F1778505AcA9512", // Existing contract
};

/**
 * GatewayVault on Arbitrum
 */
const arbitrumGatewayContract: OmniPointHardhat = {
  eid: EndpointId.ARBITRUM_V2_MAINNET,
  contractName: "GatewayVault",
  address: "0x0b3095Cd06d649b66f38a7a17f02e8Ba000b7baF", // Existing contract
};

/**
 * GatewayVault on Ethereum (planned)
 */
const ethereumGatewayContract: OmniPointHardhat = {
  eid: EndpointId.ETHEREUM_V2_MAINNET,
  contractName: "GatewayVault",
  address: "0x0000000000000000000000000000000000000000", // TODO: Deploy and update
};

// ============================================================================
// LAYERZERO INFRASTRUCTURE ADDRESSES
// ============================================================================

/**
 * Wagmi Chain LayerZero Infrastructure
 * These addresses will be provided after LayerZero deployment
 */
const WAGMI_LZ_INFRA = {
  SEND_LIBRARY: "0x0000000000000000000000000000000000000000", // TODO: Update
  RECEIVE_LIBRARY: "0x0000000000000000000000000000000000000000", // TODO: Update
  EXECUTOR: "0x0000000000000000000000000000000000000000", // TODO: Update
  DVN_DEFAULT: "0x0000000000000000000000000000000000000000", // TODO: Update
  DVN_OPTIONAL_1: "0x0000000000000000000000000000000000000000", // TODO: Update
  DVN_OPTIONAL_2: "0x0000000000000000000000000000000000000000", // TODO: Update
};

/**
 * Existing LayerZero Infrastructure on Spoke Chains
 * (From current layerzero.config.ts)
 */
const SPOKE_LZ_INFRA = {
  SONIC: {
    SEND_LIBRARY: "0xC39161c743D0307EB9BCc9FEF03eeb9Dc4802de7",
    RECEIVE_LIBRARY: "0xe1844c5D63a9543023008D332Bd3d2e6f1FE1043",
    EXECUTOR: "0x4208D6E27538189bB48E603D6123A94b8Abe0A0b",
    DVN_REQUIRED: "0x282b3386571f7f794450d5789911a9804fa346b4",
    DVN_OPTIONAL: [
      "0x05AaEfDf9dB6E0f7d27FA3b6EE099EDB33dA029E",
      "0x54dd79f5ce72b51fcbbcb170dd01e32034323565",
    ],
  },
  BASE: {
    SEND_LIBRARY: "0xB5320B0B3a13cC860893E2Bd79FCd7e13484Dda2",
    RECEIVE_LIBRARY: "0xc70AB6f32772f59fBfc23889Caf4Ba3376C84bAf",
    EXECUTOR: "0x2CCA08ae69E0C44b18a57Ab2A87644234dAebaE4",
    DVN_REQUIRED: "0x9e059a54699a285714207b43b055483e78faac25",
    DVN_OPTIONAL: [
      "0xa7b5189bca84cd304d8553977c7c614329750d99",
      "0xcd37ca043f8479064e10635020c65ffc005d36f6",
    ],
  },
  ARBITRUM: {
    SEND_LIBRARY: "0x975bcD720be66659e3EB3C0e4F1866a3020E493A",
    RECEIVE_LIBRARY: "0x7B9E184e07a6EE1AC23eAe0fe8D6Be2f663f05e6",
    EXECUTOR: "0x31CAe3B7fB82d847621859fb1585353c5720660D",
    DVN_REQUIRED: "0x2f55c492897526677c5b68fb199ea31e2c126416",
    DVN_OPTIONAL: [
      "0x19670df5e16bea2ba9b9e68b48c054c5baea06b8",
      "0xa7b5189bca84cd304d8553977c7c614329750d99",
    ],
  },
};

// ============================================================================
// CONNECTION CONFIGURATION
// ============================================================================

/**
 * Standard ULN configuration parameters
 */
const ULN_CONFIRMATIONS = 20n;
const MAX_MESSAGE_SIZE = 10000;
const OPTIONAL_DVN_THRESHOLD = 1;

/**
 * Helper to create bidirectional connection config
 */
function createConnection(
  from: OmniPointHardhat,
  to: OmniPointHardhat,
  fromInfra: {
    SEND_LIBRARY: string;
    RECEIVE_LIBRARY: string;
    EXECUTOR: string;
    DVN_REQUIRED: string;
    DVN_OPTIONAL: string[];
  }
) {
  return {
    from,
    to,
    config: {
      sendLibrary: fromInfra.SEND_LIBRARY,
      receiveLibraryConfig: {
        receiveLibrary: fromInfra.RECEIVE_LIBRARY,
        gracePeriod: 0n,
      },
      sendConfig: {
        executorConfig: {
          maxMessageSize: MAX_MESSAGE_SIZE,
          executor: fromInfra.EXECUTOR,
        },
        ulnConfig: {
          confirmations: ULN_CONFIRMATIONS,
          requiredDVNs: [fromInfra.DVN_REQUIRED],
          optionalDVNs: fromInfra.DVN_OPTIONAL,
          optionalDVNThreshold: OPTIONAL_DVN_THRESHOLD,
        },
      },
      receiveConfig: {
        ulnConfig: {
          confirmations: ULN_CONFIRMATIONS,
          requiredDVNs: [fromInfra.DVN_REQUIRED],
          optionalDVNs: fromInfra.DVN_OPTIONAL,
          optionalDVNThreshold: OPTIONAL_DVN_THRESHOLD,
        },
      },
    },
  };
}

// ============================================================================
// OAPP CONFIGURATION
// ============================================================================

const config: OAppOmniGraphHardhat = {
  contracts: [
    // HUB on Wagmi Chain
    { contract: wagmiHubContract },

    // Gateways on Spoke Chains
    { contract: sonicGatewayContract },
    { contract: baseGatewayContract },
    { contract: arbitrumGatewayContract },
    // { contract: ethereumGatewayContract }, // Uncomment when deployed
  ],

  connections: [
    // ========================================================================
    // WAGMI HUB -> SPOKE CHAINS (Outbound from Hub)
    // ========================================================================

    // Wagmi -> Sonic
    createConnection(wagmiHubContract, sonicGatewayContract, {
      SEND_LIBRARY: WAGMI_LZ_INFRA.SEND_LIBRARY,
      RECEIVE_LIBRARY: WAGMI_LZ_INFRA.RECEIVE_LIBRARY,
      EXECUTOR: WAGMI_LZ_INFRA.EXECUTOR,
      DVN_REQUIRED: WAGMI_LZ_INFRA.DVN_DEFAULT,
      DVN_OPTIONAL: [
        WAGMI_LZ_INFRA.DVN_OPTIONAL_1,
        WAGMI_LZ_INFRA.DVN_OPTIONAL_2,
      ],
    }),

    // Wagmi -> Base
    createConnection(wagmiHubContract, baseGatewayContract, {
      SEND_LIBRARY: WAGMI_LZ_INFRA.SEND_LIBRARY,
      RECEIVE_LIBRARY: WAGMI_LZ_INFRA.RECEIVE_LIBRARY,
      EXECUTOR: WAGMI_LZ_INFRA.EXECUTOR,
      DVN_REQUIRED: WAGMI_LZ_INFRA.DVN_DEFAULT,
      DVN_OPTIONAL: [
        WAGMI_LZ_INFRA.DVN_OPTIONAL_1,
        WAGMI_LZ_INFRA.DVN_OPTIONAL_2,
      ],
    }),

    // Wagmi -> Arbitrum
    createConnection(wagmiHubContract, arbitrumGatewayContract, {
      SEND_LIBRARY: WAGMI_LZ_INFRA.SEND_LIBRARY,
      RECEIVE_LIBRARY: WAGMI_LZ_INFRA.RECEIVE_LIBRARY,
      EXECUTOR: WAGMI_LZ_INFRA.EXECUTOR,
      DVN_REQUIRED: WAGMI_LZ_INFRA.DVN_DEFAULT,
      DVN_OPTIONAL: [
        WAGMI_LZ_INFRA.DVN_OPTIONAL_1,
        WAGMI_LZ_INFRA.DVN_OPTIONAL_2,
      ],
    }),

    // ========================================================================
    // SPOKE CHAINS -> WAGMI HUB (Inbound to Hub)
    // ========================================================================

    // Sonic -> Wagmi
    createConnection(
      sonicGatewayContract,
      wagmiHubContract,
      SPOKE_LZ_INFRA.SONIC
    ),

    // Base -> Wagmi
    createConnection(
      baseGatewayContract,
      wagmiHubContract,
      SPOKE_LZ_INFRA.BASE
    ),

    // Arbitrum -> Wagmi
    createConnection(
      arbitrumGatewayContract,
      wagmiHubContract,
      SPOKE_LZ_INFRA.ARBITRUM
    ),
  ],
};

export default config;

