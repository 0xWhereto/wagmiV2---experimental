import React, { useState, useEffect, useRef } from "react";
import { ethers } from "ethers";
import { SUPPORTED_SWAP_DESTINATIONS, NETWORKS } from "../constants/networks";
import { useContract } from "../hooks/useContract";
import { useSwap } from "../hooks/useSwap";
import TokenSelector from "./TokenSelector";
import NetworkSelector from "./NetworkSelector";
import TransactionProgress from "./TransactionProgress";
import { getProvider } from "../utils/web3";
import { TOKENS } from "../constants/addresses";
import MockERC20ABI from "../abis/MockERC20.json";

const formatError = (error) => {
  if (error.includes("Failed to get fee quote")) {
    return "Unable to calculate fee for this swap. Please try a different amount or token.";
  }
  if (error.includes("user rejected transaction")) {
    return "Transaction was rejected in your wallet.";
  }
  if (error.includes("insufficient funds")) {
    return "You don't have enough ETH to pay for this transaction.";
  }
  return error;
};

const SwapForm = ({ account, network, availableNetworks }) => {
  const [amount, setAmount] = useState("");
  const [sourceToken, setSourceToken] = useState(null);
  const [destinationNetwork, setDestinationNetwork] = useState(null);
  const [isApproved, setIsApproved] = useState(false);
  const [approvalNeeded, setApprovalNeeded] = useState(true);
  const [fee, setFee] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFeeLoading, setIsFeeLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [transactionStatus, setTransactionStatus] = useState(null);
  const [tokenBalance, setTokenBalance] = useState(null);
  const [destinationTokenBalance, setDestinationTokenBalance] = useState(null);
  const [destinationTokenAddress, setDestinationTokenAddress] = useState(null);
  const [isLoadingDestBalance, setIsLoadingDestBalance] = useState(false);

  const availableDestinations = SUPPORTED_SWAP_DESTINATIONS[network.name] || [];

  const { contract, tokenContract, availableTokens } = useContract(network, sourceToken);
  const { getQuote, approveToken, executeSwap, mintTokens } = useSwap(contract, tokenContract);

  // Add ref to track last fee request time
  const lastFeeRequestRef = useRef(0);

  // Reset form when network changes
  useEffect(() => {
    setSourceToken(null);
    setDestinationNetwork(null);
    setAmount("");
    setFee(null);
    setIsApproved(false);
    setApprovalNeeded(true);
    setStatus(null);
    setError(null);
  }, [network]);

  // Reset approval and fee when token or amount changes
  useEffect(() => {
    setIsApproved(false);
    setApprovalNeeded(true);
    setFee(null);
  }, [sourceToken, amount, destinationNetwork]);

  // Update hook for automatic fee calculation
  useEffect(() => {
    const fetchFee = async () => {
      if (
        !sourceToken ||
        !amount ||
        !destinationNetwork ||
        !amount.trim() ||
        isNaN(parseFloat(amount)) ||
        parseFloat(amount) <= 0
      ) {
        return;
      }

      // Check if enough time has passed since the last request
      const now = Date.now();
      if (now - lastFeeRequestRef.current < 5000) {
        console.log("Skipping fee calculation, last request was less than 5 seconds ago");
        return;
      }

      try {
        setIsFeeLoading(true);
        setError(null);

        // Update last request timestamp
        lastFeeRequestRef.current = now;

        const parsedAmount = ethers.utils.parseUnits(amount, sourceToken.decimals);
        const quoteData = await getQuote(sourceToken, parsedAmount, destinationNetwork.eid);

        setFee(quoteData);
        setIsFeeLoading(false);

        // Check if approval is needed
        if (tokenContract) {
          const signer = await tokenContract.signer.getAddress();
          const currentAllowance = await tokenContract.allowance(signer, contract.address);

          if (currentAllowance.gte(parsedAmount)) {
            setIsApproved(true);
            setApprovalNeeded(false);
          } else {
            setApprovalNeeded(true);
          }
        }
      } catch (err) {
        console.error("Failed to get quote:", err);
        setError(formatError(err.message));
        setIsFeeLoading(false);
        setFee(null);
      }
    };

    // Create a function that can be called to immediately fetch the fee
    const triggerFeeCalculation = () => {
      fetchFee();
    };

    // Make the function available through a ref for other methods to use
    if (!window.feeCalculator) {
      window.feeCalculator = triggerFeeCalculation;
    }

    // Keep the original 25-second debounce time for automatic updates
    const debounceTimer = setTimeout(() => {
      fetchFee();
    }, 25000);

    return () => {
      clearTimeout(debounceTimer);
      // Clean up global reference
      if (window.feeCalculator === triggerFeeCalculation) {
        delete window.feeCalculator;
      }
    };
  }, [sourceToken, amount, destinationNetwork, getQuote, tokenContract, contract]);

  // Add a function to manually trigger fee calculation
  const calculateFee = () => {
    if (window.feeCalculator) {
      window.feeCalculator();
    }
  };

  const fetchBalance = async () => {
    if (!tokenContract || !account) {
      setTokenBalance(null);
      return;
    }

    try {
      const balance = await tokenContract.balanceOf(account);
      setTokenBalance(balance);
    } catch (err) {
      console.error("Error getting balance:", err);
      setTokenBalance(null);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, [sourceToken, account, tokenContract]);

  const handleApprove = async () => {
    if (!sourceToken || !amount) {
      setError("Please select a token and enter an amount");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const parsedAmount = ethers.utils.parseUnits(amount, sourceToken.decimals);
      const success = await approveToken(parsedAmount);

      if (success) {
        setIsApproved(true);
        setStatus({
          type: "success",
          message: "Token approval successful",
        });

        // Immediately calculate fee after successful approval
        setTimeout(calculateFee, 1000);
      }
      setIsLoading(false);
    } catch (err) {
      console.error("Approval failed:", err);
      setStatus({
        type: "error",
        message: `Approval failed: ${err.message}`,
      });
      setIsLoading(false);
    }
  };

  // Helper function to determine the opposite token symbol
  const getOppositeTokenSymbol = (currentSymbol) => {
    if (currentSymbol.includes("A")) return currentSymbol.replace("A", "B");
    if (currentSymbol.includes("B")) return currentSymbol.replace("B", "A");
    if (currentSymbol === "A") return "B";
    if (currentSymbol === "B") return "A";
    return currentSymbol; // Fallback to same token if no pattern matches
  };

  // Function to determine destination token address
  useEffect(() => {
    if (!sourceToken || !destinationNetwork) {
      setDestinationTokenAddress(null);
      return;
    }

    // Logic to determine the opposite token on destination network
    const destNetworkName = destinationNetwork.name.toLowerCase();
    const sourceTokenSymbol = sourceToken.symbol;

    // Find the opposite token on destination network (A -> B, B -> A)
    if (TOKENS[destNetworkName]) {
      // If source is TokenA, find TokenB and vice versa
      const isTokenA = sourceTokenSymbol.includes("TokenA") || sourceTokenSymbol === "A";
      const targetSymbol = isTokenA ? "TokenB" : "TokenA";

      const destToken = TOKENS[destNetworkName].find((t) => t.symbol.includes(targetSymbol));
      if (destToken) {
        setDestinationTokenAddress(destToken.address);
      }
    }
  }, [sourceToken, destinationNetwork]);

  // Function to fetch destination token balance
  const fetchDestinationBalance = async () => {
    if (!destinationTokenAddress || !account || !destinationNetwork) {
      setDestinationTokenBalance(null);
      return;
    }

    try {
      setIsLoadingDestBalance(true);

      // Get provider for destination network
      const destProvider = getProvider(destinationNetwork);
      if (!destProvider) {
        console.error("Could not get provider for destination network");
        setIsLoadingDestBalance(false);
        return;
      }

      // Create contract instance for token on destination network
      const destTokenContract = new ethers.Contract(
        destinationTokenAddress,
        MockERC20ABI, // Make sure to import this ABI
        destProvider
      );

      // Get balance
      const balance = await destTokenContract.balanceOf(account);
      setDestinationTokenBalance(balance);
    } catch (err) {
      console.error("Error fetching destination balance:", err);
      setDestinationTokenBalance(null);
    } finally {
      setIsLoadingDestBalance(false);
    }
  };

  // Fetch destination balance when relevant data changes
  useEffect(() => {
    fetchDestinationBalance();
  }, [destinationTokenAddress, account, destinationNetwork]);

  // Add function to refresh destination balance after transaction
  const refreshDestinationBalance = () => {
    setTimeout(() => {
      fetchDestinationBalance();
    }, 3000); // Give blockchain some time to update
  };

  // Modify transaction status update to refresh balance
  const handleTransactionStatusUpdate = (update) => {
    setTransactionStatus(update);

    // For completed transactions, update the destination balance
    if (update.status === "completed") {
      setStatus({
        type: "success",
        message: `Swap executed successfully in ${update.elapsedTime.toFixed(2)} seconds!`,
        txHash: update.txHash,
      });
      setIsLoading(false);

      // Refresh destination balance after successful transaction
      refreshDestinationBalance();
    } else if (update.status === "failed") {
      setStatus({
        type: "error",
        message: update.message,
      });
      setIsLoading(false);
    }
  };

  const handleSwap = async () => {
    if (!sourceToken || !amount || !destinationNetwork || !fee) {
      setError("Please fill all required fields");
      return;
    }

    if (approvalNeeded && !isApproved) {
      setError("Please approve the token first");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setTransactionStatus(null); // Reset transaction status

      setStatus({ type: "pending", message: "Initiating swap..." });

      const parsedAmount = ethers.utils.parseUnits(amount, sourceToken.decimals);
      // Pass the handleTransactionStatusUpdate callback
      const receipt = await executeSwap(
        sourceToken,
        parsedAmount,
        destinationNetwork.eid,
        fee,
        account,
        handleTransactionStatusUpdate
      );

      // Initial status is set by the transaction status handler
    } catch (err) {
      console.error("Swap failed:", err);
      setStatus({
        type: "error",
        message: `Swap failed: ${formatError(err.message)}`,
      });
      setIsLoading(false);
      setTransactionStatus(null);
    }
  };

  // Adding function for minting tokens
  const handleMintTokens = async () => {
    if (!account) {
      setError("Please connect your wallet");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setStatus({ type: "pending", message: "Minting tokens..." });

      const receipt = await mintTokens(account);

      setStatus({
        type: "success",
        message: "Tokens minted successfully! You can now swap.",
        txHash: receipt.transactionHash,
      });
      setIsLoading(false);
    } catch (err) {
      console.error("Minting failed:", err);
      setStatus({
        type: "error",
        message: `Failed to mint tokens: ${err.message}`,
      });
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2>Cross-Chain Swap</h2>
      <div className="form-group">
        <label>From {network?.name}</label>
        <TokenSelector tokens={availableTokens} selectedToken={sourceToken} onSelect={setSourceToken} />

        {/* Display balance */}
        {tokenBalance && sourceToken && (
          <div className="token-balance">
            Balance: {ethers.utils.formatUnits(tokenBalance, sourceToken.decimals)} {sourceToken.symbol}
          </div>
        )}
      </div>

      <div className="form-group">
        <label>To</label>
        <NetworkSelector
          networks={availableDestinations.map((name) => NETWORKS[name.toUpperCase()])}
          selectedNetwork={destinationNetwork}
          onSelect={setDestinationNetwork}
        />

        {/* Display destination token balance */}
        {destinationTokenBalance && destinationNetwork && sourceToken && (
          <div className="token-balance destination-balance">
            Balance on {destinationNetwork.name}: {ethers.utils.formatUnits(destinationTokenBalance, 18)}{" "}
            {getOppositeTokenSymbol(sourceToken.symbol)}
            <button onClick={refreshDestinationBalance} className="refresh-balance-btn" title="Refresh Balance">
              ↻
            </button>
          </div>
        )}
        {isLoadingDestBalance && (
          <div className="token-balance destination-balance loading">Loading {destinationNetwork?.name} balance...</div>
        )}
      </div>

      <div className="form-group">
        <label>Amount</label>
        <input type="text" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.0" />
      </div>

      {/* Add Get Quote button */}
      <div className="form-group">
        <button
          onClick={calculateFee}
          disabled={!sourceToken || !amount || !destinationNetwork || isLoading || isFeeLoading}
          className="get-quote-button"
        >
          {isFeeLoading ? "Calculating..." : "Get Quote"}
        </button>
      </div>

      {isFeeLoading && <div className="status pending">Calculating fee...</div>}

      {fee && (
        <div className="form-group">
          <label>Network Fee</label>
          <div>{ethers.utils.formatEther(fee.fee)} ETH</div>
        </div>
      )}

      <div className="action-buttons">
        {approvalNeeded && (
          <button onClick={handleApprove} disabled={isLoading || isFeeLoading || !sourceToken || !amount || isApproved}>
            Approve
          </button>
        )}

        <button onClick={handleSwap} disabled={isLoading || isFeeLoading || !fee || (approvalNeeded && !isApproved)}>
          Swap
        </button>
      </div>

      {/* Transaction Progress component */}
      {transactionStatus && (
        <TransactionProgress status={transactionStatus} network={network} destinationNetwork={destinationNetwork} />
      )}

      {/* Regular status messages */}
      {status && !transactionStatus && (
        <div className={`status ${status.type}`}>
          <p>{status.message}</p>
          {status.txHash && (
            <p>
              <a href={`${network.blockExplorerUrl}/tx/${status.txHash}`} target="_blank" rel="noopener noreferrer">
                View on Explorer
              </a>
            </p>
          )}
        </div>
      )}

      {error && <div className="error">{error}</div>}
    </div>
  );
};

export default SwapForm;
