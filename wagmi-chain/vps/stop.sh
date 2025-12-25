#!/bin/bash
# Wagmi Chain VPS - Stop Script

echo "🛑 Stopping Wagmi Chain..."
docker compose down
echo "✅ Wagmi Chain stopped. Data is preserved."
echo ""
echo "To restart: ./start.sh"
echo "To reset (wipe data): ./reset.sh"


