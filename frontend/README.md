# Cross-Chain Swap Frontend

This is a simple frontend application for performing cross-chain swaps between Base and Arbitrum networks via Sonic as an intermediate node. The application allows users to connect their MetaMask wallet, select source and target networks, choose a token for swapping, and execute cross-chain transactions.

## Requirements

- Node.js (version 18.x or higher)
- npm or pnpm
- MetaMask or other Web3 wallet
- Funds in Base or Arbitrum networks for gas fees and transaction costs

## Installation

1. Clone the repository:

```bash
git clone https://github.com/your-username/cross-chain-swap-app.git
cd cross-chain-swap-app/frontend
```

2. Install dependencies:

```bash
npm install
# or
pnpm install
```

3. Create a `.env` file or edit the existing one:

```
REACT_APP_SONIC_RPC=https://rpc.soniclabs.com
REACT_APP_BASE_RPC=https://mainnet.base.org
REACT_APP_ARBITRUM_RPC=https://arb1.arbitrum.io/rpc
```

## Running the Application

1. Start the local development server:

```bash
npm start
# or
pnpm start
```

2. Open your browser and navigate to [http://localhost:3000](http://localhost:3000)

## Usage

1. **Connecting Your Wallet**

   - Click the "Connect Wallet" button
   - Confirm the connection in MetaMask

2. **Network Selection**

   - Make sure your wallet is connected to one of the supported networks (Base or Arbitrum)
   - If not, the application will prompt you to switch to a supported network

3. **Performing a Swap**

   - Select the token you want to exchange
   - Select the target network
   - Enter the amount for exchange
   - Click the "Get Quote" button to get a fee estimate
   - Click "Approve" to allow the contract to use your tokens
   - Click "Swap" to initiate the cross-chain swap
   - Confirm the transaction in MetaMask

4. **Tracking Status**
   - The application will show the current status of the cross-chain transaction
   - You can also track the transaction via LayerZero Explorer using the provided links

## Supported Swap Routes

- Base -> Sonic -> Arbitrum
- Arbitrum -> Sonic -> Base

## Troubleshooting

1. **Cannot Connect Wallet**

   - Make sure MetaMask is installed and unlocked
   - Refresh the page and try again

2. **Transaction Not Confirming**

   - Check if you have enough ETH for gas fees
   - Make sure you have enough tokens for the swap
   - Check the network status (network congestion may occur)

3. **Cannot Switch to the Required Network**
   - Try manually adding the network to MetaMask with the parameters specified in the documentation

## Notes

- Be aware that cross-chain transactions can take from several minutes to an hour depending on network congestion
- Always verify that all swap parameters are correct before confirming the transaction
- For testing, it's recommended to start with small amounts
