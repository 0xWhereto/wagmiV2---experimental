# Wagmi Chain VPS Deployment

Deploy your own persistent Wagmi Chain on a VPS server.

## Prerequisites

- VPS with Ubuntu 22.04 LTS
- Minimum: 2 CPU, 4GB RAM, 50GB SSD
- Root or sudo access
- Ports 8545, 8546, 4000 open

## Quick Start

```bash
# 1. SSH into your VPS
ssh root@your-vps-ip

# 2. Clone the repo (or upload the wagmi-chain/vps folder)
git clone https://github.com/RealWagmi/wagmi-omnichain-app.git
cd wagmi-omnichain-app/wagmi-chain/vps

# 3. Run the setup script
chmod +x setup.sh
./setup.sh

# 4. Start the chain
./start.sh
```

## What Gets Deployed

| Service | Port | Description |
|---------|------|-------------|
| Wagmi Chain (Anvil) | 8545 | JSON-RPC endpoint |
| WebSocket | 8546 | Real-time subscriptions |
| Block Explorer | 4000 | Blockscout UI |
| PostgreSQL | 5432 | Database (internal) |

## Endpoints

After deployment, your chain will be accessible at:

- **RPC**: `http://your-vps-ip:8545`
- **WebSocket**: `ws://your-vps-ip:8546`
- **Explorer**: `http://your-vps-ip:4000`

## Configuration

Edit `.env` to customize:

```bash
# Chain configuration
CHAIN_ID=420420
CHAIN_NAME="Wagmi Chain"
BLOCK_TIME=1

# Network
RPC_PORT=8545
WS_PORT=8546
EXPLORER_PORT=4000

# Security (change these!)
DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

## Management Commands

```bash
# Start all services
./start.sh

# Stop all services
./stop.sh

# View logs
docker compose logs -f

# Restart chain (preserves data)
docker compose restart wagmi-chain

# Reset chain (wipes all data)
./reset.sh
```

## SSL/HTTPS Setup (Optional)

For production, set up SSL with Caddy or Nginx:

```bash
# Install Caddy
./setup-ssl.sh your-domain.com
```

## Troubleshooting

### Chain not accessible
```bash
# Check if services are running
docker compose ps

# Check firewall
sudo ufw status
sudo ufw allow 8545
sudo ufw allow 4000
```

### Out of disk space
```bash
# Check disk usage
df -h

# Clean Docker
docker system prune -a
```


