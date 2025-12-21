# Architecture Documentation

## System Overview

The 0IL Protocol is a multi-layer DeFi system designed to eliminate impermanent loss for liquidity providers. This document provides a comprehensive technical overview of each component.

## Core Components

### 1. MIM Stablecoin (`MIM.sol`)

MIM (Magic Internet Money) is the protocol's native stablecoin, maintaining a 1:1 peg with USDC.

**Key Features:**
- ERC20 compliant with permit functionality
- **USDC deposits go to MIM/USDC V3 pool** at 0.995-1.005 range
- 0.05% fee tier for stablecoin pair
- Creates deep peg liquidity and earns trading fees
- Used as quote currency for all trading pairs

**Mint Flow:**
```
User deposits 1000 USDC
        │
        ▼
┌─────────────────────────────────────┐
│  MIM Contract:                      │
│  1. Mint 1000 MIM (to contract)     │
│  2. Add 1000 USDC + 1000 MIM to     │
│     V3 pool at 0.995-1.005 range    │
│  3. Mint 1000 MIM to user           │
└─────────────────────────────────────┘
        │
        ▼
  User receives 1000 MIM
  Pool has deep peg liquidity
```

**Core Functions:**
- `mintWithUSDC(uint256 amount)`: Deposit USDC, get MIM, USDC goes to V3 pool
- `redeemForUSDC(uint256 amount)`: Burn MIM, get USDC from V3 pool
- `collectFees()`: Collect trading fees from V3 position
- `mint(address to, uint256 amount)`: Mint MIM (minter only)

### 2. MIM Staking Vault (`MIMStakingVault.sol`)

The staking vault allows MIM holders to earn yield from borrow interest.

**Key Features:**
- ERC4626 vault standard
- Kinked interest rate model
- 90% maximum utilization cap
- Accrues interest in real-time

**Interest Rate Model:**
```solidity
uint256 constant BASE_RATE = 0.10e18;        // 10% base
uint256 constant MULTIPLIER = 0.12e18;        // 12% multiplier
uint256 constant JUMP_MULTIPLIER = 1.00e18;   // 100% jump multiplier
uint256 constant KINK = 0.80e18;              // 80% kink point
uint256 constant MAX_UTILIZATION = 0.90e18;   // 90% cap
```

**Rate Calculation:**
```
if (utilization <= KINK):
    rate = BASE_RATE + (utilization * MULTIPLIER)
else:
    normalRate = BASE_RATE + (KINK * MULTIPLIER)
    excessUtil = utilization - KINK
    rate = normalRate + (excessUtil * JUMP_MULTIPLIER)
```

### 3. V3 LP Vault (`V3LPVault.sol`)

Manages Uniswap V3 positions with Curve-style liquidity distribution across multiple price ranges.

**Key Features:**
- Multi-layer liquidity allocation
- Automatic fee collection
- Position rebalancing
- Gas-optimized operations

**Liquidity Layers:**
```solidity
struct LiquidityLayer {
    int24 tickLower;
    int24 tickUpper;
    uint256 weight;      // Percentage of total liquidity
    uint256 tokenId;     // NFT position ID
}

// Default configuration
Layer 1: ±0.5% range, 40% weight (highest concentration)
Layer 2: ±1.0% range, 30% weight
Layer 3: ±2.0% range, 20% weight
Layer 4: ±5.0% range, 10% weight (catch-all)
```

**Curve-Style Distribution:**
```
Liquidity
    │
    │    ┌────┐
    │    │    │
    │  ┌─┤    ├─┐
    │  │ │    │ │
    │┌─┤ │    │ ├─┐
    ││ │ │    │ │ │
────┴┴─┴─┴────┴─┴─┴┴────► Price
    Layer4  3  2  1  2  3  4
```

### 4. WToken (`WToken.sol`)

Receipt tokens representing shares in the leveraged LP position.

**Key Features:**
- ERC20 compliant
- Tracks underlying asset price linearly
- Automatically handles leverage maintenance
- Minted when users deposit, burned on withdrawal

**Value Calculation:**
```solidity
function getTokenValue() public view returns (uint256) {
    uint256 totalAssets = v3LPVault.getTotalAssets();
    uint256 totalDebt = leverageAMM.getTotalDebt();
    uint256 netValue = totalAssets - totalDebt;
    return netValue * 1e18 / totalSupply();
}
```

### 5. Leverage AMM (`LeverageAMM.sol`)

The core engine managing 2x leveraged positions.

**Key Features:**
- Maintains 50% DTV (Debt-to-Value) ratio
- Borrows MIM from staking vault
- Auto-rebalances on significant price movements
- Liquidation protection

**Position Structure:**
```
User deposits: 1 ETH worth $2000

Position created:
├── User Collateral: $2000 (1 ETH)
├── Borrowed MIM:    $2000
├── Total Position:  $4000 (2 ETH equivalent in LP)
└── DTV Ratio:       50%

When ETH price increases to $2200:
├── Position Value:  $4400
├── Debt:           $2000
├── Equity:         $2400 (+$400, same as holding 1 ETH)
└── DTV Ratio:      45.5%
```

