# Wagmi Chain Local Development

This directory contains scripts to run a local Wagmi Chain for development and testing.

## Option 1: Hardhat Node (Recommended - No Install Required)

Since Hardhat is already installed in the project, you can run a local chain immediately:

```bash
# From project root
cd "/Users/vm/Desktop/wagmi-omnichain-app-main/wagmi v2"

# Start the local chain (runs in foreground)
npx hardhat node --hostname 0.0.0.0 --port 8545
```

Then in another terminal, deploy contracts:
```bash
npx hardhat run scripts/deployHub.ts --network localhost
```

## Option 2: Docker (Anvil + Blockscout)

If you have Docker installed:

```bash
cd wagmi-chain/local
./start.sh
```

This starts:
- Wagmi Chain (Anvil) at http://localhost:8545
- Block Explorer at http://localhost:4000

## Option 3: Install Foundry/Anvil

For faster local development:

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Run Anvil
anvil --chain-id 420420 --block-time 1
```

## Chain Details

| Parameter | Value |
|-----------|-------|
| Chain ID | 420420 |
| RPC URL | http://localhost:8545 |
| WebSocket | ws://localhost:8545 |
| Block Time | 1 second |

## Default Accounts

Account #0 (Deployer):
- Address: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- Private Key: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
- Balance: 10,000 ETH

## Deploying Contracts

```bash
# Deploy SyntheticTokenHub to local Wagmi Chain
npx hardhat run scripts/deployHub.ts --network wagmi-local

# Or use localhost (same thing)
npx hardhat run scripts/deployHub.ts --network localhost
```


