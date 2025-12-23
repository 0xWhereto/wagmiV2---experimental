# 0IL Protocol Bug Report & Fix Proposals

**Date:** December 23, 2025
**Auditor:** Claude AI (Swarm-Orchestrated Analysis)
**Scope:** 0IL Protocol on Sonic (Chain ID: 146)

---

## Executive Summary

Comprehensive parallel investigation using multi-agent analysis identified **3 critical bugs** and **1 high severity issue**. Root causes and fix proposals are provided for each.

| Bug ID | Severity | Title | Root Cause |
|--------|----------|-------|------------|
| BUG-003 | 🔴 CRITICAL | sMIM Withdrawal Fails | Accrued interest inflates withdrawal calculation |
| BUG-005 | 🔴 CRITICAL | Weekly Interest Never Initialized | Missing constructor initialization |
| BUG-007 | 🔴 CRITICAL | wETH Vault Deposit Fails | V3LPVault layers not configured |
| BUG-006 | 🟠 HIGH | Fee Distribution Shortfall | No accumulated fees due to BUG-007 |

---

## BUG-003: sMIM Withdrawal Failure

### Severity: 🔴 CRITICAL
### Contract: `0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7` (MIMStakingVault)
### Status: User funds LOCKED

### Root Cause

The `withdraw()` function fails because `totalAssets()` includes accrued unpaid interest in `totalBorrows`, but the actual liquid cash (`getCash()`) hasn't received that interest yet.

**Code Flow:**
```
withdraw(shares) → accrueInterest() → convertToAssets(shares) → totalAssets()
                                        ↓
                        totalAssets = getCash() + totalBorrows - totalReserves
                                        ↓
                        assets = (shares * totalAssets) / totalSupply
                                        ↓
                        if (assets > getCash()) revert InsufficientLiquidity()  ← FAILS
```

**Example Scenario:**
- User deposits 1000 MIM
- 500 MIM borrowed by LeverageAMM
- Interest accrues: `totalBorrows` increases to 505 MIM (5 MIM interest)
- State:
  - `getCash()` = 500 MIM (actual liquid balance)
  - `totalBorrows` = 505 MIM (includes accrued interest)
  - `totalAssets()` = 500 + 505 = 1005 MIM
- User tries to withdraw all 1000 shares:
  - `assets = (1000 * 1005) / 1000 = 1005 MIM`
  - Check: `if (1005 > 500)` → **REVERTS with InsufficientLiquidity()**

### Affected Code

**File:** `/0IL/contracts/core/MIMStakingVault.sol`

```solidity
// Line 245-247 - The flawed calculation
function totalAssets() public view returns (uint256) {
    return getCash() + totalBorrows - totalReserves;  // Includes unpaid interest!
}

// Line 307-320 - The failing withdraw
function withdraw(uint256 shares) external nonReentrant returns (uint256 assets) {
    if (shares == 0) revert ZeroAmount();
    accrueInterest();
    assets = convertToAssets(shares);  // Uses inflated totalAssets()
    if (assets == 0) revert ZeroAmount();
    if (assets > getCash()) revert InsufficientLiquidity();  // ← FAILS HERE
    // ...
}
```

### Fix Proposal

**Option A: Cap withdrawal at available liquidity (Recommended)**

```solidity
function withdraw(uint256 shares) external nonReentrant returns (uint256 assets) {
    if (shares == 0) revert ZeroAmount();

    accrueInterest();

    // Calculate theoretical assets
    assets = convertToAssets(shares);
    if (assets == 0) revert ZeroAmount();

    // Cap at available liquidity
    uint256 availableCash = getCash();
    if (assets > availableCash) {
        // Calculate how many shares can actually be redeemed
        uint256 redeemableShares = (availableCash * totalSupply()) / totalAssets();
        if (redeemableShares < shares) {
            // Partial withdrawal - only redeem what's available
            shares = redeemableShares;
            assets = availableCash;
        }
    }

    _burn(msg.sender, shares);
    mim.safeTransfer(msg.sender, assets);

    emit Withdraw(msg.sender, assets, shares);
}
```

**Option B: Use liquid assets only in calculation**

```solidity
function liquidAssets() public view returns (uint256) {
    return getCash();  // Only count actual liquid MIM
}

function withdrawablePortion() public view returns (uint256) {
    // Returns the fraction of shares that can be withdrawn (18 decimals)
    uint256 cash = getCash();
    uint256 total = totalAssets();
    if (total == 0) return WAD;
    return (cash * WAD) / total;
}
```

---

## BUG-005: Weekly Interest Never Initialized

