# RaaS Provider Outreach Templates

This document contains email/message templates for contacting Rollup-as-a-Service providers to deploy Wagmi Chain.

---

## Provider Contact Information

### Conduit
- **Website**: https://conduit.xyz
- **Contact**: https://conduit.xyz/contact or sales@conduit.xyz
- **Docs**: https://docs.conduit.xyz

### Caldera
- **Website**: https://caldera.xyz
- **Contact**: https://caldera.xyz/contact or hello@caldera.xyz
- **Docs**: https://docs.caldera.xyz

### Gelato
- **Website**: https://gelato.network
- **Contact**: https://gelato.network/contact
- **Docs**: https://docs.gelato.network

---

## Initial Outreach Template

**Subject**: Wagmi Chain - Custom L2 Rollup Deployment Inquiry

---

Hi [Provider Name] Team,

We are building Wagmi, an omnichain synthetic token protocol, and are looking to deploy our own EVM-compatible L2 rollup to serve as our protocol's central HUB chain.

### About Our Protocol

Wagmi is a cross-chain synthetic token system that:
- Enables users to deposit tokens on any supported chain
- Mints synthetic tokens on a central HUB chain
- Provides cross-chain swaps and liquidity through Uniswap V3 pools
- Uses LayerZero for secure cross-chain messaging

### Our Requirements

**Chain Type:**
- Arbitrum Orbit Rollup (preferred) or OP Stack
- Settlement to Ethereum Mainnet
- Full EVM compatibility (Solidity 0.8.23, Paris EVM)

**Technical Needs:**
- Block time: 250ms - 1s
- Standard gas token (ETH)
- Block explorer integration
- Native bridge to Ethereum

**Critical Integration:**
- LayerZero Endpoint V2 deployment on our chain
- We need an assigned LayerZero Endpoint ID
- DVN and Executor support for cross-chain messaging

### Questions

1. What is the timeline for deploying a new L2 chain with your platform?
2. What are your monthly operational costs for our use case?
3. Do you have an existing partnership with LayerZero for new chain integrations?
4. Can you facilitate the LayerZero Endpoint deployment and DVN setup?
5. What support and SLA guarantees do you provide?

### Timeline

We are looking to have the chain operational within 2-4 weeks if possible.

We would appreciate a call to discuss our requirements in detail.

Best regards,
[Your Name]
[Your Role]
Wagmi Protocol
[Contact Email]
[Website/GitHub]

---

## Follow-Up Template (After Initial Response)

**Subject**: RE: Wagmi Chain - Technical Requirements Deep Dive

---

Hi [Contact Name],

Thank you for your response. Here are the detailed technical requirements for our chain:

### Smart Contracts to Deploy

| Contract | Description | Size |
|----------|-------------|------|
| SyntheticTokenHub | Central hub for synthetic tokens | ~25KB |
| SyntheticToken | ERC20 synthetic token template | ~8KB |
| Balancer | Penalty/bonus calculations | ~10KB |
| Uniswap V3 Suite | Factory, Router, Permit2, etc. | Standard |

### EVM Configuration

```
Solidity Version: 0.8.23
EVM Version: Paris (no PUSH0)
Optimizer: Enabled, 999 runs
viaIR: Enabled
Contract Size Limit: Need allowUnlimitedContractSize OR ensure <24KB after optimization
```

### LayerZero Integration (CRITICAL)

Our protocol depends on LayerZero for all cross-chain messaging:

1. **Current Spoke Chains**: Arbitrum, Base, Sonic (with existing GatewayVault contracts)
2. **Message Flow**: 
   - Deposits: GatewayVault → LayerZero → SyntheticTokenHub
   - Withdrawals: SyntheticTokenHub → LayerZero → GatewayVault

3. **Required on Wagmi Chain**:
   - LZ Endpoint V2 contract
   - Unique Endpoint ID (e.g., `WAGMI_V2_MAINNET`)
   - At least one DVN supporting our chain
   - Executor for message delivery

