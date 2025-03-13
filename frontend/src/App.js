import React, { useState, useEffect } from "react";
import "./App.css";
import ConnectWallet from "./components/ConnectWallet";
import SwapForm from "./components/SwapForm";
import NetworkBanner from "./components/NetworkBanner";
import { checkNetwork, getAvailableNetworks, switchNetwork } from "./utils/web3";
import { useContract } from "./hooks/useContract";
import { useSwap } from "./hooks/useSwap";

function App() {
  const [account, setAccount] = useState(null);
  const [network, setNetwork] = useState(null);
  const [availableNetworks, setAvailableNetworks] = useState([]);
  const [error, setError] = useState(null);
  const [mintLoading, setMintLoading] = useState(false);

  const { contract } = useContract(network, null);
  const { mintTokens } = useSwap(contract, null);

  useEffect(() => {
    const loadNetworks = async () => {
      try {
        const networks = getAvailableNetworks();
        setAvailableNetworks(networks);
      } catch (err) {
        console.error("Failed to load networks:", err);
        setError("Failed to load network information");
      }
    };

    loadNetworks();
  }, []);

  useEffect(() => {
    const initNetwork = async () => {
      try {
        const currentNetwork = await checkNetwork();
        setNetwork(currentNetwork);
      } catch (error) {
        console.error("Failed to initialize network:", error);
      }
    };

    if (account) {
      initNetwork();
    }
  }, [account]);

  const handleConnect = async (address, networkId) => {
    setAccount(address);

    const currentNetwork = await checkNetwork();
    setNetwork(currentNetwork);
  };

  const handleSwitchNetwork = async (network) => {
    try {
      const success = await switchNetwork(network.chainId);
      if (success) {
        setNetwork(network);
      }
    } catch (error) {
      console.error("Failed to switch network:", error);
    }
  };

  const handleMintTokens = async () => {
    if (!account) {
      setError("Please connect your wallet");
      return;
    }

    try {
      setMintLoading(true);
      setError(null);

      await mintTokens(account);

      setMintLoading(false);
    } catch (err) {
      console.error("Minting error:", err);
      setError(`Failed to mint tokens: ${err.message}`);
      setMintLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Cross-Chain Swap</h1>
        <ConnectWallet onConnect={handleConnect} account={account} />
      </header>

      <main>
        {account ? (
          <>
            {network ? (
              <>
                <div className="mint-container">
                  <button onClick={handleMintTokens} disabled={mintLoading || !account} className="mint-button">
                    {mintLoading ? "Minting tokens..." : "Mint test tokens"}
                  </button>
                </div>
                <SwapForm account={account} network={network} availableNetworks={availableNetworks} />
              </>
            ) : (
              <NetworkBanner availableNetworks={availableNetworks} onSwitchNetwork={handleSwitchNetwork} />
            )}
          </>
        ) : (
          <div className="connect-prompt">Please connect your wallet to get started</div>
        )}
      </main>

      <footer>
        <p>Working with MetaMask and Layerzero</p>
      </footer>

      {error && <div className="status error">{error}</div>}
    </div>
  );
}

export default App;
