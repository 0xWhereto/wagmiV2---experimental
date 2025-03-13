# cross-chain-swap-test

## Installation

```bash
git clone --recursive https://github.com/RealWagmi/wagmi-omnichain-app.git
pnpm install
mv .env_example .env
npm run compile
npm run test
```

### Synthetic Receiver (for get quote)

| Network | ChainId | Eid   | Contract                   | Address                                                                                                                |
| ------- | ------- | ----- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| SONIC   | 146     | 30332 | TestCrossChainSwapReceiver | [0x1bbcE9Fc68E47Cd3E4B6bC3BE64E271bcDb3edf1](https://sonicscan.org/address/0x1bbcE9Fc68E47Cd3E4B6bC3BE64E271bcDb3edf1) |

##### TokenAsynthetic: [0x1227D8C5Bc62fDdE7FB3c539688E316FA4b665AC](https://sonicscan.org/address/0x1227D8C5Bc62fDdE7FB3c539688E316FA4b665AC)

##### TokenBsynthetic: [0x0c347E8172c52125c8b37876c721b2f545dEFF38](https://sonicscan.org/address/0x0c347E8172c52125c8b37876c721b2f545dEFF38)

### MockToken Senders

| Network | ChainId | Eid   | Contract                 | Address                                                                                                               |
| ------- | ------- | ----- | ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| BASE    | 8453    | 30184 | TestCrossChainSwapSender | [0x5AafA963D0D448ba3bE2c5940F1778505AcA9512](https://basescan.org/address/0x5AafA963D0D448ba3bE2c5940F1778505AcA9512) |

##### TokenA: [0xa2C0a17Af854031C82d5649cf211D66c5dC3C95a](https://basescan.org/address/0xa2C0a17Af854031C82d5649cf211D66c5dC3C95a)

##### TokenB: [0x4596750bb7fDd5e46A65F2913A1b8B15E4BD2aB8](https://basescan.org/address/0x4596750bb7fDd5e46A65F2913A1b8B15E4BD2aB8)

##

| Network  | ChainId | Eid   | Contract                 | Address                                                                                                              |
| -------- | ------- | ----- | ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| ARBITRUM | 42161   | 30110 | TestCrossChainSwapSender | [0x0b3095Cd06d649b66f38a7a17f02e8Ba000b7baF](https://arbiscan.io/address/0x0b3095Cd06d649b66f38a7a17f02e8Ba000b7baF) |

##### TokenA: [0xb8B6513f59fd537f372B4fccF0590aEA3B38b429](https://arbiscan.io/address/0xb8B6513f59fd537f372B4fccF0590aEA3B38b429)

##### TokenB: [0x569eC1dd4f669696977265c2DB0e4468A6084064](https://arbiscan.io/address/0x569eC1dd4f669696977265c2DB0e4468A6084064)

```
┌───────────┬───────┬──────┬──────────┐
│ from → to │ sonic │ base │ arbitrum │
├───────────┼───────┼──────┼──────────┤
│ sonic     │   ∅   │  ✓   │    ✓     │
├───────────┼───────┼──────┼──────────┤
│ base      │   ✓   │  ∅   │    ∅     │
├───────────┼───────┼──────┼──────────┤
│ arbitrum  │   ✓   │  ∅   │    ∅     │
└───────────┴───────┴──────┴──────────┘
```
