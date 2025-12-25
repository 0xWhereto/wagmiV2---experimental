# 0IL Protocol V4 - Deployment Configuration

> Last Updated: December 24, 2024
> Network: Sonic (chainId 146)
> Owner/Deployer: 0x4151E05ABe56192e2A6775612C2020509Fd50637

---

## 📍 Contract Addresses

### Core MIM System

| Contract | Address | Description |
|----------|---------|-------------|
| **MIM Token** | `0xf3DBF67010C7cAd25c152AB772F8Ef240Cc9c14f` | 18 decimals, has `mintWithUSDC()` and auto-LP |
| **MIMStakingVaultV2 (sMIM)** | `0x263ee9b0327E2A103F0D9808110a02c82E1A979d` | Staking vault for MIM |
| **MIM/sUSDC Pool** | `0x3Be1A1975D2bd22fDE3079f2eee7140Cb55BE556` | 0.01% fee, tick 276324 |

### sWETH Zero-IL Vault

| Contract | Address | Description |
|----------|---------|-------------|
| **sWETH/MIM Pool** | `0x1b287D79E341C52B2aeC78a3803042D222C8Ab24` | 0.01% fee |
| **SimpleOracle (sWETH)** | `0xA5725c6694DcDC1fba1BB26115c16DA633B41dbA` | Price oracle |
| **V3LPVault (sWETH)** | `0x40a8af8516cC5557127e6601cC5c794EDB5F97C8` | LP manager |
| **LeverageAMMV2 (sWETH)** | `0x1f0447A083fDD5099a310F1e1897F9Fb1043c875` | 2x leverage engine |
| **wETH (Zero-IL)** | `0x6dbB555EaD5D236e912fCFe28cec0C737E9E1D04` | User deposit token |

### sWBTC Zero-IL Vault

| Contract | Address | Description |
|----------|---------|-------------|
| **sWBTC/MIM Pool** | `0xeCeBFb34875DA11ea6512BDa2b016EcEdb971Fb5` | 0.05% fee, tick 344892 |
| **SimpleOracle (sWBTC)** | `0x86cD993209e58A9Db915BC5aD182E185a616aa17` | Price oracle |
| **V3LPVault (sWBTC)** | `0xF1AbAB357Dcfaf873bBCC0C0620B8BeA2C999908` | LP manager |
| **LeverageAMMV2 (sWBTC)** | `0xF7CFeb7638B962eBD8816B50AE979a774a61f154` | 2x leverage engine |
| **wBTC (Zero-IL)** | `0x40D9bc9e3dd25b89924fD6f263D543DF840bf852` | User deposit token |

### Underlying Synthetic Tokens (from Hub)

| Token | Address | Decimals |
|-------|---------|----------|
| **sUSDC** | `0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B` | 6 |
| **sWETH** | `0x5E501C482952c1F2D58a4294F9A97759968c5125` | 18 |
| **sWBTC** | `0x2F0324268031E6413280F3B5ddBc4A97639A284a` | 8 |

### Helper Contracts

| Contract | Address | Description |
|----------|---------|-------------|
| **HubRescuer** | `0x0fa6794B4EaB2D66D2ae0727b435FdD8f3c42f22` | Rescue tokens from Hub |

### Infrastructure

| Contract | Address | Description |
|----------|---------|-------------|
| **SyntheticTokenHub** | `0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd` | Cross-chain token hub |
| **Uniswap V3 Factory** | `0x3a1713B6C3734cfC883A3897647f3128Fe789f39` | Pool factory |
| **Position Manager** | `0x5826e10B513C891910032F15292B2F1b3041C3Df` | NFT position manager |

---

## ⚙️ Pool Initialization Parameters

### MIM/sUSDC Pool (0.01% fee)