**Rebalancing Logic:**
```solidity
function checkRebalance() public view returns (bool needed, bool isDeleverage) {
    uint256 currentDTV = getCurrentDTV();
    
    if (currentDTV < MIN_DTV) {
        // Price went up, need to borrow more
        return (true, false);
    } else if (currentDTV > MAX_DTV) {
        // Price went down, need to repay
        return (true, true);
    }
    
    return (false, false);
}
```

### 6. Oracle Adapter (`OracleAdapter.sol`)

Provides manipulation-resistant price feeds using Uniswap V3 TWAP.

**Key Features:**
- 30-minute TWAP by default
- Fallback to Chainlink if available
- Sanity checks on price movements
- Configurable observation window

**TWAP Calculation:**
```solidity
function getTWAP(uint32 secondsAgo) public view returns (uint256) {
    (int56[] memory tickCumulatives, ) = pool.observe(
        [secondsAgo, 0]
    );
    
    int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
    int24 arithmeticMeanTick = int24(tickCumulativesDelta / int56(uint56(secondsAgo)));
    
    return getQuoteAtTick(arithmeticMeanTick, baseAmount, baseToken, quoteToken);
}
```

## Data Flow

### Deposit Flow

```
User                WToken              LeverageAMM          V3LPVault           StakingVault
  │                   │                     │                    │                    │
  │ deposit(ETH)      │                     │                    │                    │
  ├──────────────────►│                     │                    │                    │
  │                   │ calculateShares()   │                    │                    │
  │                   ├────────────────────►│                    │                    │
  │                   │                     │ borrowMIM()        │                    │
  │                   │                     ├───────────────────────────────────────►│
  │                   │                     │◄────────────────────────────────────────┤
  │                   │                     │                    │                    │
  │                   │                     │ addLiquidity()     │                    │
  │                   │                     ├───────────────────►│                    │
  │                   │                     │                    │ mint NFT positions │
  │                   │                     │◄───────────────────┤                    │
  │                   │◄────────────────────┤                    │                    │
  │ receive wTokens   │                     │                    │                    │
  │◄──────────────────┤                     │                    │                    │
```

### Withdrawal Flow

```
User                WToken              LeverageAMM          V3LPVault           StakingVault
  │                   │                     │                    │                    │
  │ withdraw(wTokens) │                     │                    │                    │
  ├──────────────────►│                     │                    │                    │
  │                   │ burn wTokens        │                    │                    │
  │                   │ calculateAssets()   │                    │                    │
  │                   ├────────────────────►│                    │                    │
  │                   │                     │ removeLiquidity()  │                    │
  │                   │                     ├───────────────────►│                    │
  │                   │                     │◄───────────────────┤                    │
  │                   │                     │ repayMIM()         │                    │
  │                   │                     ├───────────────────────────────────────►│
  │                   │                     │◄────────────────────────────────────────┤
  │                   │◄────────────────────┤                    │                    │
  │ receive ETH       │                     │                    │                    │
  │◄──────────────────┤                     │                    │                    │
```

## Security Considerations

### Access Control

| Function | Access Level |
|----------|--------------|
| `mint` (MIM) | Authorized minters only |
| `setMinter` | Owner only |
| `rebalance` | Anyone (incentivized) |
| `pause` | Owner or Guardian |
| `deposit/withdraw` | Any user |

### Risk Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Max DTV | 66% | Buffer before liquidation |
| Target DTV | 50% | Optimal for 0 IL |
| Min DTV | 40% | Trigger to add leverage |
| Max Utilization | 90% | Ensure withdrawal liquidity |
| TWAP Window | 30 min | Balance freshness vs manipulation resistance |

### Invariants

1. **DTV Invariant**: `40% ≤ DTV ≤ 66%` (except during rebalancing)
2. **Utilization Invariant**: `utilization ≤ 90%`
3. **Supply Invariant**: `totalWTokens * tokenValue = netVaultValue`
4. **MIM Backing**: `MIM supply ≤ USDC collateral`

## Gas Optimization

### Batch Operations

- Multiple layer rebalancing in single transaction
- Compound fee collection across all positions
- Bulk deposit/withdrawal support

### Storage Optimization

- Packed structs for position data
- Immutable variables for constants
- Minimal storage writes during rebalancing

## Upgrade Path

The protocol uses a modular design allowing individual component upgrades:

1. **WToken**: Immutable (security critical)
2. **V3LPVault**: Upgradeable via proxy
3. **LeverageAMM**: Upgradeable via proxy
4. **Oracle**: Replaceable by governance
5. **StakingVault**: Upgradeable via proxy

## Deployed Addresses (Sonic Mainnet)

| Contract | Address |
|----------|---------|
| MIM | `0x...` |
| sMIM (StakingVault) | `0x...` |
| wETH Vault | `0x...` |
| wBTC Vault | `0x...` |
| Oracle | `0x...` |

*Addresses to be updated after deployment*

