#!/bin/bash
# Wagmi Chain Local Development - Start Script
#
# This script starts the local Wagmi Chain development environment
#
# Usage:
#   chmod +x start.sh
#   ./start.sh

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║              WAGMI CHAIN LOCAL DEVELOPMENT                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "🚀 Starting Wagmi Chain local environment..."
echo ""

# Start services
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check if chain is running
if curl -s -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    http://localhost:8545 > /dev/null 2>&1; then
    echo "✅ Wagmi Chain is running!"
else
    echo "⚠️  Chain is still starting, please wait..."
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  WAGMI CHAIN LOCAL ENVIRONMENT"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "  📡 RPC URL:        http://localhost:8545"
echo "  🔌 WebSocket:      ws://localhost:8545"
echo "  🔍 Block Explorer: http://localhost:4000"
echo "  🔢 Chain ID:       420420"
echo ""
echo "  💰 Default Account:"
echo "     Address:     0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
echo "     Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
echo "     Balance:     10,000 ETH"
echo ""
echo "  📋 Commands:"
echo "     Stop:   docker-compose down"
echo "     Logs:   docker-compose logs -f"
echo "     Reset:  docker-compose down -v && docker-compose up -d"
echo ""
echo "════════════════════════════════════════════════════════════"
echo ""
echo "To deploy contracts to Wagmi Chain Local:"
echo "  npx hardhat run scripts/deployHub.ts --network wagmi-local"
echo ""


