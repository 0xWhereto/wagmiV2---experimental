# 0IL Fixed Contracts

This package contains fixed versions of the 0IL protocol contracts with bug fixes.

## Bugs Fixed

| Bug ID | Contract | Issue | Fix |
|--------|----------|-------|-----|
| BUG-002 | V3LPVault | `_getPositionAmounts()` returns wrong values (liquidity/2) | Proper Uniswap V3 tick-based calculation |
| BUG-003 | MIMStakingVault | Withdrawal fails when accrued interest > cash | Caps withdrawal at available liquidity |
| BUG-005 | LeverageAMM | `lastWeeklyPayment` never initialized | Constructor sets `block.timestamp` |

## Package Contents

```
contracts-fixed/
├── MIMStakingVaultFixed.sol    # Fixed staking vault contract
├── LeverageAMMFixed.sol        # Fixed leverage AMM contract
├── V3LPVaultFixed.sol          # Fixed V3 LP vault with correct position amounts
├── abis/
│   ├── MIMStakingVaultFixed.json
│   ├── LeverageAMMFixed.json
│   └── V3LPVaultFixed.json
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

### V3LPVaultFixed

The critical fix is in `_getPositionAmounts()` which now properly calculates token amounts:

```solidity
// OLD (BROKEN):
function _getPositionAmounts(uint256 tokenId) internal view returns (uint256, uint256) {
    (,,,,,,, uint128 liquidity,,,,) = positionManager.positions(tokenId);
    return (uint256(liquidity) / 2, uint256(liquidity) / 2);  // WRONG!
}

// NEW (FIXED):
function _getPositionAmounts(uint256 tokenId) internal view returns (uint256 amount0, uint256 amount1) {
    // Get position tick range and liquidity
    (,,,,,int24 tickLower, int24 tickUpper, uint128 liquidity,,,,) = positionManager.positions(tokenId);

    // Get current price from pool
    (uint160 sqrtPriceX96, int24 currentTick,,,,,) = pool.slot0();

    // Calculate amounts based on current tick vs position range
    // Uses proper Uniswap V3 math with sqrtPrice calculations
    ...
}
```

New view functions:
- `getTotalAssets()` - Returns correct (amount0, amount1) across all layers
- `getPendingFees()` - Returns pending fees (fee0, fee1)
- `getLayerCount()` - Number of configured layers
- `getLayer(index)` - Get layer configuration
- `getLayerPosition(index)` - Get position info with amounts

## Migration Notes

### For Existing Users

1. Users with funds in the old `sMIM` vault may need to migrate
2. The old vault's withdrawal bug means some funds may be temporarily locked
3. Once old loans are repaid, withdrawals should work

### For New Deployments

1. Deploy `MIMStakingVaultFixed` first
2. Deploy `V3LPVaultFixed` (if deploying new) or use existing
3. Deploy `LeverageAMMFixed` with new staking vault and V3LPVault addresses
4. Configure borrower permissions on staking vault
5. Set LeverageAMM as operator on V3LPVault
6. Call `setDefaultLayers()` on V3LPVault
7. Deploy new `WToken` pointing to new `LeverageAMMFixed`

## Using V3LPVault Hooks

```typescript
import {
  useV3LPVaultStats,
  useV3LPVaultLayer,
  useV3LPVaultCollectFees,
  useV3LPVaultRebalance,
} from './contracts-fixed';

function V3VaultComponent() {
  const { totalToken0, totalToken1, pendingFee0, pendingFee1, layerCount } = useV3LPVaultStats();
  const { layer, position, formatted } = useV3LPVaultLayer(0);
  const { collectFees, isPending } = useV3LPVaultCollectFees();
  const { rebalance } = useV3LPVaultRebalance();

  return (
    <div>
      <p>Total Token0: {formatted?.totalToken0}</p>
      <p>Total Token1: {formatted?.totalToken1}</p>
      <p>Layer 0 Range: {formatted?.tickRange}</p>
      <button onClick={collectFees}>Collect Fees</button>
      <button onClick={rebalance}>Rebalance</button>
    </div>
  );
}
```
