# User Guide

## Introduction

Welcome to the 0IL Protocol! This guide will help you understand how to use the protocol to earn yield on your assets without impermanent loss.

## Quick Start

### Prerequisites

- A Web3 wallet (MetaMask, Rabby, etc.)
- Some ETH/BTC for depositing
- Some ETH for gas fees
- Connected to Sonic network

## For Liquidity Providers (wToken Holders)

### What are wTokens?

wTokens (wETH, wBTC) are receipt tokens representing your share in the zero-IL liquidity vault. They:

- Track the underlying asset price 1:1
- Earn trading fees from Uniswap V3
- Have NO impermanent loss
- Are fully liquid and transferable

### How to Deposit

1. **Connect Wallet**: Click "Connect Wallet" and select your preferred wallet

2. **Navigate to Vaults**: Go to Liquidity → Strategies → Vaults

3. **Select Vault**: Choose between wETH or wBTC vault

4. **Enter Amount**: Input the amount you want to deposit

5. **Approve** (first time only): Approve the vault to spend your tokens

6. **Deposit**: Confirm the deposit transaction

7. **Receive wTokens**: Your wallet will receive wETH or wBTC tokens

### How to Withdraw

1. **Navigate to Vaults**: Go to Liquidity → Strategies → Vaults

2. **Select Vault**: Click "Manage" on your active position

3. **Enter Withdrawal Amount**: Use the slider or input field

4. **Preview**: See how much ETH/BTC you'll receive

5. **Withdraw**: Confirm the withdrawal transaction

6. **Receive Assets**: Your original assets are returned

### Understanding Your Returns

Your wToken value increases from:

1. **Trading Fees**: ~5-20% APR depending on volume
2. **Fee Compounding**: Fees are auto-reinvested
3. **Zero IL**: You keep 100% of price gains

**Example:**
```
Day 1: Deposit 1 ETH ($2000)
       Receive 1 wETH

Day 30: ETH price: $2400 (+20%)
        Your wETH value: ~$2450
        ├── Price appreciation: +$400
        └── Trading fees: ~$50

        Traditional LP would give: ~$2380 (after IL)
        Your extra profit: ~$70
```

## For MIM Stakers (sMIM Holders)

### What is sMIM?

sMIM (Staked MIM) is a yield-bearing token that earns interest from:
- Borrow fees paid by wToken vaults
- Protocol revenue share

### How to Stake MIM

1. **Get MIM**: 
   - Mint MIM by depositing USDC (1:1 ratio)
   - Or buy MIM on DEX

2. **Navigate to MagicPool**: Click "MagicPool" in the navigation

3. **Go to Supply Tab**: Select the "Supply" tab

4. **Enter Amount**: Input MIM amount to stake

5. **Approve** (first time): Approve MIM spending

6. **Stake**: Confirm the staking transaction

7. **Receive sMIM**: Your wallet receives sMIM tokens

### How to Unstake

1. **Navigate to MagicPool**: Go to the MagicPool page

2. **View Position**: Check your current sMIM balance

3. **Enter Withdrawal Amount**: Input amount to unstake

4. **Withdraw**: Confirm the transaction

5. **Receive MIM**: MIM is returned to your wallet (including earned interest)

### Understanding sMIM APY

The APY depends on vault utilization:

| Utilization | APY (after protocol fee) |
|-------------|--------------------------|
| 40% | ~5.3% |
| 60% | ~9.3% |
| 80% | ~14.1% |
| 90% | ~24.0% |

**Note**: Higher utilization = higher APY but less available liquidity

## Minting MIM

### Why Mint MIM?

- 1:1 backed by USDC (no slippage)
- Use MIM across the protocol
- Stake for yield

### How to Mint

1. **Navigate to MagicPool**: Go to the MagicPool page

2. **Select Mint Tab**: Click on "Mint" tab

3. **Enter USDC Amount**: Input how much USDC to deposit

4. **Approve USDC**: Allow the contract to spend USDC

5. **Mint**: Confirm the minting transaction

6. **Receive MIM**: 1 USDC = 1 MIM (no fees)

### How to Redeem

1. **Navigate to MagicPool**: Go to the MagicPool page

2. **Enter MIM Amount**: Input MIM to redeem

3. **Redeem**: Confirm the transaction

4. **Receive USDC**: 1 MIM = 1 USDC (no fees)

## Dashboard Overview

### Portfolio View

Your dashboard shows:

- **Total Value**: Combined value of all positions
- **24h Change**: Daily profit/loss
- **Positions**: List of active positions with:
  - Current value
  - PnL (profit/loss)
  - APR earned

### Position Management

From the dashboard, you can:

- View detailed position info
- Add to existing positions
- Partially or fully withdraw
- Track historical performance

## Risk Considerations

### Smart Contract Risk

- Contracts are audited but not guaranteed bug-free
- Only deposit what you can afford to lose
- Consider using multiple wallets

### Oracle Risk

- Prices come from Uniswap V3 TWAP
- 30-minute average prevents manipulation
- Extreme volatility may cause delayed rebalancing

### Liquidity Risk

- 90% max utilization ensures some liquidity always available
- During high demand, withdrawals may face delays
- Large withdrawals may need to be split

### Protocol Risk

- New protocol without long track record
- Governance could change parameters
- Emergency pause possible by admin

## Frequently Asked Questions

### How is this different from regular LP?

Regular LP suffers impermanent loss when prices move. Our leveraged structure eliminates IL while maintaining fee earning potential.

### What if ETH/BTC crashes?

Your wToken value tracks the asset price. If ETH drops 50%, your wETH drops ~50% too (same as just holding ETH). The difference is you also earned trading fees during that time.

### Can I get liquidated?

No. wToken positions have no liquidation risk. The leverage is internal to the protocol, not margin trading.

### How often is rebalancing?

Rebalancing happens when the debt-to-value ratio deviates by more than 10% from the 50% target. This is typically every few days during normal volatility.

### What are the fees?

- **Deposit/Withdraw**: No fee
- **Protocol Fee**: 10% of borrow interest goes to treasury
- **No performance fee**: You keep 100% of your gains

### Is there a lock-up period?

No. You can withdraw anytime (subject to 90% max utilization).

### How do I see my historical returns?

The dashboard shows your:
- Entry price
- Current value
- Total PnL
- Realized vs unrealized gains

## Support

Need help? Reach out:

- **Discord**: [Join our server](#)
- **Twitter**: [@0xWhereto](#)
- **Documentation**: [docs.wagmi.com](#)
- **FAQ**: [faq.wagmi.com](#)


