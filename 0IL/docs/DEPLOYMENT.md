# Deployment Guide

## Overview

This guide covers deploying the 0IL Protocol contracts to various networks.

## Prerequisites

### Environment Setup

```bash
# Clone repository
git clone https://github.com/0xWhereto/wagmiV2---experimental.git
cd wagmiV2---experimental
git checkout 0IL

# Install dependencies
pnpm install

# Copy environment file
cp .env_example .env
```

### Configure Environment Variables

Edit `.env`:

```bash
# Private key (without 0x prefix)
PRIVATE_KEY=your_private_key_here

# RPC URLs
SONIC_RPC=https://rpc.soniclabs.com
ARBITRUM_RPC=https://arb1.arbitrum.io/rpc
ETHEREUM_RPC=https://ethereum-rpc.publicnode.com

# Etherscan API keys (for verification)
SONICSCAN_API_KEY=your_key
ARBISCAN_API_KEY=your_key
ETHERSCAN_API_KEY=your_key
```

## Deployment Order

The contracts must be deployed in this specific order due to dependencies:

```
1. MIM (Stablecoin)
     │
     └──► 2. MIMStakingVault (sMIM)
              │
              └──► 3. OracleAdapter
                        │
                        └──► 4. V3LPVault
                                  │
                                  └──► 5. LeverageAMM
                                            │
                                            └──► 6. WToken (wETH, wBTC)
```

## Network-Specific Configuration

### Sonic (Main Hub)

```typescript
const SONIC_CONFIG = {
  chainId: 146,
  lzEndpoint: "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B",
  usdc: "0x29219dd400f2Bf60E5a23d13Be72B486D4038894",
  uniswapV3Factory: "0x...", // Sonic Uniswap deployment
  nonfungiblePositionManager: "0x...",
};
```

### Arbitrum (Gateway)

```typescript
const ARBITRUM_CONFIG = {
  chainId: 42161,
  lzEndpoint: "0x1a44076050125825900e736c501f859c50fE728c",
  weth: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  wbtc: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
  usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
};
```

## Deployment Scripts

### Deploy MIM & Staking Vault

```typescript
// scripts/deploy-mim.ts
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // Deploy MIM
  const MIM = await ethers.getContractFactory("MIM");
  const mim = await MIM.deploy();
  await mim.deployed();
  console.log("MIM deployed to:", mim.address);

  // Deploy Staking Vault
  const StakingVault = await ethers.getContractFactory("MIMStakingVault");
  const stakingVault = await StakingVault.deploy(mim.address);
  await stakingVault.deployed();
  console.log("MIMStakingVault deployed to:", stakingVault.address);

  // Configure MIM minter
  await mim.setMinter(stakingVault.address, ethers.constants.MaxUint256);
  console.log("Staking vault set as MIM minter");

  return { mim, stakingVault };
}

main().catch(console.error);
```

### Deploy Oracle

```typescript
// scripts/deploy-oracle.ts
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  // ETH/MIM pool address (must exist before deployment)
  const ETH_MIM_POOL = "0x...";
  const TWAP_PERIOD = 1800; // 30 minutes
  
  const Oracle = await ethers.getContractFactory("OracleAdapter");
  const oracle = await Oracle.deploy(ETH_MIM_POOL, TWAP_PERIOD);
  await oracle.deployed();
  
  console.log("OracleAdapter deployed to:", oracle.address);
  return oracle;
}

main().catch(console.error);
```

### Deploy V3 LP Vault

```typescript
// scripts/deploy-v3vault.ts
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  const V3_POSITION_MANAGER = "0x..."; // Network specific
  const WETH = "0x...";
  const MIM = "0x...";
  const POOL_FEE = 3000; // 0.3%
  
  const V3LPVault = await ethers.getContractFactory("V3LPVault");
  const vault = await V3LPVault.deploy(
    V3_POSITION_MANAGER,
    WETH,
    MIM,
    POOL_FEE
  );
  await vault.deployed();
  
  console.log("V3LPVault deployed to:", vault.address);
  
  // Initialize liquidity layers
  const layers = [
    { tickRange: 10, weight: 4000 },   // ±0.5%, 40%
    { tickRange: 20, weight: 3000 },   // ±1.0%, 30%
    { tickRange: 40, weight: 2000 },   // ±2.0%, 20%
    { tickRange: 100, weight: 1000 },  // ±5.0%, 10%
  ];
  
  await vault.setLiquidityLayers(layers);
  console.log("Liquidity layers configured");
  
  return vault;
}

main().catch(console.error);
```

### Deploy LeverageAMM & WToken

