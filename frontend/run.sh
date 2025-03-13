#!/bin/bash

# Check for Node.js installation
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js (v18.x or higher)."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Error: Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

# Check for pnpm or use npm
if command -v pnpm &> /dev/null; then
    PACKAGE_MANAGER="pnpm"
else
    PACKAGE_MANAGER="npm"
fi

echo "Using $PACKAGE_MANAGER as package manager."
echo "Starting installation of dependencies..."

# Navigate to the project directory and install dependencies
cd "$(dirname "$0")"
$PACKAGE_MANAGER install

# Check for .env file
if [ ! -f .env ]; then
    echo "Creating .env file with default RPC URLs..."
    cat > .env << EOL
REACT_APP_SONIC_RPC=https://rpc.soniclabs.com
REACT_APP_BASE_RPC=https://mainnet.base.org
REACT_APP_ARBITRUM_RPC=https://arb1.arbitrum.io/rpc
EOL
fi

echo "Starting the application..."
$PACKAGE_MANAGER start 