#!/bin/bash
# Wagmi Chain VPS - Start Script

set -e

echo "🚀 Starting Wagmi Chain..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from template..."
    cp env.template .env
fi

# Start services
docker compose up -d

echo ""
echo "⏳ Waiting for services to start..."
sleep 10

# Check health
if docker compose ps | grep -q "healthy"; then
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║              WAGMI CHAIN RUNNING                           ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    echo "  📡 RPC URL:        http://$(hostname -I | awk '{print $1}'):8545"
    echo "  🔌 WebSocket:      ws://$(hostname -I | awk '{print $1}'):8546"
    echo "  🔍 Block Explorer: http://$(hostname -I | awk '{print $1}'):4000"
    echo "  🔢 Chain ID:       $(grep CHAIN_ID .env | cut -d= -f2)"
    echo ""
    echo "  💰 Default Account:"
    echo "     Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    echo ""
    echo "  📋 Commands:"
    echo "     Logs:   docker compose logs -f"
    echo "     Stop:   ./stop.sh"
    echo "     Reset:  ./reset.sh"
    echo ""
else
    echo "⚠️  Services may still be starting. Check with: docker compose ps"
fi

