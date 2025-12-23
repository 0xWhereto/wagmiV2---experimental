# 0IL Fixed Contracts

This package contains fixed versions of the 0IL protocol contracts with bug fixes.

## Bugs Fixed

| Bug ID | Contract | Issue | Fix |
|--------|----------|-------|-----|
| BUG-003 | MIMStakingVault | Withdrawal fails when accrued interest > cash | Caps withdrawal at available liquidity |
| BUG-005 | LeverageAMM | `lastWeeklyPayment` never initialized | Constructor sets `block.timestamp` |

## Package Contents

```
contracts-fixed/
├── MIMStakingVaultFixed.sol    # Fixed staking vault contract
├── LeverageAMMFixed.sol        # Fixed leverage AMM contract
├── abis/
│   ├── MIMStakingVaultFixed.json
│   └── LeverageAMMFixed.json
├── config.ts                   # Addresses and ABIs configuration
├── hooks.ts                    # React hooks for wagmi
├── deploy.ts                   # Hardhat deployment script
├── index.ts                    # Package exports
└── README.md
```

## Quick Start

### 1. Deploy Fixed Contracts

```bash
# Set treasury address in deploy.ts first!
npx hardhat run contracts-fixed/deploy.ts --network sonic
```

### 2. Update Configuration

After deployment, update `config.ts` with the new addresses:

```typescript
export const FIXED_ADDRESSES = {
  MIMStakingVaultFixed: '0x...', // Your deployed address
  LeverageAMMFixed: '0x...',     // Your deployed address
  // ...
};
```

### 3. Use in React Components

```typescript
import {
  useVaultStats,
  useVaultDeposit,
  useVaultWithdraw,
  useMaxWithdrawable,
} from './contracts-fixed';

function StakingComponent() {
  const { formatted } = useVaultStats();
  const { maxAssets } = useMaxWithdrawable(userAddress);
  const { deposit, isPending } = useVaultDeposit();
  const { withdraw, withdrawExact } = useVaultWithdraw();

  return (
    <div>
      <p>Total Assets: {formatted.totalAssets} MIM</p>
      <p>Supply APY: {formatted.supplyRate}</p>
      <p>Max Withdrawable: {maxAssets?.formatted} MIM</p>

      <button onClick={() => deposit(parseWad('100'))}>
        Deposit 100 MIM
      </button>

      <button onClick={() => withdraw(maxAssets?.maxShares)}>
        Withdraw Max
      </button>
    </div>
  );
}
```

## Fixed Withdrawal Logic

The key fix in `MIMStakingVaultFixed` is the withdrawal function:

```solidity
function withdraw(uint256 shares) external returns (uint256 assets) {
    // Calculate theoretical assets
    uint256 theoreticalAssets = convertToAssets(shares);
    uint256 availableCash = getCash();

    if (theoreticalAssets <= availableCash) {
        // Full withdrawal
        assets = theoreticalAssets;
        _burn(msg.sender, shares);
    } else {
        // Partial withdrawal - cap at available cash
        assets = availableCash;
        uint256 actualShares = (assets * totalSupply()) / totalAssets();
        _burn(msg.sender, actualShares);
        emit PartialWithdraw(msg.sender, shares, actualShares, assets);
    }

    mim.safeTransfer(msg.sender, assets);
}
```

## New View Functions

### MIMStakingVaultFixed

- `liquidAssets()` - Returns actual cash available
- `maxWithdrawableShares(address)` - Max shares user can withdraw
- `maxWithdrawableAssets(address)` - Max assets user can withdraw
- `withdrawableRatio()` - Fraction of position withdrawable (WAD)
- `withdrawExact(uint256 assets)` - Withdraw exact asset amount

### LeverageAMMFixed

- `initializeWeeklyPayment()` - Fix for already deployed contracts
- Constructor initializes `lastWeeklyPayment = block.timestamp`

## Migration Notes

### For Existing Users

1. Users with funds in the old `sMIM` vault may need to migrate
2. The old vault's withdrawal bug means some funds may be temporarily locked
3. Once old loans are repaid, withdrawals should work

### For New Deployments

1. Deploy `MIMStakingVaultFixed` first
2. Deploy `LeverageAMMFixed` with new staking vault address
3. Configure borrower permissions
4. Deploy new `WToken` pointing to new `LeverageAMMFixed`
5. Set V3LPVault layers and operator

## Remaining Issue

**BUG-007** (V3LPVault layers not configured) requires calling:

```typescript
// On the existing V3LPVault contract
await v3LPVault.setDefaultLayers();
```

This is a configuration issue, not a code bug, and can be fixed on the existing deployment.