```
Token0: sUSDC (0xa56a...) - 6 decimals
Token1: MIM (0xf3DB...) - 18 decimals
Fee: 100 (0.01%)

Target Price: 1 MIM = 1 sUSDC
Tick Range: 275700 to 276900

sqrtPriceX96 Calculation:
- Price (token1/token0) = 1e18 / 1e6 = 1e12
- sqrt(1e12) = 1e6
- sqrtPriceX96 = 1e6 * 2^96 = 79228162514264337593543950336000000

Current Tick: 276324 (within range ✓)
```

### sWETH/MIM Pool (0.01% fee)

```
Token0: sWETH (0x5E50...) - 18 decimals  
Token1: MIM (0xf3DB...) - 18 decimals
Fee: 100 (0.01%)

Target Price: 1 sWETH = ~3000 MIM
```

### sWBTC/MIM Pool (0.05% fee)

```
Token0: sWBTC (0x2F03...) - 8 decimals
Token1: MIM (0xf3DB...) - 18 decimals
Fee: 500 (0.05%)

Target Price: 1 sWBTC = ~95000 MIM

sqrtPriceX96 Calculation:
- Price (token1/token0) = (95000 * 1e18) / 1e8 = 9.5e14
- sqrt(9.5e14) = 30822070
- sqrtPriceX96 = 30822070 * 2^96 = 2441975970986031411811843185332715520

Current Tick: 344892 (~$95,000 ✓)
```

---

## 🔢 Decimal Handling

### Oracle Price Interpretation

The SimpleOracle returns raw Uniswap V3 price with 18 decimal precision:

```typescript
// For sWETH (18 decimals) vs MIM (18 decimals):
// No adjustment needed - same decimals
assetPriceUSD = parseFloat(formatUnits(oraclePrice, 18));

// For sWBTC (8 decimals) vs MIM (18 decimals):
// Must divide by 1e10 due to decimal difference (18 - 8 = 10)
assetPriceUSD = parseFloat(formatUnits(oraclePrice, 18)) / 1e10;
```

### Token Ordering in Uniswap V3

Uniswap V3 always orders tokens by address (lower address = token0):

```
sUSDC (0xa56a...) < MIM (0xf3DB...) → sUSDC is token0
sWBTC (0x2F03...) < MIM (0xf3DB...) → sWBTC is token0  
sWETH (0x5E50...) < MIM (0xf3DB...) → sWETH is token0
```

The MIM contract dynamically sets tick ranges based on token ordering:

```solidity
if (usdcIsToken0) {
    TICK_LOWER = 275700;   // Positive ticks
    TICK_UPPER = 276900;
} else {
    TICK_LOWER = -276900;  // Negative ticks (inverted)
    TICK_UPPER = -275700;
}
```

---

## 🔧 Contract Configuration

### LeverageAMMV2 Settings

```solidity
TARGET_DTV = 0.50e18;       // 50% target debt-to-value
MIN_DTV = 0.40e18;          // 40% - add leverage trigger
MAX_DTV = 0.60e18;          // 60% - reduce leverage trigger
LIQUIDATION_DTV = 0.66e18;  // 66% - emergency threshold
REBALANCE_REWARD = 0.001e18; // 0.1% reward for rebalancer
PROTOCOL_FEE = 0.15e18;     // 15% performance fee
```

### MIMStakingVault Settings

```solidity
MAX_UTILIZATION = 0.90e18;  // 90% max utilization
BASE_RATE = 0.02e18;        // 2% base borrow rate
UTILIZATION_KINK = 0.80e18; // 80% kink point
KINK_RATE = 0.10e18;        // 10% rate at kink
MAX_RATE = 0.50e18;         // 50% max rate
```

---

## 🔗 Contract Relationships

```
User deposits sWETH/sWBTC
        ↓
    WToken.deposit()
        ↓
    LeverageAMM.openPosition()
        ↓
    ┌────────────────────────────────────┐
    │ 1. Borrows MIM from StakingVault   │
    │ 2. Adds asset + MIM to V3LPVault   │
    │ 3. Mints wToken shares to user     │
    └────────────────────────────────────┘

User withdraws wTokens
        ↓
    WToken.withdraw()
        ↓
    LeverageAMM.closePosition()
        ↓
    ┌────────────────────────────────────┐
    │ 1. Removes liquidity from V3LPVault│
    │ 2. Repays MIM debt to StakingVault │
    │ 3. Returns underlying to user      │
    └────────────────────────────────────┘
```

