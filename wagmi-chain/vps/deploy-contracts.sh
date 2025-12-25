#!/bin/bash
# Wagmi Chain VPS - Contract Deployment Script
#
# This script deploys the core Wagmi contracts to the chain
#
# Prerequisites:
#   - Node.js 18+ installed
#   - Chain running (./start.sh)

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║           DEPLOYING CONTRACTS TO WAGMI CHAIN               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Load environment
source .env

RPC_URL="http://localhost:${RPC_PORT:-8545}"

# Check if chain is running
echo "🔍 Checking chain connection..."
if ! curl -s -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
    $RPC_URL > /dev/null 2>&1; then
    echo "❌ Cannot connect to chain at $RPC_URL"
    echo "   Make sure the chain is running: ./start.sh"
    exit 1
fi
echo "✅ Chain is running"

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Installing..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

# Check for project files
if [ ! -f "../../../package.json" ]; then
    echo "❌ Project not found. Please run this from wagmi-chain/vps directory"
    exit 1
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
cd ../../..
npm install --silent

# Compile contracts
echo ""
echo "🔨 Compiling contracts..."
npx hardhat compile

# Deploy contracts
echo ""
echo "🚀 Deploying contracts..."
npx hardhat run scripts/deployWagmiLocal.ts --network localhost

echo ""
echo "✅ Contract deployment complete!"
echo ""
echo "📋 Deployment info saved to: wagmi-chain/local/deployment.json"


