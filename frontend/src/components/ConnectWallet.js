import React, { useState, useEffect } from "react";
import { connectWallet, formatAddress } from "../utils/web3";

const ConnectWallet = ({ onConnect, account }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const walletData = await connectWallet();

      if (walletData.connected) {
        onConnect(walletData.address, walletData.networkId);
      } else if (!walletData.isMetaMaskInstalled) {
        // If MetaMask is not installed, redirect to download page
        window.open("https://metamask.io/download.html", "_blank");
        setError("MetaMask is not installed. Please install MetaMask and refresh the page.");
      } else {
        setError("Failed to connect wallet. Please check MetaMask and try again.");
      }
    } catch (err) {
      console.error("Connection error:", err);
      setError("Connection error: " + err.message);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="connect-wallet">
      {!account ? (
        <>
          <button onClick={handleConnect} disabled={isConnecting}>
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </button>
          {error && <div className="error">{error}</div>}
        </>
      ) : (
        <div className="account-info">
          <span className="address">{formatAddress(account)}</span>
        </div>
      )}
    </div>
  );
};

export default ConnectWallet;
