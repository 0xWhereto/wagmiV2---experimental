# LayerZero Integration Requirements for Wagmi Chain

## Overview

This document details the requirements for integrating LayerZero on Wagmi Chain. LayerZero is critical infrastructure for the Wagmi protocol, enabling cross-chain messaging between the SyntheticTokenHub on Wagmi Chain and GatewayVault contracts on spoke chains.

## Current LayerZero Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CURRENT SPOKE CHAINS                                │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│   Arbitrum      │      Base       │      Sonic      │     Ethereum          │
│   eid: 30110    │   eid: 30184    │   eid: 30332    │     eid: 30101        │
├─────────────────┴─────────────────┴─────────────────┴───────────────────────┤
│                         GatewayVault Contracts                               │
│                    (Receive deposits, release withdrawals)                   │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  │ LayerZero V2 Messages
                                  │
┌─────────────────────────────────▼───────────────────────────────────────────┐
│                           WAGMI CHAIN (NEW)                                  │
│                         eid: TBD (NEW_ENDPOINT_ID)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                         SyntheticTokenHub Contract                           │
│                    (Mint synthetic tokens, process swaps)                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Required LayerZero Components

### 1. Endpoint Contract

The LayerZero Endpoint is the core contract that handles all cross-chain messaging.

**Requirements:**
- Deploy LayerZero Endpoint V2 on Wagmi Chain
- Standard Endpoint address: `0x1a44076050125825900e736c501f859c50fE728c` (V2 standard)
- Must be deployed before any OApp contracts

**Endpoint Functions Used by SyntheticTokenHub:**
```solidity
// From @layerzerolabs/oapp-evm/contracts/oapp/OApp.sol
function _lzSend(
    uint32 _dstEid,
    bytes memory _message,
    bytes memory _options,
    MessagingFee memory _fee,
    address _refundAddress
) internal virtual returns (MessagingReceipt memory receipt);

function _lzReceive(
    Origin calldata _origin,
    bytes32 _guid,
    bytes calldata _message,
    address _executor,
    bytes calldata _extraData
) internal virtual;
```

### 2. Endpoint ID Assignment

LayerZero assigns a unique Endpoint ID to each supported chain.

**Action Required:**
- Contact LayerZero to request Endpoint ID for Wagmi Chain
- Example format: `WAGMI_V2_MAINNET` with numeric value (e.g., 30XXX for V2 mainnet)

**Where EID is Used:**
```typescript
// In layerzero.config.ts
const wagmiContract: OmniPointHardhat = {
  eid: EndpointId.WAGMI_V2_MAINNET, // NEW: Assigned by LayerZero
  contractName: "SyntheticTokenHub",
  address: "0x...", // Deployed address
};
```

### 3. Message Libraries

LayerZero V2 uses separate libraries for sending and receiving messages.

**SendLibrary:**
- Handles outbound message encoding and verification requests
- Example from Sonic config: `0xC39161c743D0307EB9BCc9FEF03eeb9Dc4802de7`

**ReceiveLibrary:**
- Handles inbound message verification and delivery
- Example from Sonic config: `0xe1844c5D63a9543023008D332Bd3d2e6f1FE1043`

**Configuration Required:**
```typescript
config: {
  sendLibrary: "0x...", // Wagmi Chain SendLib address
  receiveLibraryConfig: { 
    receiveLibrary: "0x...", // Wagmi Chain ReceiveLib address
    gracePeriod: 0n 
  },
  // ...
}
```

### 4. DVN (Decentralized Verifier Network)

DVNs verify cross-chain messages. At least one DVN must support Wagmi Chain.

**Current DVN Usage (Example from Sonic config):**
```typescript
ulnConfig: {
  confirmations: 20n,
  requiredDVNs: ["0x282b3386571f7f794450d5789911a9804fa346b4"], // LayerZero DVN
  optionalDVNs: [
    "0x05AaEfDf9dB6E0f7d27FA3b6EE099EDB33dA029E", 
    "0x54dd79f5ce72b51fcbbcb170dd01e32034323565"
  ],
  optionalDVNThreshold: 1,
}
```

**Options for Wagmi Chain:**