---

## 📁 Frontend Configuration

### MAGICPOOL_ADDRESSES (index.ts)

```typescript
export const MAGICPOOL_ADDRESSES = {
  // Core MIM
  mimToken: "0xf3DBF67010C7cAd25c152AB772F8Ef240Cc9c14f",
  stakingVault: "0x263ee9b0327E2A103F0D9808110a02c82E1A979d",
  mimUsdcPool: "0x3Be1A1975D2bd22fDE3079f2eee7140Cb55BE556",
  
  // sWETH Vault
  swethMimPool: "0x1b287D79E341C52B2aeC78a3803042D222C8Ab24",
  oracleAdapter: "0xA5725c6694DcDC1fba1BB26115c16DA633B41dbA",
  v3LPVault: "0x40a8af8516cC5557127e6601cC5c794EDB5F97C8",
  leverageAMM: "0x1f0447A083fDD5099a310F1e1897F9Fb1043c875",
  wETH: "0x6dbB555EaD5D236e912fCFe28cec0C737E9E1D04",
  
  // sWBTC Vault
  sWBTCMIMPool: "0xeCeBFb34875DA11ea6512BDa2b016EcEdb971Fb5",
  wBTCOracle: "0x86cD993209e58A9Db915BC5aD182E185a616aa17",
  wBTCV3Vault: "0xF1AbAB357Dcfaf873bBCC0C0620B8BeA2C999908",
  wBTCLeverageAMM: "0xF7CFeb7638B962eBD8816B50AE979a774a61f154",
  wBTC: "0x40D9bc9e3dd25b89924fD6f263D543DF840bf852",
  
  // Underlying tokens
  sUSDC: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B",
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  sWBTC: "0x2F0324268031E6413280F3B5ddBc4A97639A284a",
};
```

---

## 🚨 Important Notes

1. **All contracts have `rescueTokens()` function** for emergency token recovery

2. **MIM minting adds liquidity to both sides** of the MIM/sUSDC pool due to correct tick range

3. **sWBTC uses 0.05% fee pool** (0.01% was initialized with wrong price)

4. **Oracle price adjustment**: sWBTC oracle returns value 1e10 higher due to decimal difference

5. **StakingVault borrowers**:
   - sWETH LeverageAMM: `0x1f0447A083fDD5099a310F1e1897F9Fb1043c875`
   - sWBTC LeverageAMM: `0xF7CFeb7638B962eBD8816B50AE979a774a61f154`

---

## 🔐 LayerZero Configuration

### Hub (Sonic)

```
EID: 30332
Endpoint: 0x6F475642a6e85809B1c36Fa62763669b1b48DD5B
DVN: 0x282b3386571f7f794450d5789911a9804fa346b4
```

### Gateway (Arbitrum)

```
EID: 30110
Active Gateway: 0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e
Confirmations: 20
```

---

## ✅ Deployment Checklist

When deploying new vaults:

- [ ] Create pool with correct fee tier
- [ ] Calculate sqrtPriceX96 accounting for decimal differences
- [ ] Initialize pool before deploying oracle
- [ ] Deploy SimpleOracle pointing to pool
- [ ] Deploy V3LPVault with position manager and pool
- [ ] Call `setDefaultLayers()` on V3LPVault
- [ ] Deploy LeverageAMMV2 with correct constructor args
- [ ] Deploy WToken
- [ ] Set WToken in LeverageAMM: `setWToken()`
- [ ] Add LeverageAMM as operator in V3LPVault: `setOperator()`
- [ ] Add LeverageAMM as borrower in StakingVault: `setBorrower()`
- [ ] Update frontend MAGICPOOL_ADDRESSES
- [ ] Add decimal adjustment if asset has non-18 decimals


