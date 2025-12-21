# Interest Rate Model

## Overview

The 0IL Protocol uses a **kinked interest rate model** similar to Compound and Aave. This model incentivizes optimal capital utilization while ensuring sufficient liquidity for withdrawals.

## Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| Base Rate | 10% | Minimum rate at 0% utilization |
| Multiplier | 12% | Rate increase per 100% utilization (before kink) |
| Jump Multiplier | 100% | Rate increase per 100% utilization (after kink) |
| Kink | 80% | Utilization point where rates accelerate |
| Max Utilization | 90% | Hard cap on utilization |

## Rate Calculation

### Below Kink (0% - 80% utilization)

```
rate = BASE_RATE + (utilization × MULTIPLIER)
     = 10% + (utilization × 12%)
```

| Utilization | Rate |
|-------------|------|
| 0% | 10.0% |
| 20% | 12.4% |
| 40% | 14.8% |
| 60% | 17.2% |
| 80% | 19.6% |

### Above Kink (80% - 90% utilization)

```
normalRate = BASE_RATE + (KINK × MULTIPLIER)
           = 10% + (80% × 12%)
           = 19.6%

rate = normalRate + ((utilization - KINK) × JUMP_MULTIPLIER)
     = 19.6% + ((utilization - 80%) × 100%)
```

| Utilization | Rate |
|-------------|------|
| 80% | 19.6% |
| 82% | 21.6% |
| 85% | 24.6% |
| 88% | 27.6% |
| 90% | 29.6% |

## Visualization

```
APR (%)
    │
 30 │                            ╱
    │                          ╱
 25 │                        ╱
    │                      ╱
 20 │                 ───•
    │            ──•
 15 │       ──•
    │   ──•
 10 │──•
    │
  0 └──────────────────────────────────────► Utilization (%)
      0    20    40    60    80    90   100
                              │
                              └── Kink
```

## Solidity Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract InterestRateModel {
    uint256 public constant BASE_RATE = 0.10e18;        // 10%
    uint256 public constant MULTIPLIER = 0.12e18;        // 12%
    uint256 public constant JUMP_MULTIPLIER = 1.00e18;   // 100%
    uint256 public constant KINK = 0.80e18;              // 80%
    uint256 public constant MAX_UTILIZATION = 0.90e18;   // 90%
    uint256 public constant WAD = 1e18;
    
    /**
     * @notice Calculate the borrow rate based on utilization
     * @param cash Available liquidity in vault
     * @param borrows Total amount borrowed
     * @return Borrow rate per year (18 decimals)
     */
    function getBorrowRate(
        uint256 cash,
        uint256 borrows
    ) public pure returns (uint256) {
        uint256 utilization = getUtilization(cash, borrows);
        
        if (utilization <= KINK) {
            // rate = BASE_RATE + util * MULTIPLIER
            return BASE_RATE + (utilization * MULTIPLIER / WAD);
        } else {
            // Normal rate at kink
            uint256 normalRate = BASE_RATE + (KINK * MULTIPLIER / WAD);
            // Excess utilization above kink
            uint256 excessUtil = utilization - KINK;
            // rate = normalRate + excessUtil * JUMP_MULTIPLIER
            return normalRate + (excessUtil * JUMP_MULTIPLIER / WAD);
        }
    }
    
    /**
     * @notice Calculate supply rate (what lenders earn)
     * @param cash Available liquidity
     * @param borrows Total borrowed
     * @param reserveFactor Protocol fee (e.g., 0.1e18 = 10%)
     */
    function getSupplyRate(
        uint256 cash,
        uint256 borrows,
        uint256 reserveFactor
    ) public pure returns (uint256) {
        uint256 utilization = getUtilization(cash, borrows);
        uint256 borrowRate = getBorrowRate(cash, borrows);
        
        // supplyRate = borrowRate * utilization * (1 - reserveFactor)
        uint256 rateToSuppliers = borrowRate * (WAD - reserveFactor) / WAD;
        return rateToSuppliers * utilization / WAD;
    }
    
    /**
     * @notice Calculate utilization rate
     */
    function getUtilization(
        uint256 cash,
        uint256 borrows
    ) public pure returns (uint256) {
        if (cash + borrows == 0) return 0;
        return borrows * WAD / (cash + borrows);
    }
}
```

## Economic Rationale

### Why 10% Base Rate?

- Ensures lenders always earn meaningful yield
- Covers protocol operational costs
- Creates floor for borrow demand

### Why 80% Kink?

- Optimal utilization for capital efficiency
- Leaves 20% buffer for withdrawals
- Balances lender returns with borrower costs

### Why 90% Max Utilization?

- Guarantees 10% of deposits always available for withdrawal
- Prevents bank run scenarios
- Protects against sudden liquidity demands

### Why 100% Jump Multiplier?

- Creates strong incentive to stay below 90%
- Rates become prohibitive above kink
- Naturally attracts new capital or reduces borrowing

## Supply Rate Examples

Assuming 10% reserve factor:

| Utilization | Borrow Rate | Supply Rate |
|-------------|-------------|-------------|
| 0% | 10.0% | 0.0% |
| 40% | 14.8% | 5.3% |
| 60% | 17.2% | 9.3% |
| 80% | 19.6% | 14.1% |
| 90% | 29.6% | 24.0% |

## Protocol Fee Distribution

```
Borrow Interest Paid
        │
        ├── 90% → sMIM Holders (Lenders)
        │
        └── 10% → Protocol Treasury
```

## Interest Accrual

Interest accrues per block using compound interest:

```solidity
function accrueInterest() public {
    uint256 blockDelta = block.number - lastAccrualBlock;
    uint256 borrowRate = getBorrowRate(cash, totalBorrows);
    
    // Simple interest for gas efficiency (compounds at each interaction)
    uint256 interestFactor = borrowRate * blockDelta / BLOCKS_PER_YEAR;
    uint256 interestAccumulated = totalBorrows * interestFactor / WAD;
    
    totalBorrows += interestAccumulated;
    totalReserves += interestAccumulated * reserveFactor / WAD;
    lastAccrualBlock = block.number;
}
```

## Utilization Monitoring

### Healthy Range: 60-80%
- Optimal capital efficiency
- Reasonable rates for borrowers
- Good yields for lenders

### Warning Range: 80-90%
- Rates increasing rapidly
- Should attract more deposits
- Borrowing becomes expensive

### Critical: >90%
- Blocked state - no new borrows allowed
- Existing positions can only repay
- Very high rates incentivize rapid repayment

## Governance Parameters

The following parameters can be adjusted by governance:

| Parameter | Min | Max | Cooldown |
|-----------|-----|-----|----------|
| Base Rate | 1% | 20% | 7 days |
| Multiplier | 5% | 25% | 7 days |
| Jump Multiplier | 50% | 200% | 7 days |
| Kink | 60% | 90% | 7 days |
| Max Utilization | 85% | 95% | 7 days |
| Reserve Factor | 5% | 20% | 3 days |

## Comparison with Other Protocols

| Protocol | Base Rate | Max Rate | Kink |
|----------|-----------|----------|------|
| Compound (USDC) | 0% | ~15% | 80% |
| Aave (USDC) | 0% | ~20% | 90% |
| **0IL Protocol** | **10%** | **~30%** | **80%** |

Our higher base rate reflects:
1. Higher guaranteed yield for stakers
2. Premium for stablecoin lending
3. Risk compensation for novel protocol