| DVN Option | Description | Cost | Setup Time |
|------------|-------------|------|------------|
| LayerZero Default DVN | Operated by LayerZero | Included | Fast (with LZ partnership) |
| Google Cloud DVN | Enterprise-grade | Higher | Medium |
| Polyhedra DVN | ZK-proof based | Variable | Medium |
| Custom DVN | Self-operated | Lowest ongoing | Longest setup |

**Recommendation:** Start with LayerZero's default DVN, add optional DVNs for additional security.

### 5. Executor

The Executor delivers messages to the destination chain after DVN verification.

**Current Executor Usage (Example from Sonic config):**
```typescript
executorConfig: { 
  maxMessageSize: 10000, 
  executor: "0x4208D6E27538189bB48E603D6123A94b8Abe0A0b" 
}
```

**Requirements for Wagmi Chain:**
- Executor contract deployed on Wagmi Chain
- Executor must be configured with gas parameters
- Usually operated by LayerZero or RaaS provider

## Message Flow Analysis

### Deposit Flow (Spoke → Hub)

```
1. User deposits token to GatewayVault on Spoke Chain
   └── GatewayVault._lzSend(wagmiEid, depositMessage, options)

2. LayerZero Endpoint (Spoke) encodes message
   └── SendLibrary prepares message for DVN

3. DVN verifies message
   └── Monitors spoke chain, signs attestation

4. Executor delivers to Wagmi Chain
   └── Calls SyntheticTokenHub._lzReceive()

5. SyntheticTokenHub processes deposit
   └── Mints synthetic tokens to user
```

### Withdrawal Flow (Hub → Spoke)

```
1. User requests withdrawal on SyntheticTokenHub
   └── SyntheticTokenHub._lzSend(spokeEid, withdrawalMessage, options)

2. LayerZero Endpoint (Wagmi) encodes message
   └── SendLibrary prepares message for DVN

3. DVN verifies message
   └── Monitors Wagmi Chain, signs attestation

4. Executor delivers to Spoke Chain
   └── Calls GatewayVault._lzReceive()

5. GatewayVault processes withdrawal
   └── Releases native tokens to user
```

## Configuration Updates Required

### 1. Update `layerzero.config.ts`

Add Wagmi Chain configuration:

```typescript
import { EndpointId } from "@layerzerolabs/lz-definitions";

// NEW: Wagmi Chain contract
const wagmiContract: OmniPointHardhat = {
  eid: EndpointId.WAGMI_V2_MAINNET, // Assigned by LayerZero
  contractName: "SyntheticTokenHub",
  address: "0x...", // To be deployed
};

// Update connections array with new pathways
const config: OAppOmniGraphHardhat = {
  contracts: [
    { contract: wagmiContract },
    { contract: baseContract },
    { contract: arbitrumContract },
    { contract: sonicContract },
    // ... other spoke contracts
  ],
  connections: [
    // Wagmi ↔ Base
    {
      from: wagmiContract,
      to: baseContract,
      config: {
        sendLibrary: "0x...", // Wagmi SendLib
        receiveLibraryConfig: { 
          receiveLibrary: "0x...", 
          gracePeriod: 0n 
        },
        sendConfig: {
          executorConfig: { 
            maxMessageSize: 10000, 
            executor: "0x..." // Wagmi Executor
          },
          ulnConfig: {
            confirmations: 20n,
            requiredDVNs: ["0x..."], // Wagmi DVN
            optionalDVNs: ["0x...", "0x..."],
            optionalDVNThreshold: 1,
          },
        },
        receiveConfig: {
          ulnConfig: {
            confirmations: 20n,
            requiredDVNs: ["0x..."],
            optionalDVNs: ["0x...", "0x..."],
            optionalDVNThreshold: 1,
          },
        },
      },
    },
    // Add similar connections for Arbitrum, Sonic, Ethereum, etc.
  ],
};
```

### 2. Update `hardhat.config.ts`

Add Wagmi Chain network:

```typescript
wagmi: {
  eid: EndpointId.WAGMI_V2_MAINNET,
  url: "https://rpc.wagmi-chain.io", // From RaaS provider
  chainId: XXXXX, // Assigned chain ID
  gas: "auto",
  gasMultiplier: 1.2,
  gasPrice: "auto",
  accounts: [`${process.env.PRIVATE_KEY}`],
},
```