### Severity: 🔴 CRITICAL
### Contract: `0x8CA24d00ffcF60e9ba7F67F9d41ccA28E22dF508` (LeverageAMM)
### Status: 7-day fee cycle non-functional

### Root Cause

The `lastWeeklyPayment` state variable is never initialized in the constructor, defaulting to 0 (Unix epoch: January 1, 1970).

### Affected Code

**File:** `/0IL/contracts/core/LeverageAMM.sol`

```solidity
// Line 71 - Uninitialized variable
uint256 public lastWeeklyPayment;  // Defaults to 0!

// Lines 109-126 - Constructor missing initialization
constructor(
    address _underlyingAsset,
    address _mim,
    address _stakingVault,
    address _v3LPVault,
    address _oracle
) Ownable(msg.sender) {
    underlyingAsset = IERC20(_underlyingAsset);
    mim = IERC20(_mim);
    stakingVault = IMIMStakingVault(_stakingVault);
    v3LPVault = IV3LPVault(_v3LPVault);
    oracle = IOracleAdapter(_oracle);

    // Approvals
    underlyingAsset.approve(_v3LPVault, type(uint256).max);
    mim.approve(_v3LPVault, type(uint256).max);
    mim.approve(_stakingVault, type(uint256).max);

    // MISSING: lastWeeklyPayment = block.timestamp;
}
```

### Impact

- `isWeeklyPaymentDue()` always returns `true` (since any timestamp > 604800)
- `payWeeklyInterest()` can be called immediately without waiting 7 days
- Weekly cycle timing is completely wrong

### Fix Proposal

**Add initialization to constructor:**

```solidity
constructor(
    address _underlyingAsset,
    address _mim,
    address _stakingVault,
    address _v3LPVault,
    address _oracle
) Ownable(msg.sender) {
    underlyingAsset = IERC20(_underlyingAsset);
    mim = IERC20(_mim);
    stakingVault = IMIMStakingVault(_stakingVault);
    v3LPVault = IV3LPVault(_v3LPVault);
    oracle = IOracleAdapter(_oracle);

    // Approvals
    underlyingAsset.approve(_v3LPVault, type(uint256).max);
    mim.approve(_v3LPVault, type(uint256).max);
    mim.approve(_stakingVault, type(uint256).max);

    // Initialize weekly payment timer
    lastWeeklyPayment = block.timestamp;  // ← ADD THIS LINE
}
```

**For deployed contract - add admin function:**

```solidity
/// @notice Initialize weekly payment timer (one-time use for deployed contracts)
/// @dev Should only be callable once when lastWeeklyPayment == 0
function initializeWeeklyPayment() external onlyOwner {
    require(lastWeeklyPayment == 0, "Already initialized");
    lastWeeklyPayment = block.timestamp;
}
```

---

## BUG-007: wETH Vault Deposit Failure

### Severity: 🔴 CRITICAL
### Contract: `0xEA7681f28c62AbF83DeD17eEd88D48b3BD813Af7` (WToken/wETH)
### Status: Deposits non-functional

### Root Cause

The V3LPVault at `0x1139d155D39b2520047178444C51D3D70204650F` was deployed but `setDefaultLayers()` was never called, leaving the `layers` array empty.

### Call Chain That Fails

```
WToken.deposit(amount, minShares)
  ↓
LeverageAMM.openPosition(amount)
  ↓
V3LPVault.addLiquidity(underlyingAmount, borrowAmount, 0, 0)
  ↓
if (layers.length == 0) revert InvalidLayers();  ← FAILS HERE
```

### Affected Code

**File:** `/0IL/contracts/core/V3LPVault.sol`

```solidity
// Line 270 - The check that fails
function addLiquidity(
    uint256 amount0Desired,
    uint256 amount1Desired,
    uint256 amount0Min,
    uint256 amount1Min
) external onlyOperator nonReentrant returns (uint256 liquidity) {
    if (layers.length == 0) revert InvalidLayers();  // ← FAILS
    // ...
}
```

### Fix (Immediate - No Redeployment)

**Call `setDefaultLayers()` on deployed V3LPVault:**

```javascript
// Using hardhat or ethers.js
const v3LPVault = await ethers.getContractAt("V3LPVault", "0x1139d155D39b2520047178444C51D3D70204650F");

// Set default layers (creates 4 standard layers)
await v3LPVault.setDefaultLayers();

// Verify
const layerCount = await v3LPVault.getLayerCount();
console.log("Layers configured:", layerCount.toString());  // Should be 4
```

### Default Layer Configuration

When `setDefaultLayers()` is called, it creates:

