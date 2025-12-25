# 0IL Protocol Bug Report & Security Analysis

**Date:** December 23, 2025  
**Auditor:** Claude (AI-assisted review)  
**Scope:** MagicPool contracts on Sonic (chainId 146)  
**Network:** Sonic Mainnet

---

## Executive Summary

After comprehensive testing of the 0IL protocol including MIM minting, staking, withdrawal, and 0IL vault deposits, I discovered **4 critical issues**, **2 high severity issues**, and several notes/improvements.

### Test Results Summary
- ✅ **PASSED:** 6 tests
- ❌ **FAILED:** 2 tests  
- ⏭️ **SKIPPED:** 2 tests (due to insufficient token balances)

---

## Critical Issues (Severity: CRITICAL)

### BUG-001: Decimal Mismatch Between MIM and sMIM

**Severity:** 🔴 CRITICAL  
**Status:** Active on Mainnet  
**Affected Contract:** StakingVault (sMIM) at `0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7`

**Description:**
The sMIM vault reports 18 decimals while the underlying MIM token uses 6 decimals. This creates a 10^12 accounting discrepancy.

**Evidence from Testing:**
```
sMIM Decimals: 18
sMIM Total Supply: 24.725255993877847896 sMIM
MIM Balance in vault: 16,324,954,259,999.999855 MIM (displayed with 6 decimals)
User sMIM Balance: 24,725,255,993,877.847896 sMIM (displayed with 6 decimals)
```

**Root Cause:**
The deployed contract appears to be based on `0IL/core/MIMStakingVault.sol` which uses default 18 decimals, but the `magicpool/MIMToken.sol` explicitly returns 6 decimals to match USDC.

**Impact:**
- Share calculations are completely incorrect
- Users cannot properly withdraw their staked MIM
- The vault's `getVaultStats()` function reverts

**Recommended Fix:**
Deploy a new StakingVault that overrides decimals to match MIM (6 decimals), or migrate the MIM contract to use 18 decimals consistently.

---

### BUG-002: Weekly Interest Payment Never Initialized

**Severity:** 🔴 CRITICAL  
**Status:** Active on Mainnet  
**Affected Contract:** LeverageAMM at `0x8CA24d00ffcF60e9ba7F67F9d41ccA28E22dF508`

**Description:**
The `lastWeeklyPayment` timestamp is set to 0 (Unix epoch 1970-01-01), indicating the weekly interest payment system was never initialized.

**Evidence from Testing:**
```
Last Weekly Payment: 1970-01-01T00:00:00.000Z
Days Since Payment: 20,445.42 days (~56 years overdue!)
Is Payment Due: true
```

**Impact:**
- sMIM stakers are not receiving their priority interest payments
- The 7-day fee collection and distribution mechanism is non-functional
- Protocol fee collection to treasury is not working

**Recommended Fix:**
1. Call `startNewWeek()` or equivalent initialization function
2. Implement automatic initialization in the constructor
3. Add a migration function to set the correct initial timestamp

---

### BUG-003: sMIM Vault Functions Revert

**Severity:** 🔴 CRITICAL  
**Status:** Active on Mainnet  
**Affected Contract:** StakingVault (sMIM)

**Description:**
Multiple essential vault functions revert when called:
- `getVaultStats()` - reverts
- `totalBorrowed()` - reverts
- `authorizedBorrowers(address)` - reverts
- `borrowedAmount(address)` - reverts
- `availableLiquidity()` - reverts

**Evidence from Testing:**
```
❌ sMIM Vault State: Failed to fetch vault stats
   Error: missing revert data in call exception; Transaction reverted without a reason string
```

**Root Cause:**
The deployed contract's ABI does not match the expected ABI. Either:
1. A different contract version was deployed
2. The contract was deployed with a different interface
3. The contract has storage corruption

**Impact:**
- Users cannot view vault statistics
- Borrowing operations may be affected
- Protocol monitoring is impossible

---

### BUG-004: sMIM Withdrawal Fails

**Severity:** 🔴 CRITICAL  
**Status:** Active on Mainnet  
**Affected Contract:** StakingVault (sMIM)

**Description:**
Users cannot withdraw their staked MIM from the sMIM vault.

**Evidence from Testing:**
```
Have 24725255993877.847896 sMIM, withdrawing 12362627996938.923948...
❌ sMIM Withdrawal: Withdrawal failed
   Error: missing revert data in call exception; Transaction reverted without a reason string
```

**Impact:**
- User funds are LOCKED in the vault
- No path to recover staked MIM
- Critical user impact

---

## High Severity Issues

### BUG-005: Weekly Interest Shortfall

**Severity:** 🟠 HIGH  
**Status:** Active on Mainnet  
**Affected Contract:** LeverageAMM

**Description:**
The LeverageAMM has 0 accumulated fees but owes ~0.004 MIM in weekly interest.

**Evidence from Testing:**
```
Accumulated Fees: 0.0 MIM
Expected Weekly Interest: 0.004027 MIM
Shortfall: 0.004027 MIM
```

**Impact:**
- sMIM stakers receive 0% of owed interest
- Fee distribution waterfall is broken
- wToken holders also receive nothing

---

### BUG-006: DTV Slightly Above Target

**Severity:** 🟡 MEDIUM  
**Status:** Monitoring Required  
**Affected Contract:** LeverageAMM

**Description:**
The current DTV ratio is 58.14%, above the 50% target but within acceptable range (40-60%).

**Evidence from Testing:**
```
LeverageAMM Total Debt: 2.099827029999999997 MIM
LeverageAMM Current DTV: 58.1367%
Target DTV: 50%
```

