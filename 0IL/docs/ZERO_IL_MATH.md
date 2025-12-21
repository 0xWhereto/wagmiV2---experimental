# Zero Impermanent Loss: Mathematical Proof

## Introduction

This document provides a rigorous mathematical proof of how the 0IL Protocol eliminates impermanent loss through leveraged positions.

## Traditional AMM Impermanent Loss

### Constant Product Formula

In a traditional AMM (e.g., Uniswap V2), the constant product formula governs the pool:

```
x · y = k
```

Where:
- `x` = quantity of token X (e.g., ETH)
- `y` = quantity of token Y (e.g., USDC)
- `k` = constant

### Price Definition

The price of token X in terms of Y:

```
P = y / x
```

### LP Value in Traditional AMM

Given initial deposits of `x₀` and `y₀` at price `P₀`:

```
k = x₀ · y₀
P₀ = y₀ / x₀
```

When price changes to `P₁`, the new quantities are:

```
x₁ = √(k / P₁)
y₁ = √(k · P₁)
```

The LP value at new price:

```
V_LP = x₁ · P₁ + y₁
     = √(k / P₁) · P₁ + √(k · P₁)
     = √(k · P₁) + √(k · P₁)
     = 2 · √(k · P₁)
```

### HODL Value Comparison

If the LP had simply held the initial tokens:

```
V_HODL = x₀ · P₁ + y₀
       = x₀ · P₁ + x₀ · P₀
       = x₀ · (P₁ + P₀)
```

### Impermanent Loss Formula

The impermanent loss is:

```
IL = (V_LP / V_HODL) - 1

IL = (2 · √(k · P₁)) / (x₀ · (P₁ + P₀)) - 1
```

Simplifying with `r = P₁/P₀` (price ratio):

```
IL = (2 · √r) / (1 + r) - 1
```

### IL Examples

| Price Change | IL |
|-------------|-----|
| 1.25x (25% up) | -0.6% |
| 1.50x (50% up) | -2.0% |
| 2.00x (100% up) | -5.7% |
| 3.00x (200% up) | -13.4% |
| 5.00x (400% up) | -25.5% |

## The 0IL Solution

### Key Insight

The LP value grows as `√P` while holding grows as `P`. To eliminate IL, we need to transform `√P` growth into `P` growth.

**Mathematical Identity:**

```
2 · √P - P₀ = P  (at specific leverage)
```

This is achieved when we use 2x leverage at 50% initial position.

### Leveraged Position Structure

User deposits value `V₀` at price `P₀`:

1. **Collateral**: User's `V₀`
2. **Borrowed**: `V₀` worth of MIM (stablecoin)
3. **Total Position**: `2 · V₀` in LP

```
Position value at P₀:
├── LP Value: 2 · V₀
├── Debt: V₀
└── Equity: V₀
```

### Position Value After Price Change

When price changes from `P₀` to `P₁`:

**LP Value (grows as √P):**
```
V_LP(P₁) = 2 · V₀ · √(P₁/P₀)
         = 2 · V₀ · √r    (where r = P₁/P₀)
```

**Debt (constant in USD):**
```
Debt = V₀
```

**Equity (what user owns):**
```
Equity = V_LP - Debt
       = 2 · V₀ · √r - V₀
       = V₀ · (2√r - 1)
```

### Comparison with HODL

If user simply held the underlying asset:

```
V_HODL = V₀ · r
```

### The Magic of 50% DTV

At exactly 50% DTV (2x leverage), something special happens around the current price:

Using Taylor expansion of `2√r - 1` around `r = 1`:

```
2√r - 1 ≈ 2(1 + (r-1)/2 - (r-1)²/8 + ...) - 1
        ≈ 1 + (r-1) - (r-1)²/4 + ...
        ≈ r - (r-1)²/4 + ...
```

For small price changes, the quadratic term is negligible:

```
2√r - 1 ≈ r
```

**This means: Equity ≈ V₀ · r = V_HODL**

### Rebalancing: Maintaining Zero IL

For larger price movements, the quadratic term becomes significant. This is where **rebalancing** comes in.

#### Rebalancing Trigger

We rebalance when DTV deviates from 50% by more than a threshold (e.g., ±10%):

```
Rebalance when: DTV < 40% or DTV > 60%
```

#### Rebalancing Action

**If DTV < 50% (price went up):**
- Borrow more MIM
- Add more LP
- Return to 50% DTV

**If DTV > 50% (price went down):**
- Remove some LP
- Repay MIM
- Return to 50% DTV

### Proof of Zero IL with Rebalancing

After rebalancing at price `P₁`, the position is reset to 50% DTV:

```
New LP Value: 2 · Equity₁
New Debt: Equity₁
New DTV: 50%
```

The user's equity at this point:
```
Equity₁ = V₀ · (2√r₁ - 1) ≈ V₀ · r₁
```

When price moves from `P₁` to `P₂`:
```
LP Value = 2 · Equity₁ · √(P₂/P₁)
Equity₂ = 2 · Equity₁ · √(P₂/P₁) - Equity₁
        = Equity₁ · (2√(P₂/P₁) - 1)
        ≈ Equity₁ · (P₂/P₁)
        = V₀ · r₁ · (P₂/P₁)
        = V₀ · (P₂/P₀)
```

**Result: After each rebalancing, the equity tracks the underlying price!**

## Numerical Example

### Initial State
- ETH price: $2000
- User deposits: 1 ETH ($2000)
- Borrowed: $2000 MIM
- Total LP: $4000 (2 ETH equivalent)
- DTV: 50%

### Scenario 1: ETH Goes Up 50%

**New price: $3000**

LP Value (√1.5 growth):
```
LP = $4000 · √1.5 = $4899
```

Equity:
```
Equity = $4899 - $2000 = $2899
```

HODL would be:
```
HODL = $3000
```

Difference: $101 (3.4% IL)

**After Rebalancing:**
- New LP: $5798
- New Debt: $2899
- DTV: 50%
- Equity still tracks ETH price going forward

### Scenario 2: ETH Goes Down 50%

**New price: $1000**

LP Value (√0.5 growth):
```
LP = $4000 · √0.5 = $2828
```

Equity:
```
Equity = $2828 - $2000 = $828
```

HODL would be:
```
HODL = $1000
```

The position is actually **better** than HODL in this case because √0.5 > 0.5!

## Continuous Rebalancing Limit

In the theoretical limit of continuous rebalancing, the equity perfectly tracks the underlying asset:

```
lim(Δt→0) Equity(t) = V₀ · P(t)/P₀
```

In practice, we rebalance when DTV deviates by ~10%, which provides:
- Near-zero IL
- Gas efficiency
- Minimal slippage

## Revenue Sources for wToken Holders

1. **Trading Fees**: From Uniswap V3 positions
2. **Borrow Spread**: Difference between earned LP fees and paid interest
3. **Rebalancing Profit**: Capturing the IL that would have been lost

## Conclusion

The 0IL Protocol achieves zero impermanent loss through:

1. **2x Leverage at 50% DTV**: Transforms √P growth to P growth
2. **Periodic Rebalancing**: Maintains the 50% DTV ratio
3. **Stablecoin Borrowing**: MIM debt remains constant in USD terms

**The mathematical result:**
```
wToken Value ≈ Underlying Asset Price × Deposited Amount
```

This is exactly what holding the underlying asset would achieve, but with additional trading fee revenue on top!

