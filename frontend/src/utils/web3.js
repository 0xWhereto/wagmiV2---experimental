import { ethers } from "ethers";
import { NETWORKS } from "../constants/networks";

let provider = null;
let signer = null;

export const getProvider = (network) => {
  if (!network) return null;
  return new ethers.providers.JsonRpcProvider(network.rpcUrl);
};

export const getAvailableNetworks = () => {
  return Object.values(NETWORKS);
};

export const connectWallet = async () => {
  if (window.ethereum) {
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      provider = new ethers.providers.Web3Provider(window.ethereum);
      signer = provider.getSigner();

      const address = await signer.getAddress();
      const network = await provider.getNetwork();

      return {
        address,
        networkId: network.chainId,
        connected: true,
      };
    } catch (error) {
      console.error("User rejected connection:", error);
      return {
        address: null,
        networkId: null,
        connected: false,
      };
    }
  } else {
    console.error("Ethereum wallet not detected");
    return {
      address: null,
      networkId: null,
      connected: false,
      isMetaMaskInstalled: false,
    };
  }
};

export const checkNetwork = async () => {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed.");
  }

  try {
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    const networkIndex = Object.values(NETWORKS).findIndex(
      (network) => network.chainId.toLowerCase() === chainId.toLowerCase()
    );

    if (networkIndex === -1) {
      return null;
    }

    return Object.values(NETWORKS)[networkIndex];
  } catch (error) {
    console.error("Failed to check network:", error);
    throw new Error("Failed to check network connection");
  }
};

export const switchNetwork = async (chainId) => {
  if (!window.ethereum) return false;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
    return true;
  } catch (error) {
    // This error code indicates that the chain has not been added to MetaMask.
    if (error.code === 4902) {
      try {
        const network = Object.values(NETWORKS).find((n) => n.chainId === chainId);
        if (network) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: network.chainId,
                chainName: network.name,
                nativeCurrency: network.nativeCurrency,
                rpcUrls: [network.rpcUrl],
                blockExplorerUrls: [network.blockExplorerUrl],
              },
            ],
          });
          return true;
        }
      } catch (addError) {
        console.error("Failed to add network:", addError);
        return false;
      }
    }
    console.error("Failed to switch network:", error);
    return false;
  }
};

export const getSigner = () => {
  if (!provider) {
    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer = provider.getSigner();
  }
  return signer;
};

export const formatAddress = (address) => {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const formatAmount = (amount, decimals = 18) => {
  if (!amount) return "0";
  return ethers.utils.formatUnits(amount, decimals);
};

export const getCurrentNetwork = async () => {
  if (!provider) {
    if (!window.ethereum) return null;
    provider = new ethers.providers.Web3Provider(window.ethereum);
  }

  const network = await provider.getNetwork();
  return network.chainId;
};