**Impact:**
- Slightly reduced capital efficiency
- Position is still healthy
- Rebalancing not urgently needed but recommended

---

## Working Features ✅

### 0IL Vault Deposit - WORKING

The core 0IL vault deposit functionality works correctly:

**Test Results:**
```
Deposited: 0.00034 sWETH (~$1 value)
wETH Received: 0.000504878413817171 wETH
Total Debt increased: 2.099 → 3.119 MIM (+1.02 MIM borrowed)
Total Underlying increased: 0.0007 → 0.00104 sWETH (+0.00034)
Gas Used: 947,089
```

**Verification:**
- ✅ sWETH correctly transferred to protocol
- ✅ wETH shares correctly minted to user  
- ✅ Leverage correctly applied (borrowed MIM from staking vault)
- ✅ Position correctly added to V3 LP

### Oracle - WORKING

The SimpleOracle correctly returns ETH price:
```
Oracle Price: 2999.75 MIM per sWETH (~$3000)
```

### V3 LP Vault - WORKING

The multi-layer V3 position manager is functional:
```
Layer Count: 4
Total Assets: token0=0.000604, token1=1.798
Pending Fees: 0 (no trading activity)
```

---

## 7-Day Fee Collection & Distribution Review

### Designed Flow (from INTEREST_RATE_MODEL.md):

```
Week 1: 0IL pools accumulate trading fees
        Daily utilization snapshots taken
        At week end: payWeeklyInterest() called

Fee Waterfall (Priority Order):
1. sMIM Weekly Interest (PRIORITY)
2. Protocol Fee (15%) → Treasury
3. wToken Holders (85%) → Increases wToken value
```

### Current Implementation Status:

| Feature | Status | Notes |
|---------|--------|-------|
| 7-day avg utilization | ❓ Unknown | Cannot verify due to contract issues |
| Weekly cycle tracking | ❌ Not initialized | lastWeeklyPayment = 0 |
| Fee accumulation | ✅ Present | accumulatedFees = 0 currently |
| sMIM priority payment | ❌ Not working | Never called |
| Protocol fee | ❌ Not working | Treasury not receiving fees |
| wToken fee distribution | ❌ Not working | pendingWTokenFees = 0 |

### Issues Found:

1. **startNewWeek()** has never been called
2. **payWeeklyInterest()** has never been called
3. No automated keeper/bot for weekly maintenance
4. 7-day utilization snapshots not being taken

---

## Deployed Contract Addresses (Sonic)

| Contract | Address | Status |
|----------|---------|--------|
| MIM | `0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708` | ✅ Working |
| sMIM (StakingVault) | `0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7` | 🔴 BROKEN |
| V3LPVault | `0x1139d155D39b2520047178444C51D3D70204650F` | ✅ Working |
| LeverageAMM | `0x8CA24d00ffcF60e9ba7F67F9d41ccA28E22dF508` | ⚠️ Partial |
| wETH | `0xEA7681f28c62AbF83DeD17eEd88D48b3BD813Af7` | ✅ Working |
| SimpleOracle | `0xD8680463F66C7bF74C61A2660aF4d7094ee9F749` | ✅ Working |
| sWETH/MIM Pool | `0x4ed3B3e2AD7e19124D921fE2F6956e1C62Cbf190` | ✅ Working |

---

## Recommendations

### Immediate Actions (Priority 1)

1. **Deploy New StakingVault**
   - Fix decimal mismatch (use 6 decimals to match MIM)
   - Migrate existing liquidity if possible
   - Or document that existing sMIM is non-withdrawable

2. **Initialize Weekly Cycle**
   ```solidity
   // Call these functions:
   stakingVault.startNewWeek();
   leverageAMM.payWeeklyInterest();
   ```

3. **Verify Contract ABIs**
   - Compare deployed bytecode with source
   - Ensure all functions are accessible

### Medium-term Actions (Priority 2)

1. **Deploy Keeper Bot**
   - Automate `snapshotUtilization()` daily
   - Automate `startNewWeek()` weekly
   - Automate `payWeeklyInterest()` weekly
   - Automate `rebalance()` when DTV drifts

2. **Add Circuit Breakers**
   - Pause functionality if DTV > 66%
   - Emergency withdrawal mechanism

3. **Improve Error Handling**
   - Add proper revert reasons
   - Emit events for all state changes

### Long-term Actions (Priority 3)

1. **Consider Migration**
   - Deploy fresh contracts with all fixes
   - Provide migration path for users

2. **Add Monitoring**
   - On-chain health checks
   - Off-chain monitoring dashboard
   - Alerts for abnormal conditions

---

## Test Commands Used

```bash
# Comprehensive test
npx hardhat run scripts/comprehensive0ILTest.ts --network sonic

# Deep investigation
npx hardhat run scripts/debug0ILDeep.ts --network sonic
```

---

## Conclusion

The 0IL protocol has a **sound mathematical foundation** for eliminating impermanent loss, and the core vault deposit functionality works correctly. However, the **staking vault (sMIM)** has critical issues that prevent users from withdrawing funds, and the **7-day fee distribution system** has never been initialized.

**Immediate action is required** to:
1. Address the locked funds in sMIM
2. Initialize the weekly interest payment cycle
3. Deploy proper monitoring infrastructure

The LeverageAMM and V3LPVault components are functioning correctly, demonstrating that the core 0IL mechanism is viable when properly deployed.

---

*Report generated by AI-assisted security review. Manual verification recommended for all findings.*


