#!/bin/bash
# Wagmi Chain VPS - Reset Script (WIPES ALL DATA)

echo "⚠️  WARNING: This will DELETE all chain data!"
echo ""
read -p "Are you sure? (type 'yes' to confirm): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "🗑️  Stopping and removing all containers and data..."

docker compose down -v
docker system prune -f

echo ""
echo "✅ Chain reset complete. All data has been wiped."
echo ""
echo "To start fresh: ./start.sh"

