#!/bin/bash
# Wagmi Chain VPS Setup Script
#
# This script prepares a fresh Ubuntu 22.04 VPS for running Wagmi Chain
#
# Usage:
#   chmod +x setup.sh
#   ./setup.sh

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║              WAGMI CHAIN VPS SETUP                         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "⚠️  Please run as root or with sudo"
    exit 1
fi

# =============================================================================
# 1. Update system
# =============================================================================
echo "📦 Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

# =============================================================================
# 2. Install Docker
# =============================================================================
echo "🐳 Installing Docker..."

if ! command -v docker &> /dev/null; then
    # Install dependencies
    apt-get install -y -qq \
        ca-certificates \
        curl \
        gnupg \
        lsb-release

    # Add Docker's official GPG key
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

    # Set up repository
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
        $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin

    # Start Docker
    systemctl enable docker
    systemctl start docker

    echo "✅ Docker installed successfully"
else
    echo "✅ Docker already installed"
fi

# =============================================================================
# 3. Configure firewall
# =============================================================================
echo "🔥 Configuring firewall..."

if command -v ufw &> /dev/null; then
    ufw allow 22/tcp      # SSH
    ufw allow 8545/tcp    # RPC
    ufw allow 8546/tcp    # WebSocket
    ufw allow 4000/tcp    # Block Explorer
    ufw allow 80/tcp      # HTTP (for SSL)
    ufw allow 443/tcp     # HTTPS
    ufw --force enable
    echo "✅ Firewall configured"
else
    echo "⚠️  UFW not found, please configure firewall manually"
fi

# =============================================================================
# 4. Create environment file
# =============================================================================
echo "📝 Creating environment configuration..."

if [ ! -f .env ]; then
    cp env.template .env
    
    # Generate a random password for PostgreSQL
    RANDOM_PASS=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)
    sed -i "s/blockscout_secure_password_change_me/$RANDOM_PASS/" .env
    
    echo "✅ Created .env file with secure password"
else
    echo "✅ .env file already exists"
fi

# =============================================================================
# 5. Create data directories
# =============================================================================
echo "📁 Creating data directories..."
mkdir -p data/chain
mkdir -p data/postgres
chmod -R 755 data

# =============================================================================
# 6. Pull Docker images
# =============================================================================
echo "📥 Pulling Docker images (this may take a few minutes)..."
docker compose pull

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              SETUP COMPLETE                                ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "  ✅ Docker installed and configured"
echo "  ✅ Firewall configured (ports 8545, 8546, 4000 open)"
echo "  ✅ Environment file created (.env)"
echo "  ✅ Docker images pulled"
echo ""
echo "  📋 Next steps:"
echo "     1. Review configuration: nano .env"
echo "     2. Start the chain: ./start.sh"
echo "     3. Deploy contracts: ./deploy-contracts.sh"
echo ""
echo "  🌐 Your chain will be available at:"
echo "     RPC:      http://$(hostname -I | awk '{print $1}'):8545"
echo "     Explorer: http://$(hostname -I | awk '{print $1}'):4000"
echo ""


