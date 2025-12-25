# Wagmi Chain Technical Specification

## Executive Summary

Wagmi Chain is a custom EVM-compatible Layer 2 rollup designed to serve as the central HUB for the Wagmi omnichain synthetic token system. It settles to Ethereum Mainnet and integrates with LayerZero for cross-chain messaging with GatewayVault contracts on spoke chains.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ETHEREUM MAINNET                                │
│                            (Settlement Layer)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  - Rollup Contract (validates state roots)                                   │
│  - Inbox/Outbox (message bridging)                                           │
│  - Challenge Manager (fraud proofs)                                          │
│  - Batch Poster (posts L2 data)                                              │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                │ State Commits + Data Availability
                                │
┌───────────────────────────────▼─────────────────────────────────────────────┐
│                              WAGMI CHAIN (L2)                                │
│                           Arbitrum Orbit Rollup                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Core Infrastructure:                                                        │
│  ├── Sequencer (transaction ordering)                                        │
│  ├── Batch Poster (L1 data submission)                                       │
│  ├── Validator (state validation)                                            │
│  └── RPC Nodes (user access)                                                 │
│                                                                              │
│  Wagmi Protocol Contracts:                                                   │
│  ├── SyntheticTokenHub.sol (central hub for synthetic tokens)                │
│  ├── SyntheticToken.sol (ERC20 synthetic tokens)                             │
│  ├── Balancer.sol (penalty/bonus calculations)                               │
│  └── Uniswap V3 Pools (synthetic token trading)                              │
│                                                                              │
│  LayerZero Integration:                                                      │
│  ├── LZ Endpoint V2 (cross-chain messaging)                                  │
│  ├── DVN (Decentralized Verifier Network)                                    │
│  └── Executor (message delivery)                                             │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                │ LayerZero Messages
                                │
┌───────────────────────────────▼─────────────────────────────────────────────┐
│                            SPOKE CHAINS                                      │
│                    (Arbitrum, Base, Sonic, Ethereum, etc.)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  GatewayVault contracts on each spoke chain:                                 │
│  - Accept deposits of native tokens                                          │
│  - Send deposit messages to SyntheticTokenHub                                │
│  - Receive withdrawal messages from SyntheticTokenHub                        │
│  - Release native tokens to users                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Chain Parameters

### Core Configuration

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Chain Name** | Wagmi Chain | Brand alignment |
| **Chain ID** | TBD (assigned by RaaS provider) | Unique identifier |
| **Chain Type** | Arbitrum Orbit Rollup | Proven technology, full EVM compatibility |
| **Settlement Layer** | Ethereum Mainnet | Maximum security, existing LZ support |
| **Data Availability** | Ethereum (Rollup mode) | Maximum data availability guarantees |
| **EVM Version** | Paris | Matches existing Solidity 0.8.23 contracts |

### Performance Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Block Time** | 250ms | Fast transaction confirmation |
| **Gas Limit per Block** | 32M - 100M | Sufficient for complex operations |
| **Max Transaction Size** | 128KB | Standard for Arbitrum chains |
| **Target Transactions/Second** | 40,000+ | Arbitrum Nitro performance |

### Economic Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Gas Token** | ETH | Simplicity, no custom token needed |
| **Fee Model** | Standard Arbitrum (L2 gas + L1 calldata) | Predictable costs |
| **Sequencer Fee** | ~0.01-0.1 gwei | Low transaction costs |

### Governance Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Sequencer Mode** | Centralized (initial) | Faster time to market |
| **Admin Keys** | Multisig (3/5 recommended) | Security for upgrades |
| **Challenge Period** | 7 days (standard) | Fraud proof window |

## Technical Requirements

### Smart Contract Compatibility

The Wagmi Chain must support:

- **Solidity Version**: 0.8.23
- **EVM Version**: Paris (no PUSH0 opcode issues)
- **Optimizer**: Enabled with 999 runs
- **viaIR**: Enabled (required for complex contracts)

Existing contracts to deploy:
- `SyntheticTokenHub.sol` (~958 lines)
- `SyntheticToken.sol`
- `Balancer.sol`
- `SyntheticTokenHubGetters.sol`
- Uniswap V3 infrastructure (if not already deployed)

### LayerZero Integration Requirements

1. **Endpoint V2 Contract**: Must be deployed on Wagmi Chain
2. **Endpoint ID**: Unique ID assigned by LayerZero (e.g., `WAGMI_V2_MAINNET`)
3. **DVN Support**: At least one DVN must support Wagmi Chain
4. **Executor**: LayerZero executor must be deployed or configured

### External Dependencies

| Dependency | Requirement |
|------------|-------------|
| Uniswap V3 Factory | Deploy on Wagmi Chain |
| Uniswap V3 Router | Deploy on Wagmi Chain |
| Uniswap Permit2 | Deploy on Wagmi Chain |
| WETH9 | Deploy on Wagmi Chain |
| Block Explorer | Required for verification |
| RPC Endpoints | Public + private endpoints |

## Deployment Phases

### Phase 1: Chain Deployment (Week 1-2)

1. Select RaaS provider (Conduit or Caldera recommended)
2. Configure chain parameters
3. Deploy chain infrastructure
4. Set up block explorer
5. Configure native bridge

### Phase 2: LayerZero Integration (Week 3)

1. Coordinate with LayerZero for Endpoint ID assignment
2. Deploy LZ Endpoint V2 contracts
3. Configure DVNs for message verification
4. Deploy and configure Executors
5. Test cross-chain messaging

### Phase 3: Protocol Deployment (Week 4)

1. Deploy Uniswap V3 infrastructure
2. Deploy SyntheticTokenHub
3. Deploy initial SyntheticTokens
4. Configure balancer
5. Create initial liquidity pools

### Phase 4: Integration Testing (Week 4-5)

1. Test deposits from spoke chains
2. Test withdrawals to spoke chains
3. Test swap functionality
4. Load testing and optimization
5. Security review

## Hardhat Configuration

Add to `hardhat.config.ts` once chain is deployed:

```typescript
wagmi: {
  eid: EndpointId.WAGMI_V2_MAINNET, // Assigned by LayerZero
  url: "https://rpc.wagmi-chain.io", // RaaS-provided RPC
  chainId: XXXXX, // Assigned chain ID
  gas: "auto",
  gasMultiplier: 1.2,
  gasPrice: "auto",
  accounts: [`${process.env.PRIVATE_KEY}`],
},
```

## Risk Considerations

### Technical Risks

| Risk | Mitigation |
|------|------------|
| LayerZero integration delay | Early engagement with LZ team |
| Contract size limits | Already using viaIR, optimizer tuned |
| Sequencer downtime | RaaS SLA guarantees |

### Economic Risks

| Risk | Mitigation |
|------|------------|
| L1 gas cost spikes | Monitor and adjust batch posting frequency |
| Low utilization | Start with conservative infrastructure |

### Security Risks

| Risk | Mitigation |
|------|------------|
| Sequencer centralization | Plan for decentralization roadmap |
| Admin key compromise | Use multisig, hardware wallets |
| Smart contract bugs | Existing contracts already audited |

## Next Steps

1. **Immediate**: Contact Conduit and Caldera for quotes
2. **Week 1**: Select provider, sign contract
3. **Week 1**: Engage LayerZero for integration discussion
4. **Week 2**: Chain deployment begins
5. **Week 3**: LayerZero integration
6. **Week 4**: Protocol deployment and testing


