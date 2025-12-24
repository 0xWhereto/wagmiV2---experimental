#!/bin/bash

# 0IL Protocol Local Development Startup Script
# This script starts all components for local development

set -e

echo "=================================================="
echo "  0IL PROTOCOL - LOCAL DEVELOPMENT"
echo "  All bugs fixed, 7-hour cycle for testing"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Run this script from the 0il-complete directory${NC}"
    exit 1
fi

# Install dependencies if needed
echo -e "${YELLOW}Checking dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    echo "Installing root dependencies..."
    npm install
fi

if [ ! -d "keeper/node_modules" ]; then
    echo "Installing keeper dependencies..."
    cd keeper && npm install && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

echo -e "${GREEN}Dependencies ready!${NC}"

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down...${NC}"
    kill $HARDHAT_PID 2>/dev/null || true
    kill $KEEPER_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start Hardhat node
echo -e "${YELLOW}Starting Hardhat node...${NC}"
npx hardhat node &
HARDHAT_PID=$!
sleep 5

# Deploy contracts
echo -e "${YELLOW}Deploying contracts...${NC}"
npx hardhat run scripts/deploy.ts --network localhost

# Start keeper service
echo -e "${YELLOW}Starting keeper service...${NC}"
cd keeper && npm run dev &
KEEPER_PID=$!
cd ..
sleep 2

# Start frontend
echo -e "${YELLOW}Starting frontend on port 4000...${NC}"
cd frontend && npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo -e "${GREEN}=================================================="
echo "  ALL SERVICES RUNNING"
echo "=================================================="
echo ""
echo "  Frontend:     http://localhost:4000"
echo "  Keeper API:   http://localhost:3001"
echo "  Hardhat RPC:  http://localhost:8545"
echo ""
echo "  Press Ctrl+C to stop all services"
echo -e "==================================================${NC}"

# Wait for any process to exit
wait