| Layer | Tick Range | Weight |
|-------|------------|--------|
| 1 | ±0.5% | 40% |
| 2 | ±1.0% | 30% |
| 3 | ±2.0% | 20% |
| 4 | ±5.0% | 10% |

---

## BUG-006: Fee Distribution Shortfall

### Severity: 🟠 HIGH
### Contract: `0x8CA24d00ffcF60e9ba7F67F9d41ccA28E22dF508` (LeverageAMM)
### Status: No fees accumulated

### Root Cause

This is a **cascading effect** of BUG-007:
- Since deposits fail, no LP positions are created
- No LP positions = no trading fees generated
- No fees = nothing to distribute

### Evidence

```
Accumulated Fees: 0.0 MIM
Expected Weekly Interest: 0.000000328907881644 MIM
Shortfall: 0.000000328907881644 MIM
```

### Fix

Once BUG-007 is resolved (V3LPVault layers configured), this issue will self-resolve as:
1. Deposits will work
2. LP positions will generate trading fees
3. Fees will accumulate for weekly distribution

---

## Deployment Fix Script

Create and run this script to fix the deployed contracts:

```typescript
// scripts/fix0ILDeployment.ts
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Fixing 0IL deployment with:", deployer.address);

  const V3LPVault = "0x1139d155D39b2520047178444C51D3D70204650F";

  // ABI for the functions we need
  const V3LPVault_ABI = [
    "function setDefaultLayers() external",
    "function getLayerCount() view returns (uint256)",
    "function owner() view returns (address)",
  ];

  const v3Vault = new ethers.Contract(V3LPVault, V3LPVault_ABI, deployer);

  // Check if we're the owner
  const owner = await v3Vault.owner();
  console.log("V3LPVault owner:", owner);
  console.log("Deployer:", deployer.address);

  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("ERROR: Not the owner of V3LPVault");
    return;
  }

  // Check current layer count
  const layersBefore = await v3Vault.getLayerCount();
  console.log("Layers before:", layersBefore.toString());

  if (layersBefore.toString() === "0") {
    console.log("Setting default layers...");
    const tx = await v3Vault.setDefaultLayers({ gasLimit: 500000 });
    await tx.wait();
    console.log("✅ Layers set! Tx:", tx.hash);

    const layersAfter = await v3Vault.getLayerCount();
    console.log("Layers after:", layersAfter.toString());
  } else {
    console.log("Layers already configured");
  }

  console.log("\n✅ Fix complete!");
}

main().catch(console.error);
```

**Run with:**
```bash
npx hardhat run scripts/fix0ILDeployment.ts --network sonic
```

---

## Priority Order for Fixes

1. **IMMEDIATE (BUG-007):** Call `setDefaultLayers()` on V3LPVault
   - Enables deposits to work
   - Enables fee generation

2. **IMPORTANT (BUG-005):** Initialize `lastWeeklyPayment`
   - Requires owner to call initialization function
   - Or redeploy LeverageAMM with fix

3. **REQUIRES MIGRATION (BUG-003):** Fix withdrawal logic
   - Requires contract upgrade or redeployment
   - Consider proxy pattern for future upgrades

---

## Test Results Summary

| Step | Test | Status | Notes |
|------|------|--------|-------|
| 1 | Mint 1 MIM | ⏭️ SKIP | No sUSDC balance |
| 2 | Stake MIM | ✅ PASS | Works correctly |
| 3 | Withdraw sMIM | ❌ FAIL | BUG-003 |
| 4 | Swap MIM→sUSDC | ⏭️ SKIP | Skipped |
| 5 | Mint 1 MIM (again) | ⏭️ SKIP | No sUSDC |
| 6 | Stake MIM (again) | ✅ PASS | Works correctly |
| 7 | Join 0IL Vault | ❌ FAIL | BUG-007 |
| 8 | Fee Collection Review | ✅ PASS | Found BUG-005, BUG-006 |

---

## Conclusion

The 0IL protocol has a **sound mathematical foundation** but suffers from **deployment/initialization issues**:

1. **BUG-007** (layers not set) is the root cause of deposit failures
2. **BUG-005** (uninitialized timer) breaks the 7-day fee cycle
3. **BUG-003** (withdrawal logic) is a design flaw requiring code changes

**Immediate Actions:**
1. Call `setDefaultLayers()` on V3LPVault ← **Enables deposits**
2. Initialize `lastWeeklyPayment` on LeverageAMM ← **Fixes fee timing**

**Long-term Actions:**
1. Fix withdrawal logic in MIMStakingVault
2. Add comprehensive integration tests
3. Deploy keeper bot for weekly maintenance

---

*Report generated by AI-assisted multi-agent security review.*