```typescript
// scripts/deploy-wtoken.ts
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  // Prerequisites
  const V3_VAULT = "0x...";
  const STAKING_VAULT = "0x...";
  const ORACLE = "0x...";
  const MIM = "0x...";
  
  // Deploy LeverageAMM
  const LeverageAMM = await ethers.getContractFactory("LeverageAMM");
  const leverageAMM = await LeverageAMM.deploy(
    V3_VAULT,
    STAKING_VAULT,
    ORACLE,
    MIM
  );
  await leverageAMM.deployed();
  console.log("LeverageAMM deployed to:", leverageAMM.address);
  
  // Deploy WToken (wETH)
  const WToken = await ethers.getContractFactory("WToken");
  const wETH = await WToken.deploy(
    "Wagmi ETH",
    "wETH",
    leverageAMM.address,
    V3_VAULT
  );
  await wETH.deployed();
  console.log("wETH deployed to:", wETH.address);
  
  // Configure LeverageAMM
  await leverageAMM.setWToken(wETH.address);
  
  // Authorize LeverageAMM to borrow from staking vault
  const stakingVault = await ethers.getContractAt("MIMStakingVault", STAKING_VAULT);
  await stakingVault.setBorrower(leverageAMM.address, true);
  
  console.log("Configuration complete");
  
  return { leverageAMM, wETH };
}

main().catch(console.error);
```

## Complete Deployment Script

```typescript
// scripts/deploy-all.ts
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=".repeat(50));
  console.log("0IL Protocol Deployment");
  console.log("Deployer:", deployer.address);
  console.log("=".repeat(50));

  // 1. Deploy MIM
  console.log("\n1. Deploying MIM...");
  const MIM = await ethers.getContractFactory("MIM");
  const mim = await MIM.deploy();
  await mim.deployed();
  console.log("   MIM:", mim.address);

  // 2. Deploy Staking Vault
  console.log("\n2. Deploying MIMStakingVault...");
  const StakingVault = await ethers.getContractFactory("MIMStakingVault");
  const stakingVault = await StakingVault.deploy(mim.address);
  await stakingVault.deployed();
  console.log("   MIMStakingVault:", stakingVault.address);

  // Configure minter
  await mim.setMinter(stakingVault.address, ethers.constants.MaxUint256);
  await mim.setMinter(deployer.address, ethers.constants.MaxUint256);

  // 3. Create initial MIM liquidity
  console.log("\n3. Minting initial MIM...");
  await mim.mint(deployer.address, ethers.utils.parseEther("1000000"));

  // 4. Deploy Oracle (placeholder - needs pool)
  console.log("\n4. Oracle deployment pending (requires pool)");

  // 5. Deploy V3LPVault (placeholder - needs V3 setup)
  console.log("\n5. V3LPVault deployment pending (requires V3 pools)");

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(50));
  console.log({
    mim: mim.address,
    stakingVault: stakingVault.address,
    // oracle: "TBD",
    // v3Vault: "TBD",
    // leverageAMM: "TBD",
    // wETH: "TBD",
    // wBTC: "TBD",
  });
  
  // Save addresses
  const fs = require("fs");
  const addresses = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId,
    deployer: deployer.address,
    contracts: {
      mim: mim.address,
      stakingVault: stakingVault.address,
    },
    timestamp: new Date().toISOString(),
  };
  
  fs.writeFileSync(
    "deployment-addresses.json",
    JSON.stringify(addresses, null, 2)
  );
  console.log("\nAddresses saved to deployment-addresses.json");
}

main().catch(console.error);
```

## Running Deployment

```bash
# Deploy to Sonic
npx hardhat run scripts/deploy-all.ts --network sonic

# Deploy to Arbitrum (for wrappers)
npx hardhat run scripts/deploy-all.ts --network arbitrum

# Verify contracts
npx hardhat verify --network sonic <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

## Post-Deployment Checklist

### Security Configuration

- [ ] Transfer ownership to multisig
- [ ] Set appropriate admin roles
- [ ] Configure emergency pause guardians
- [ ] Set rate limits on minting

### Integration Testing

- [ ] Test MIM mint/redeem
- [ ] Test sMIM stake/unstake
- [ ] Test wETH deposit/withdraw
- [ ] Test rebalancing triggers
- [ ] Verify oracle prices

### Frontend Configuration

Update `lib/contracts/config.ts`:

```typescript
export const DEPLOYED_ADDRESSES = {
  sonic: {
    mim: "0x...",
    stakingVault: "0x...",
    wETH: "0x...",
    wBTC: "0x...",
    // ...
  }
};
```

## Troubleshooting

### Common Issues

1. **Gas estimation failed**
   - Increase gas limit manually
   - Check constructor arguments
   - Verify dependencies exist

2. **Contract size too large**
   - Enable optimizer with more runs
   - Use libraries for shared code
   - Split into multiple contracts

3. **Verification failed**
   - Ensure exact compiler version
   - Check constructor arguments encoding
   - Flatten source code if needed

### Support

For deployment issues, contact:
- Discord: #dev-support
- Email: dev@wagmi.com

