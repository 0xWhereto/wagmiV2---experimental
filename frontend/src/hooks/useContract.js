import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESSES } from "../constants/addresses";
import { getSigner } from "../utils/web3";
import TestCrossChainSwapSenderABI from "../abis/TestCrossChainSwapSender.json";
import MockERC20ABI from "../abis/MockERC20.json";
import { TOKENS } from "../constants/addresses";

export const useContract = (network, token) => {
  const [contract, setContract] = useState(null);
  const [tokenContract, setTokenContract] = useState(null);
  const [availableTokens, setAvailableTokens] = useState([]);

  // Loading the sender contract and getting token addresses
  useEffect(() => {
    const loadContracts = async () => {
      if (!network) return;

      try {
        const signer = getSigner();
        const networkName = network.name.toLowerCase();

        // Loading the sender contract for the current network
        const contractAddress = CONTRACT_ADDRESSES.TestCrossChainSwapSender[networkName];
        if (contractAddress) {
          const senderContract = new ethers.Contract(contractAddress, TestCrossChainSwapSenderABI, signer);
          setContract(senderContract);

          // Getting TokenA and TokenB addresses from the contract
          const updatedTokens = [...TOKENS[networkName]];
          if (updatedTokens.length >= 2) {
            const tokenAAddress = await senderContract.tokenA();
            const tokenBAddress = await senderContract.tokenB();

            if (tokenAAddress !== updatedTokens[0].address) {
              updatedTokens[0].address = tokenAAddress;
            }
            if (tokenBAddress !== updatedTokens[1].address) {
              updatedTokens[1].address = tokenBAddress;
            }

            setAvailableTokens(updatedTokens);
          }
        } else {
          setContract(null);
          setAvailableTokens([]);
        }

        // Loading the token contract if a token is selected
        if (token && token.address) {
          const erc20Contract = new ethers.Contract(token.address, MockERC20ABI, signer);
          setTokenContract(erc20Contract);
        } else {
          setTokenContract(null);
        }
      } catch (error) {
        console.error("Failed to load contracts:", error);
        setContract(null);
        setTokenContract(null);
      }
    };

    loadContracts();
  }, [network]);

  // Creating a token contract when a token is selected
  useEffect(() => {
    const loadTokenContract = async () => {
      if (!token || !token.address) {
        setTokenContract(null);
        return;
      }

      try {
        const signer = getSigner();
        const erc20Contract = new ethers.Contract(token.address, MockERC20ABI, signer);
        setTokenContract(erc20Contract);
      } catch (error) {
        console.error("Failed to load token contract:", error);
        setTokenContract(null);
      }
    };

    loadTokenContract();
  }, [token]);

  return { contract, tokenContract, availableTokens };
};
