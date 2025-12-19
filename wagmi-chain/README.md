# Wagmi Chain Deployment

This directory contains all configuration, documentation, and deployment resources for the Wagmi Chain - a custom EVM-compatible L2 rollup settling to Ethereum Mainnet, serving as the HUB for the omnichain synthetic token system.

## Overview

```
wagmi-chain/
├── README.md                           # This file
├── config/
│   └── chain-parameters.json           # Chain configuration parameters
├── docs/
│   ├── chain-specification.md          # Technical chain specification
│   ├── layerzero-integration.md        # LayerZero integration requirements
│   └── raas-provider-outreach.md       # RaaS provider communication templates
└── scripts/
    └── verify-chain-config.ts          # Configuration verification script
```

## Quick Start

1. Review the chain specification in `docs/chain-specification.md`
2. Contact RaaS providers using templates in `docs/raas-provider-outreach.md`
3. Coordinate LayerZero integration per `docs/layerzero-integration.md`
4. Deploy contracts using existing Hardhat scripts once chain is live

## Chain Parameters

| Parameter | Value |
|-----------|-------|
| Chain Name | Wagmi Chain |
| Chain Type | Arbitrum Orbit L2 (Rollup) |
| Settlement Layer | Ethereum Mainnet |
| EVM Version | Paris (Solidity 0.8.23 compatible) |
| Block Time | 250ms - 1s |
| Gas Token | ETH (native) |

## Timeline

1. **Week 1**: RaaS provider selection and contract signing
2. **Week 2**: Chain deployment and testing
3. **Week 3**: LayerZero Endpoint deployment and DVN setup
4. **Week 4**: Contract deployment and integration testing

