"use client";

import { useState, useCallback } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { parseUnits, formatUnits, encodePacked } from "viem";
import { GatewayVaultABI, ERC20ABI } from "../abis";
import { getChainConfig, CHAIN_ID_TO_EID } from "../config";

export interface BridgeAsset {
  tokenAddress: `0x${string}`;
  amount: string;
  decimals: number;
  symbol: string;
}

export interface BridgeQuote {
  nativeFee: bigint;
  estimatedReceive: bigint;
  penalty: bigint;
}

// Build LayerZero options for message execution
export function buildLzOptions(gasLimit: bigint = BigInt(200000)): `0x${string}` {
  // Type 3 options: https://docs.layerzero.network/v2/developers/evm/protocol-gas-settings/options
  // Options type 3 with executor LZ receive option
  // Format: [type][workerId][optionType][gas][value]
  const optionType = 1; // EXECUTOR_LZ_RECEIVE_OPTION
  const workerId = 1; // EXECUTOR_WORKER_ID
  
  // Simple gas limit option
  const options = encodePacked(
    ["uint16", "uint8", "uint16", "uint128"],
    [3, workerId, 17, gasLimit] // 17 = 1 (option type) + 16 (gas bytes)
  );
  
  return options;
}

export function useBridge() {
  const [isQuoting, setIsQuoting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isBridging, setIsBridging] = useState(false);
  const [quote, setQuote] = useState<BridgeQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // Get quote for bridging
  const getQuote = useCallback(async (
    sourceChainId: number,
    destChainId: number,
    assets: BridgeAsset[],
    recipient: `0x${string}`
  ): Promise<BridgeQuote | null> => {
    setIsQuoting(true);
    setError(null);

    try {
      const sourceConfig = getChainConfig(sourceChainId);
      if (!sourceConfig || sourceConfig.isHubChain) {
        // If source is hub chain, use SyntheticTokenHub.quoteBridgeTokens
        throw new Error("Hub chain bridging not yet implemented in this hook");
      }

      const gatewayAddress = (sourceConfig.contracts as Record<string, string>)?.gatewayVault as `0x${string}`;
      if (!gatewayAddress || gatewayAddress === "0x0000000000000000000000000000000000000000") {
        throw new Error(`GatewayVault not deployed on ${sourceConfig.name}`);
      }

      // Build assets array for contract
      const contractAssets = assets.map(asset => ({
        tokenAddress: asset.tokenAddress,
        tokenAmount: parseUnits(asset.amount, asset.decimals),
      }));

      // Build LZ options
      const options = buildLzOptions(BigInt(300000));

      // Call quoteDeposit
      const nativeFee = await publicClient!.readContract({
        address: gatewayAddress,
        abi: GatewayVaultABI,
        functionName: "quoteDeposit",
        args: [recipient, contractAssets, options],
      }) as bigint;

      const bridgeQuote: BridgeQuote = {
        nativeFee,
        estimatedReceive: contractAssets.reduce((acc, a) => acc + a.tokenAmount, BigInt(0)),
        penalty: BigInt(0), // Penalty is calculated on the hub chain
      };

      setQuote(bridgeQuote);
      return bridgeQuote;
    } catch (err: any) {
      console.error("Quote error:", err);
      setError(err.message || "Failed to get quote");
      return null;
    } finally {
      setIsQuoting(false);
    }
  }, [publicClient]);

  // Check and approve token allowances
  const checkAndApprove = useCallback(async (
    chainId: number,
    assets: BridgeAsset[],
  ): Promise<boolean> => {
    if (!address || !walletClient || !publicClient) {
      setError("Wallet not connected");
      return false;
    }

    const chainConfig = getChainConfig(chainId);
    if (!chainConfig) {
      setError("Chain not supported");
      return false;
    }

    const spender = chainConfig.isHubChain 
      ? chainConfig.contracts?.syntheticTokenHub as `0x${string}`
      : chainConfig.contracts?.gatewayVault as `0x${string}`;

    if (!spender || spender === "0x0000000000000000000000000000000000000000") {
      setError("Contract not deployed on this chain");
      return false;
    }

    setIsApproving(true);
    setError(null);

    try {
      for (const asset of assets) {
        const amount = parseUnits(asset.amount, asset.decimals);
        
        // Check current allowance
        const allowance = await publicClient.readContract({
          address: asset.tokenAddress,
          abi: ERC20ABI,
          functionName: "allowance",
          args: [address, spender],
        }) as bigint;

        if (allowance < amount) {
          // Need to approve
          const { request } = await publicClient.simulateContract({
            address: asset.tokenAddress,
            abi: ERC20ABI,
            functionName: "approve",
            args: [spender, amount],
            account: address,
          });

          const hash = await walletClient.writeContract(request);
          await publicClient.waitForTransactionReceipt({ hash });
        }
      }

      return true;
    } catch (err: any) {
      console.error("Approval error:", err);
      setError(err.message || "Failed to approve tokens");
      return false;
    } finally {
      setIsApproving(false);
    }
  }, [address, walletClient, publicClient]);

  // Execute bridge
  const bridge = useCallback(async (
    sourceChainId: number,
    destChainId: number,
    assets: BridgeAsset[],
    recipient: `0x${string}`
  ): Promise<`0x${string}` | null> => {
    if (!address || !walletClient || !publicClient) {
      setError("Wallet not connected");
      return null;
    }

    setIsBridging(true);
    setError(null);
    setTxHash(null);

    try {
      // First, check and approve tokens
      const approved = await checkAndApprove(sourceChainId, assets);
      if (!approved) return null;

      // Get fresh quote
      const bridgeQuote = await getQuote(sourceChainId, destChainId, assets, recipient);
      if (!bridgeQuote) return null;

      const sourceConfig = getChainConfig(sourceChainId);
      if (!sourceConfig) {
        throw new Error("Source chain not supported");
      }

      const gatewayAddress = (sourceConfig.contracts as Record<string, string>)?.gatewayVault as `0x${string}`;
      if (!gatewayAddress || gatewayAddress === "0x0000000000000000000000000000000000000000") {
        throw new Error(`GatewayVault not deployed on ${sourceConfig.name}`);
      }

      // Build assets array
      const contractAssets = assets.map(asset => ({
        tokenAddress: asset.tokenAddress,
        tokenAmount: parseUnits(asset.amount, asset.decimals),
      }));

      // Build LZ options
      const options = buildLzOptions(BigInt(300000));

      // Execute deposit
      const { request } = await publicClient.simulateContract({
        address: gatewayAddress,
        abi: GatewayVaultABI,
        functionName: "deposit",
        args: [recipient, contractAssets, options],
        account: address,
        value: bridgeQuote.nativeFee,
      });

      const hash = await walletClient.writeContract(request);
      setTxHash(hash);

      // Wait for confirmation
      await publicClient.waitForTransactionReceipt({ hash });

      return hash;
    } catch (err: any) {
      console.error("Bridge error:", err);
      setError(err.message || "Failed to bridge tokens");
      return null;
    } finally {
      setIsBridging(false);
    }
  }, [address, walletClient, publicClient, checkAndApprove, getQuote]);

  // Reset state
  const reset = useCallback(() => {
    setQuote(null);
    setError(null);
    setTxHash(null);
    setIsQuoting(false);
    setIsApproving(false);
    setIsBridging(false);
  }, []);

  return {
    // State
    quote,
    error,
    txHash,
    isQuoting,
    isApproving,
    isBridging,
    isLoading: isQuoting || isApproving || isBridging,
    
    // Actions
    getQuote,
    checkAndApprove,
    bridge,
    reset,
  };
}

