import { ethers } from "ethers";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import { waitForMessageReceived } from "@layerzerolabs/scan-client";
import { CONSTANTS, CHAIN_NAMES, CONTRACT_ADDRESSES, SYNTHETIC_TOKEN_ADDRESSES } from "../constants/addresses";
import { NETWORKS, EID_TO_NETWORK } from "../constants/networks";

export const useSwap = (contract, tokenContract) => {
  // Get constants from addresses.js
  const GAS_LIMIT = CONSTANTS.GAS_LIMIT;
  const FEE_BUFFER_PERCENT = CONSTANTS.FEE_BUFFER_PERCENT;
  const SONIC_RPC_URL = CONSTANTS.SONIC_RPC_URL;

  // Get network EIDs from networks.js
  const EID_SONIC = NETWORKS.SONIC.eid;
  const EID_BASE = NETWORKS.BASE.eid;
  const EID_ARBITRUM = NETWORKS.ARBITRUM.eid;

  // Get receiver address
  const SONIC_RECEIVER_ADDRESS = CONTRACT_ADDRESSES.TestCrossChainSwapReceiver.sonic;

  // Get synthetic token addresses
  const SONIC_TOKEN_A = SYNTHETIC_TOKEN_ADDRESSES.tokenA;
  const SONIC_TOKEN_B = SYNTHETIC_TOKEN_ADDRESSES.tokenB;

  const mintTokens = async (recipient) => {
    if (!contract) {
      throw new Error("Contract not initialized");
    }

    try {
      console.log("Minting 1000 tokens for:", recipient);
      const tx = await contract.mint1000(recipient);
      console.log("Mint transaction hash:", tx.hash);
      const receipt = await tx.wait();
      console.log("Mint completed:", receipt);
      return receipt;
    } catch (error) {
      console.error("Mint failed:", error);
      throw new Error(`Failed to mint tokens: ${error.message}`);
    }
  };

  const getQuote = async (token, amount, dstEid) => {
    if (!contract || !token) {
      throw new Error("Contract or token not initialized");
    }

    try {
      // Step 1: Create basic options for LayerZero
      const encodedOptions = Options.newOptions().addExecutorLzReceiveOption(GAS_LIMIT, 0).toHex();

      console.log("Getting fee estimate from receiver contract in Sonic...");

      // Step 2: Connect to Sonic chain and get receiver contract
      const sonicProvider = new ethers.providers.JsonRpcProvider(SONIC_RPC_URL);
      const receiverContract = new ethers.Contract(
        SONIC_RECEIVER_ADDRESS,
        [
          "function quote(address _recipient, address _tokenIn, address _tokenOut, uint32 _srcEid, uint32 _dstEid, bytes memory _options) external view returns (uint256)",
        ],
        sonicProvider
      );

      // Step 3: Determine current network EID based on the network name
      let currentEid;
      try {
        const networkName = await contract.provider.getNetwork().then((net) => net.name);
        if (networkName.includes("base")) {
          currentEid = EID_BASE;
        } else if (networkName.includes("arbitrum")) {
          currentEid = EID_ARBITRUM;
        } else {
          throw new Error(`Unknown network: ${networkName}`);
        }
      } catch (error) {
        // Fallback to Base if we can't determine the network
        console.warn("Could not determine network, using Base as default", error);
        currentEid = EID_BASE;
      }

      console.log(`Current network EID: ${currentEid}`);

      // Step 4: Determine which token is being swapped
      const signer = await contract.signer.getAddress();

      // Depending on the token selected by user, determine tokenIn and tokenOut
      // For Sonic, we always use the synthetic token addresses
      const tokenIn = token.symbol === "TokenA" ? SONIC_TOKEN_A : SONIC_TOKEN_B;
      const tokenOut = token.symbol === "TokenA" ? SONIC_TOKEN_B : SONIC_TOKEN_A;

      // Step 5: Get quote from receiver contract in Sonic
      const quoteReceiver = await receiverContract.quote(
        signer,
        tokenIn,
        tokenOut,
        currentEid, // Current chain EID
        dstEid, // Destination chain EID
        encodedOptions
      );

      console.log(`Receiver fee estimate: ${ethers.utils.formatEther(quoteReceiver)} Sonic`);

      // Step 6: Setup swap parameters for sender contract
      const swapParams = {
        recipient: signer,
        dstEid: dstEid,
        gasLimit: GAS_LIMIT,
        value: quoteReceiver,
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        amountIn: amount,
      };

      // Step 7: Create final options with buffered fee (110% of the quote)
      const executorValue = ethers.BigNumber.from(quoteReceiver).mul(110).div(100);
      const finalEncodedOptions = Options.newOptions().addExecutorLzReceiveOption(GAS_LIMIT, executorValue).toHex();

      // Step 8: Get fee estimate from the sender contract
      const quote = await contract.quote(swapParams, finalEncodedOptions);
      console.log(`Fee estimate: ${ethers.utils.formatEther(quote)} ETH`);

      // Return the final quote with necessary parameters
      return {
        fee: quote,
        sonicFee: quoteReceiver,
        tokenIn,
        tokenOut,
        swapParams,
        executorValue,
      };
    } catch (error) {
      console.error("Quote error details:", error);
      throw new Error(`Failed to get fee quote: ${error.message}`);
    }
  };

  const approveToken = async (amount) => {
    if (!contract || !tokenContract) {
      throw new Error("Contract or token not initialized");
    }

    try {
      const signer = await tokenContract.signer.getAddress();
      const currentAllowance = await tokenContract.allowance(signer, contract.address);

      if (currentAllowance.lt(amount)) {
        console.log("Approving token for amount:", ethers.utils.formatUnits(amount));
        const tx = await tokenContract.approve(contract.address, ethers.constants.MaxUint256);
        console.log("Approval transaction hash:", tx.hash);
        await tx.wait();
        console.log("Approval confirmed");
      } else {
        console.log("Token already approved for sufficient amount");
      }

      return true;
    } catch (error) {
      console.error("Approval error details:", error);
      throw new Error(`Failed to approve token: ${error.message}`);
    }
  };

  const executeSwap = async (token, amount, dstEid, quoteData, recipient, onStatusUpdate) => {
    if (!contract || !token) {
      throw new Error("Contract or token not initialized");
    }

    try {
      const { fee, sonicFee, tokenIn, tokenOut, swapParams, executorValue } = quoteData;

      // Add 10% buffer to the fee
      const bufferedFee = fee.mul(FEE_BUFFER_PERCENT).div(100);

      // Create the final options with buffered fees for executor
      const finalEncodedOptions = Options.newOptions().addExecutorLzReceiveOption(GAS_LIMIT, executorValue).toHex();

      console.log("Executing swap with parameters:", {
        recipient,
        dstEid,
        gasLimit: GAS_LIMIT,
        fee: ethers.utils.formatEther(fee),
        bufferedFee: ethers.utils.formatEther(bufferedFee),
        tokenIn,
        tokenOut,
        amountIn: ethers.utils.formatUnits(amount),
      });

      // Determine current network EID
      let currentEid;
      try {
        const networkName = await contract.provider.getNetwork().then((net) => net.name);
        if (networkName.includes("base")) {
          currentEid = EID_BASE;
        } else if (networkName.includes("arbitrum")) {
          currentEid = EID_ARBITRUM;
        } else {
          throw new Error(`Unknown network: ${networkName}`);
        }
      } catch (error) {
        console.warn("Could not determine network, using Base as default", error);
        currentEid = EID_BASE;
      }

      // Create the final swap parameters
      const finalSwapParams = {
        recipient: recipient || swapParams.recipient,
        dstEid,
        gasLimit: GAS_LIMIT,
        value: sonicFee,
        tokenIn,
        tokenOut,
        amountIn: amount,
      };

      // Start timing the swap operation
      const startTime = Date.now();

      // Update status
      onStatusUpdate &&
        onStatusUpdate({
          status: "sending",
          message: "Sending transaction to your wallet...",
          startTime,
        });

      // Send the swap transaction
      console.log("Sending swap transaction...");
      const tx = await contract.send(finalSwapParams, finalEncodedOptions, {
        value: bufferedFee,
        gasLimit: 1000000, // Higher gas limit for the transaction itself
      });

      console.log("Swap transaction hash:", tx.hash);
      console.log("View on LayerZero Explorer: https://layerzeroscan.com/tx/" + tx.hash);

      // Update status after transaction is sent
      onStatusUpdate &&
        onStatusUpdate({
          status: "pending_confirmation",
          message: "Transaction sent! Waiting for confirmation...",
          txHash: tx.hash,
          layerZeroLink: "https://layerzeroscan.com/tx/" + tx.hash,
          startTime,
        });

      const receipt = await tx.wait();
      console.log("Transaction confirmed in your wallet");

      // Update status after wallet confirmation
      onStatusUpdate &&
        onStatusUpdate({
          status: "confirmed_source",
          message: `Transaction confirmed on ${
            CHAIN_NAMES[currentEid] || "source chain"
          }! Starting cross-chain message...`,
          txHash: tx.hash,
          layerZeroLink: "https://layerzeroscan.com/tx/" + tx.hash,
          startTime,
          currentStep: 1,
          totalSteps: 3,
        });

      // Wait for the first cross-chain message (Source -> Sonic)
      onStatusUpdate &&
        onStatusUpdate({
          status: "pending_sonic",
          message: `Sending message to Sonic...`,
          txHash: tx.hash,
          layerZeroLink: "https://layerzeroscan.com/tx/" + tx.hash,
          startTime,
          currentStep: 2,
          totalSteps: 3,
        });

      try {
        const messages = await waitForMessageReceived(currentEid, tx.hash);
        console.log(
          `Status ${CHAIN_NAMES[currentEid]}->${CHAIN_NAMES[messages.dstChainId]}`,
          messages.status,
          "https://layerzeroscan.com/tx/" + tx.hash
        );

        // Update status after first message is received
        onStatusUpdate &&
          onStatusUpdate({
            status: "confirmed_sonic",
            message: `Message received on Sonic! Sending to destination...`,
            txHash: tx.hash,
            dstTxHash: messages.dstTxHash,
            layerZeroLink: "https://layerzeroscan.com/tx/" + tx.hash,
            startTime,
            currentStep: 3,
            totalSteps: 3,
          });

        // Wait for the second cross-chain message (Sonic -> Destination)
        const messages2 = await waitForMessageReceived(EID_SONIC, messages.dstTxHash);
        console.log(
          `Status Sonic->${CHAIN_NAMES[messages2.dstChainId]}`,
          messages2.status,
          "https://layerzeroscan.com/tx/" + messages2.dstTxHash
        );

        // Calculate elapsed time
        const endTime = Date.now();
        const elapsedSeconds = (endTime - startTime) / 1000;

        console.log(`Cross-chain swap completed in ${elapsedSeconds.toFixed(2)} seconds`);

        // Final status update
        onStatusUpdate &&
          onStatusUpdate({
            status: "completed",
            message: `Swap completed successfully in ${elapsedSeconds.toFixed(2)} seconds!`,
            txHash: tx.hash,
            dstTxHash: messages2.dstTxHash,
            layerZeroLink: "https://layerzeroscan.com/tx/" + tx.hash,
            sonicTxLink: "https://layerzeroscan.com/tx/" + messages.dstTxHash,
            destinationTxLink: "https://layerzeroscan.com/tx/" + messages2.dstTxHash,
            elapsedTime: elapsedSeconds,
            startTime,
            endTime,
          });
      } catch (error) {
        console.error("Error tracking cross-chain messages:", error);
        // Even if tracking fails, the transaction may still be successful
        onStatusUpdate &&
          onStatusUpdate({
            status: "tracking_failed",
            message:
              "Swap initiated, but we couldn't track the cross-chain messages. Please check LayerZero Explorer manually.",
            txHash: tx.hash,
            layerZeroLink: "https://layerzeroscan.com/tx/" + tx.hash,
            startTime,
          });
      }

      return receipt;
    } catch (error) {
      console.error("Swap error details:", error);
      onStatusUpdate &&
        onStatusUpdate({
          status: "failed",
          message: `Swap failed: ${error.message}`,
          error,
        });
      throw new Error(`Failed to execute swap: ${error.message}`);
    }
  };

  return { getQuote, approveToken, executeSwap, mintTokens };
};