### 3. Update `@layerzerolabs/lz-definitions`

If using a custom Endpoint ID not yet in the package:

```typescript
// Create local extension
export const WAGMI_V2_MAINNET = 30XXX; // Your assigned EID

// Or wait for official package update from LayerZero
```

## Integration Timeline

### Week 1: Preparation
- [ ] Contact LayerZero team (partnerships@layerzero.network)
- [ ] Request Endpoint ID assignment
- [ ] Confirm RaaS provider can deploy LZ infrastructure

### Week 2: Deployment
- [ ] RaaS provider deploys Wagmi Chain
- [ ] LayerZero deploys Endpoint V2 on Wagmi Chain
- [ ] DVN configured to support Wagmi Chain
- [ ] Executor deployed and configured

### Week 3: Configuration
- [ ] Update layerzero.config.ts with Wagmi Chain
- [ ] Deploy SyntheticTokenHub on Wagmi Chain
- [ ] Configure OApp peers between Hub and all Spokes
- [ ] Test message sending/receiving

### Week 4: Testing
- [ ] End-to-end deposit test (Spoke → Hub)
- [ ] End-to-end withdrawal test (Hub → Spoke)
- [ ] Cross-chain swap test
- [ ] Gas optimization verification
- [ ] Error handling verification

## Contact Points

### LayerZero
- **Partnerships**: partnerships@layerzero.network
- **Developer Support**: https://discord.gg/layerzero
- **Documentation**: https://docs.layerzero.network

### Integration Request Template

**Subject**: LayerZero Endpoint Integration Request - Wagmi Chain

---

Hi LayerZero Team,

We are deploying a new EVM-compatible L2 chain called "Wagmi Chain" (Arbitrum Orbit Rollup settling to Ethereum Mainnet) and need LayerZero integration.

**Our Protocol:**
- Wagmi is an omnichain synthetic token system
- We already use LayerZero V2 on Arbitrum, Base, and Sonic
- The new Wagmi Chain will host our SyntheticTokenHub

**Request:**
1. Endpoint ID assignment for Wagmi Chain
2. Guidance on Endpoint V2 deployment
3. DVN support for the new chain
4. Executor configuration

**RaaS Provider:** [Conduit/Caldera - TBD]

**Timeline:** Looking to launch within 3-4 weeks

**Existing Contract References:**
- Sonic Hub: 0x1bbcE9Fc68E47Cd3E4B6bC3BE64E271bcDb3edf1
- Base Gateway: 0x5AafA963D0D448ba3bE2c5940F1778505AcA9512
- Arbitrum Gateway: 0x0b3095Cd06d649b66f38a7a17f02e8Ba000b7baF

Happy to schedule a call to discuss integration details.

Best regards,
[Your Name]
[Contact Email]

---

## Security Considerations

### DVN Configuration

- **Minimum 1 required DVN**: Never set `requiredDVNs` to empty array
- **Consider 2+ optional DVNs**: Adds redundancy
- **Use reputable DVNs**: LayerZero Default, Google Cloud, Polyhedra

### Confirmations

- **Higher is safer**: More confirmations = more finality
- **Arbitrum Orbit**: 20 confirmations is reasonable
- **Can be adjusted**: Per-pathway configuration

### Message Validation

Ensure SyntheticTokenHub validates:
- Sender is authorized peer (via `_lzReceive` checks)
- Message format is correct
- Amounts are within limits

### Key Management

- Use multisig for OApp ownership
- Separate keys for different operations
- Monitor for unauthorized peer changes

## Troubleshooting

### Common Issues

1. **Message not delivered**
   - Check DVN is operational
   - Verify executor has gas on destination
   - Check peer configuration

2. **Wrong Endpoint ID**
   - Ensure using V2 endpoint IDs (30XXX range)
   - Verify EID matches chain

3. **DVN verification failed**
   - Check confirmation requirements
   - Verify DVN supports both chains

4. **Executor out of gas**
   - Monitor executor balance
   - Adjust gas limits in options

### Debugging Tools

- LayerZero Scan: https://layerzeroscan.com
- Message tracing via GUID
- Endpoint event logs