### Infrastructure Requirements

| Component | Requirement |
|-----------|-------------|
| RPC Endpoints | Public + authenticated endpoints |
| Block Explorer | Blockscout or equivalent |
| WebSocket | Real-time event subscriptions |
| Archive Node | Historical state queries |
| Bridge UI | Native L1 ↔ L2 bridge |

### Questions for This Call

1. Can you provide a detailed breakdown of monthly costs?
2. What is the process for LayerZero integration with your chains?
3. Do you handle Uniswap V3 deployment, or do we deploy ourselves?
4. What is your upgrade process for the rollup contracts?
5. What monitoring and alerting is included?

Looking forward to our discussion.

Best regards,
[Your Name]

---

## LayerZero-Specific Questions Template

Use this when specifically discussing LayerZero integration with the RaaS provider:

---

**Subject**: LayerZero Integration for Wagmi Chain

---

Hi [Contact Name],

Regarding LayerZero integration for Wagmi Chain, we need clarification on the following:

### Current LayerZero Setup

We already have LayerZero-connected contracts on:
- Arbitrum One (EndpointId.ARBITRUM_V2_MAINNET)
- Base (EndpointId.BASE_V2_MAINNET)
- Sonic (EndpointId.SONIC_V2_MAINNET)

Our contracts use:
- LayerZero OApp pattern
- OAppOptionsType3 for gas configuration
- DVN configuration for security

### Required for Wagmi Chain

1. **Endpoint ID**: Need a unique EndpointId assigned (similar to `EndpointId.WAGMI_V2_MAINNET`)

2. **Endpoint Contract**: Deploy LZ Endpoint V2 at a known address

3. **DVN Options**: 
   - Can we use LayerZero's default DVN?
   - What other DVN options are available?
   - Cost implications?

4. **Executor Configuration**:
   - Who operates the executor?
   - What are the gas overhead parameters?

5. **Message Libraries**:
   - SendLibrary and ReceiveLibrary addresses
   - Configuration for our OApp

### Questions

1. Does [Provider] have a direct relationship with LayerZero for new chain integrations?
2. What is the typical timeline for LayerZero deployment on a new chain?
3. Are there additional costs for LayerZero integration?
4. Can you connect us with your LayerZero integration contact?

Best regards,
[Your Name]

---

## Comparison Checklist

Use this checklist when evaluating responses from different providers:

### Deployment
- [ ] Time to deploy chain (target: 1-2 weeks)
- [ ] Included infrastructure (sequencer, RPC, explorer)
- [ ] Geographic distribution of nodes
- [ ] Testnet availability

### Costs
- [ ] Monthly base cost
- [ ] Per-transaction costs
- [ ] L1 gas cost handling
- [ ] Scaling costs

### LayerZero
- [ ] Existing LayerZero partnership
- [ ] Timeline for LZ integration
- [ ] DVN options and costs
- [ ] Support for integration

### Support
- [ ] SLA guarantees (uptime %)
- [ ] Response time for issues
- [ ] Dedicated support channel
- [ ] Documentation quality

### Technical
- [ ] Arbitrum Orbit version
- [ ] Upgrade process
- [ ] Custom modifications allowed
- [ ] API access

### Security
- [ ] Key management options
- [ ] Multisig support
- [ ] Audit status of stack
- [ ] Incident response

---

## Decision Matrix Template

| Criteria | Weight | Conduit | Caldera | Gelato |
|----------|--------|---------|---------|--------|
| Deployment Speed | 20% | ? | ? | ? |
| Monthly Cost | 20% | ? | ? | ? |
| LayerZero Support | 25% | ? | ? | ? |
| Technical Features | 15% | ? | ? | ? |
| Support Quality | 10% | ? | ? | ? |
| Security | 10% | ? | ? | ? |
| **Total** | 100% | ? | ? | ? |

Fill in scores (1-10) after receiving proposals from each provider.


