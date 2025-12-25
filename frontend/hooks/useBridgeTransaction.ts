"use client";

import { useState, useEffect, useMemo } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useReadContract, usePublicClient } from "wagmi";
import { parseUnits, encodePacked, formatUnits } from "viem";
import { useTransactionToast } from "@/components/Toast";
import { getTokensForChain } from "@/lib/tokens/tokenList";
import { CHAIN_CONFIG, getChainConfig, getHubChainConfig, CHAIN_ID_TO_EID } from "@/lib/contracts/config";
import { QuoterV2ABI, SwapRouterABI } from "@/lib/contracts/abis";

// GatewayVault ABI - matches actual contract
const gatewayVaultAbi = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "_recepient", type: "address" },
      {
        name: "_assets",
        type: "tuple[]",
        components: [
          { name: "tokenAddress", type: "address" },
          { name: "tokenAmount", type: "uint256" },
        ],
      },
      { name: "_options", type: "bytes" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "guid", type: "bytes32" },
          { name: "nonce", type: "uint64" },
          {
            name: "fee",
            type: "tuple",
            components: [
              { name: "nativeFee", type: "uint256" },
              { name: "lzTokenFee", type: "uint256" },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "quoteDeposit",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "_recepient", type: "address" },
      {
        name: "_assets",
        type: "tuple[]",
        components: [
          { name: "tokenAddress", type: "address" },
          { name: "tokenAmount", type: "uint256" },
        ],
      },
      { name: "_options", type: "bytes" },
    ],
    outputs: [{ name: "nativeFee", type: "uint256" }],
  },
  {
    name: "getAvailableTokenLength",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getAllAvailableTokens",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "onPause", type: "bool" },
          { name: "decimalsDelta", type: "int8" },
          { name: "syntheticTokenAddress", type: "address" },
          { name: "tokenAddress", type: "address" },
          { name: "tokenDecimals", type: "uint8" },
          { name: "tokenSymbol", type: "string" },
          { name: "tokenBalance", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "getTokenIndex",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_tokenAddress", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// SyntheticTokenHub ABI for bridgeTokens (bridge from Sonic to other chains)
const syntheticTokenHubAbi = [
  {
    name: "bridgeTokens",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "_recipient", type: "address" },
      {
        name: "_assets",
        type: "tuple[]",
        components: [
          { name: "tokenAddress", type: "address" },
          { name: "tokenAmount", type: "uint256" },
        ],
      },
      { name: "_dstEid", type: "uint32" },
      { name: "_options", type: "bytes" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "guid", type: "bytes32" },
          { name: "nonce", type: "uint64" },
          {
            name: "fee",
            type: "tuple",
            components: [
              { name: "nativeFee", type: "uint256" },
              { name: "lzTokenFee", type: "uint256" },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "quoteBridgeTokens",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "_recipient", type: "address" },
      {
        name: "_assets",
        type: "tuple[]",
        components: [
          { name: "tokenAddress", type: "address" },
          { name: "tokenAmount", type: "uint256" },
        ],
      },
      { name: "_dstEid", type: "uint32" },
      { name: "_options", type: "bytes" },
    ],
    outputs: [
      { name: "nativeFee", type: "uint256" },
      {
        name: "assetsRemote",
        type: "tuple[]",
        components: [
          { name: "tokenAddress", type: "address" },
          { name: "tokenAmount", type: "uint256" },
        ],
      },
      { name: "penalties", type: "uint256[]" },
    ],
  },
] as const;

// Build LayerZero options with gas limit
// Format: 0x0003 (type) + 0x01 (version) + 0x0011 (length=17) + 0x01 (executor type) + gas(16 bytes)
function buildLzOptions(gasLimit: bigint = BigInt(200000)): `0x${string}` {
  const optionType = 3;      // Options type 3
  const version = 1;         // Version 1
  const optionLength = 17;   // 1 byte (type) + 16 bytes (gas)
  const executorType = 1;    // LzReceive executor type
  
  // Encode with correct format matching LayerZero V2 Options library
  return encodePacked(
    ['uint16', 'uint8', 'uint16', 'uint8', 'uint128'],
    [optionType, version, optionLength, executorType, gasLimit]
  );
}

// Get gateway vault address for a chain
function getGatewayVaultAddress(chainId: number): `0x${string}` | null {
  const config = getChainConfig(chainId);
  if (!config || config.isHubChain) return null;
  return (config.contracts as { gatewayVault?: string }).gatewayVault as `0x${string}` || null;
}

// Get synthetic token hub address (on Sonic)
function getSyntheticTokenHubAddress(): `0x${string}` {
  return CHAIN_CONFIG.sonic.contracts.syntheticTokenHub as `0x${string}`;
}

export function useBridgeTransaction() {
  const [isLoading, setIsLoading] = useState(false);
  const toast = useTransactionToast();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();
  
  const { writeContractAsync } = useWriteContract();

  const bridgeToHub = async ({
    sourceChainId,
    tokenSymbol,
    amount,
    receiverAddress,
  }: {
    sourceChainId: number;
    tokenSymbol: string;
    amount: string;
    receiverAddress: `0x${string}`;
  }) => {
    setIsLoading(true);
    const toastId = toast.pending("Initiating Bridge", "Please confirm the transaction in your wallet...");

    try {
      // Get token address
      const tokens = getTokensForChain(sourceChainId);
      const token = tokens.find(t => t.symbol === tokenSymbol);
      if (!token?.address) {
        throw new Error("Token not found");
      }

      const tokenAddress = token.address as `0x${string}`;
      const decimals = token.decimals || 18;
      const amountWei = parseUnits(amount, decimals);

      // Get gateway vault address
      const gatewayAddress = getGatewayVaultAddress(sourceChainId);
      if (!gatewayAddress) {
        throw new Error("Gateway not found for this chain");
      }

      // Build assets array
      const assets = [{ tokenAddress, tokenAmount: amountWei }];
      
      // Build LayerZero options with gas limit (500k for hub operations)
      const lzOptions = buildLzOptions(BigInt(500000));

      // Switch to source chain if needed
      try {
        await switchChainAsync({ chainId: sourceChainId });
      } catch (e) {
        // User might already be on the right chain
      }

      toast.update(toastId, "pending", "Checking Token", undefined, "Verifying token is supported...");

      // Check if token is linked/registered in the GatewayVault
      try {
        await publicClient?.readContract({
          address: gatewayAddress,
          abi: gatewayVaultAbi,
          functionName: "getTokenIndex",
          args: [tokenAddress],
        });
      } catch (e: any) {
        // Token not found - show helpful error
        console.error("Token not linked:", e);
        throw new Error(`Token ${tokenSymbol} is not yet linked to the bridge on this chain. Please contact the admin to link this token.`);
      }

      // Verify allowance before proceeding (safeguard against race conditions)
      toast.update(toastId, "pending", "Checking Allowance", undefined, "Verifying token approval...");
      const erc20Abi = [
        { name: "allowance", type: "function", stateMutability: "view", 
          inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
          outputs: [{ name: "", type: "uint256" }] },
      ] as const;
      
      try {
        const allowance = await publicClient?.readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "allowance",
          args: [receiverAddress, gatewayAddress],
        });
        
        if (!allowance || allowance < amountWei) {
          throw new Error(`Insufficient allowance. Please approve ${tokenSymbol} first. Current allowance: ${allowance?.toString() || "0"}`);
        }
      } catch (e: any) {
        if (e.message?.includes("Insufficient allowance")) {
          throw e;
        }
        console.warn("Allowance check failed:", e);
        // Continue anyway if check fails - the transaction will fail with a clear error
      }

      toast.update(toastId, "pending", "Getting Quote", undefined, "Calculating bridge fee...");

      // Get quote for LayerZero fee
      let nativeFee: bigint;
      try {
        const quoteResult = await publicClient?.readContract({
          address: gatewayAddress,
          abi: gatewayVaultAbi,
          functionName: "quoteDeposit",
          args: [receiverAddress, assets, lzOptions],
        });
        nativeFee = (quoteResult as bigint) || BigInt(0);
        // Add 10% buffer for safety
        nativeFee = (nativeFee * BigInt(110)) / BigInt(100);
      } catch (e) {
        console.warn("Quote failed, using default fee:", e);
        // Use a default fee if quote fails (0.001 ETH)
        nativeFee = parseUnits("0.001", 18);
      }

      toast.update(toastId, "pending", "Bridge Transaction", undefined, `Bridging ${amount} ${tokenSymbol}...`);

      // Execute deposit to gateway vault
      const hash = await writeContractAsync({
        address: gatewayAddress,
        abi: gatewayVaultAbi,
        functionName: "deposit",
        args: [receiverAddress, assets, lzOptions],
        value: nativeFee,
        chainId: sourceChainId,
      });

      toast.update(toastId, "pending", "Transaction Pending", hash, "Waiting for confirmation...");

      // Show success after brief delay
      setTimeout(() => {
        toast.update(toastId, "success", "Bridge Initiated!", hash, `Bridging ${amount} ${tokenSymbol} to Sonic`);
      }, 2000);

      setIsLoading(false);
      return hash;

    } catch (error: any) {
      console.error("Bridge error:", error);
      const message = error.shortMessage || error.message || "Transaction failed";
      toast.update(toastId, "error", "Bridge Failed", undefined, message);
      setIsLoading(false);
      throw error;
    }
  };

  const bridgeFromHub = async ({
    destChainId,
    tokenSymbol,
    amount,
    receiverAddress,
  }: {
    destChainId: number;
    tokenSymbol: string;
    amount: string;
    receiverAddress: `0x${string}`;
  }) => {
    setIsLoading(true);
    const toastId = toast.pending("Initiating Bridge", "Please confirm the transaction in your wallet...");

    try {
      // Get token address on Sonic
      const tokens = getTokensForChain(146); // Sonic
      const token = tokens.find(t => t.symbol === tokenSymbol);
      if (!token?.address) {
        throw new Error("Token not found");
      }

      const tokenAddress = token.address as `0x${string}`;
      const decimals = token.decimals || 18;
      const amountWei = parseUnits(amount, decimals);

      // Get destination chain EID
      const destEid = CHAIN_ID_TO_EID[destChainId];
      if (!destEid) {
        throw new Error("Destination chain not supported");
      }

      // Build assets array
      const assets = [{ tokenAddress, tokenAmount: amountWei }];
      
      // Build LayerZero options with gas limit (500k for hub operations)
      const lzOptions = buildLzOptions(BigInt(500000));

      // Get hub address
      const hubAddress = getSyntheticTokenHubAddress();

      // Switch to Sonic if needed
      try {
        await switchChainAsync({ chainId: 146 });
      } catch (e) {
        // User might already be on Sonic
      }

      toast.update(toastId, "pending", "Getting Quote", undefined, "Calculating bridge fee...");

      // Get quote for LayerZero fee
      // Note: quoteBridgeTokens takes (recipient, assets, dstEid, options)
      let nativeFee: bigint;
      try {
        const quoteResult = await publicClient?.readContract({
          address: hubAddress,
          abi: syntheticTokenHubAbi,
          functionName: "quoteBridgeTokens",
          args: [receiverAddress, assets, destEid, lzOptions],
        });
        // quoteBridgeTokens returns [nativeFee, assetsRemote, penalties]
        nativeFee = (quoteResult as [bigint, unknown, unknown])?.[0] || BigInt(0);
        // Add 10% buffer for safety
        nativeFee = (nativeFee * BigInt(110)) / BigInt(100);
      } catch (e) {
        console.warn("Quote failed, using default fee:", e);
        // Use a default fee if quote fails (0.5 S for Sonic)
        nativeFee = parseUnits("0.5", 18);
      }

      toast.update(toastId, "pending", "Bridge Transaction", undefined, `Bridging ${amount} ${tokenSymbol}...`);

      // Execute bridgeTokens from synthetic token hub
      // Note: bridgeTokens takes (recipient, assets, dstEid, options)
      const hash = await writeContractAsync({
        address: hubAddress,
        abi: syntheticTokenHubAbi,
        functionName: "bridgeTokens",
        args: [receiverAddress, assets, destEid, lzOptions],
        value: nativeFee,
        chainId: 146,
      });

      toast.update(toastId, "pending", "Transaction Pending", hash, "Waiting for confirmation...");

      // Show success after brief delay
      setTimeout(() => {
        const chainName = getChainConfig(destChainId)?.name || "destination";
        toast.update(toastId, "success", "Bridge Initiated!", hash, `Bridging ${amount} ${tokenSymbol} to ${chainName}`);
      }, 2000);

      setIsLoading(false);
      return hash;

    } catch (error: any) {
      console.error("Bridge error:", error);
      const message = error.shortMessage || error.message || "Transaction failed";
      toast.update(toastId, "error", "Bridge Failed", undefined, message);
      setIsLoading(false);
      throw error;
    }
  };

  return {
    bridgeToHub,
    bridgeFromHub,
    isLoading,
  };
}

// Fee tiers to try in order of preference (0.05% first for our pools)
const FEE_TIERS_TO_TRY = [500, 3000, 10000, 100]; // 0.05%, 0.3%, 1%, 0.01%

// Factory ABI for checking pool existence
const factoryABI = [
  {
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "fee", type: "uint24" },
    ],
    name: "getPool",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Pool ABI for getting current price
const poolABI = [
  {
    inputs: [],
    name: "slot0",
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "feeProtocol", type: "uint8" },
      { name: "unlocked", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "liquidity",
    outputs: [{ name: "", type: "uint128" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Hook for swap quote from QuoterV2
export function useSwapQuote({
  chainId,
  tokenIn,
  tokenOut,
  amountIn,
  fee: preferredFee,
}: {
  chainId: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  fee?: number;
}) {
  const hubConfig = getHubChainConfig();
  const quoterAddress = hubConfig?.contracts?.quoterV2 as `0x${string}` | undefined;
  const factoryAddress = hubConfig?.contracts?.uniswapV3Factory as `0x${string}` | undefined;
  
  // Get token addresses
  const tokens = getTokensForChain(chainId);
  const tokenInData = tokens.find(t => t.symbol === tokenIn);
  const tokenOutData = tokens.find(t => t.symbol === tokenOut);
  
  const tokenInAddress = tokenInData?.address as `0x${string}` | undefined;
  const tokenOutAddress = tokenOutData?.address as `0x${string}` | undefined;
  const tokenInDecimals = tokenInData?.decimals || 18;
  const tokenOutDecimals = tokenOutData?.decimals || 18;
  
  // Parse amount to wei
  const amountInWei = useMemo(() => {
    if (!amountIn || parseFloat(amountIn) === 0) return BigInt(0);
    try {
      return parseUnits(amountIn, tokenInDecimals);
    } catch {
      return BigInt(0);
    }
  }, [amountIn, tokenInDecimals]);

  const publicClient = usePublicClient({ chainId });
  const [quote, setQuote] = useState<{
    amountOut: bigint;
    sqrtPriceX96After: bigint;
    gasEstimate: bigint;
    priceImpact: number;
    fee: number;
    poolExists: boolean;
    hasLiquidity: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuote = async () => {
      if (!quoterAddress || !factoryAddress || !tokenInAddress || !tokenOutAddress || amountInWei === BigInt(0) || !publicClient) {
        setQuote(null);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      // Try each fee tier to find a pool with liquidity
      const feeTiersToTry = preferredFee ? [preferredFee, ...FEE_TIERS_TO_TRY.filter(f => f !== preferredFee)] : FEE_TIERS_TO_TRY;
      
      for (const fee of feeTiersToTry) {
        try {
          // First check if pool exists
          const poolAddress = await publicClient.readContract({
            address: factoryAddress,
            abi: factoryABI,
            functionName: "getPool",
            args: [tokenInAddress, tokenOutAddress, fee],
          });

          if (!poolAddress || poolAddress === "0x0000000000000000000000000000000000000000") {
            console.log(`No pool for fee tier ${fee / 10000}%`);
            continue; // Try next fee tier
          }

          // Check if pool has liquidity
          const [slot0, liquidity] = await Promise.all([
            publicClient.readContract({
              address: poolAddress,
              abi: poolABI,
              functionName: "slot0",
            }),
            publicClient.readContract({
              address: poolAddress,
              abi: poolABI,
              functionName: "liquidity",
            }),
          ]);

          if (liquidity === BigInt(0)) {
            console.log(`Pool exists for fee tier ${fee / 10000}% but has no liquidity`);
            setError(`Pool exists but has no liquidity. Add liquidity first.`);
            setQuote({
              amountOut: BigInt(0),
              sqrtPriceX96After: BigInt(0),
              gasEstimate: BigInt(0),
              priceImpact: 0,
              fee,
              poolExists: true,
              hasLiquidity: false,
            });
            setIsLoading(false);
            return;
          }

          // Get current price from slot0 for price impact calculation
          const currentSqrtPriceX96 = slot0[0] as bigint;
          
          // Use simulateContract to get the quote
          const result = await publicClient.simulateContract({
            address: quoterAddress,
            abi: QuoterV2ABI,
            functionName: "quoteExactInputSingle",
            args: [{
              tokenIn: tokenInAddress,
              tokenOut: tokenOutAddress,
              amountIn: amountInWei,
              fee: fee,
              sqrtPriceLimitX96: BigInt(0),
            }],
          });

          const [amountOut, sqrtPriceX96After] = result.result as [bigint, bigint, number, bigint];

          if (amountOut === BigInt(0)) {
            console.log(`Quote returned 0 for fee tier ${fee / 10000}%`);
            continue; // Try next fee tier
          }

          // Calculate price impact from sqrtPrice change
          // Price impact = |1 - (sqrtPriceAfter/sqrtPriceBefore)^2| * 100
          const priceBefore = Number(currentSqrtPriceX96) ** 2;
          const priceAfter = Number(sqrtPriceX96After) ** 2;
          const priceImpact = priceBefore > 0 ? Math.abs(1 - priceAfter / priceBefore) * 100 : 0;

          setQuote({
            amountOut,
            sqrtPriceX96After,
            gasEstimate: BigInt(150000), // Estimate
            priceImpact: Math.min(priceImpact, 99.99),
            fee,
            poolExists: true,
            hasLiquidity: true,
          });
          setIsLoading(false);
          return; // Success, exit loop

        } catch (err: any) {
          console.log(`Failed to get quote for fee tier ${fee / 10000}%:`, err.message);
          continue; // Try next fee tier
        }
      }

      // No pool found with any fee tier
      setError("No liquidity pool found for this pair. Create a pool first.");
      setQuote(null);
      setIsLoading(false);
    };

    // Debounce the quote fetch
    const timeoutId = setTimeout(fetchQuote, 500);
    return () => clearTimeout(timeoutId);
  }, [quoterAddress, factoryAddress, tokenInAddress, tokenOutAddress, amountInWei, preferredFee, publicClient, tokenInDecimals, tokenOutDecimals]);

  return {
    quote,
    amountOut: quote?.amountOut ? formatUnits(quote.amountOut, tokenOutDecimals) : "0",
    priceImpact: quote?.priceImpact ?? 0,
    gasEstimate: quote?.gasEstimate ?? BigInt(0),
    fee: quote?.fee ?? 3000,
    poolExists: quote?.poolExists ?? false,
    hasLiquidity: quote?.hasLiquidity ?? false,
    isLoading,
    error,
  };
}

// Hook for executing swaps via SwapRouter
export function useSwapTransaction() {
  const [isLoading, setIsLoading] = useState(false);
  const toast = useTransactionToast();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const executeSwap = async ({
    chainId,
    tokenIn,
    tokenOut,
    amountIn,
    amountOutMin,
    receiverAddress,
    fee = 3000, // Default 0.3% fee tier
  }: {
    chainId: number;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOutMin: string;
    receiverAddress: `0x${string}`;
    fee?: number;
  }) => {
    setIsLoading(true);
    const toastId = toast.pending("Initiating Swap", "Please confirm the transaction in your wallet...");

    try {
      const hubConfig = getHubChainConfig();
      const swapRouterAddress = hubConfig?.contracts?.swapRouter as `0x${string}`;
      
      if (!swapRouterAddress || swapRouterAddress === "0x0000000000000000000000000000000000000000") {
        throw new Error("SwapRouter not configured");
      }

      // Get token addresses
      const tokens = getTokensForChain(chainId);
      const tokenInData = tokens.find(t => t.symbol === tokenIn);
      const tokenOutData = tokens.find(t => t.symbol === tokenOut);

      if (!tokenInData?.address || !tokenOutData?.address) {
        throw new Error("Token not found");
      }

      const tokenInAddress = tokenInData.address as `0x${string}`;
      const tokenOutAddress = tokenOutData.address as `0x${string}`;
      const tokenInDecimals = tokenInData.decimals || 18;
      const tokenOutDecimals = tokenOutData.decimals || 18;

      const amountInWei = parseUnits(amountIn, tokenInDecimals);
      
      // Handle amountOutMin carefully - it might be in scientific notation for very small numbers
      let amountOutMinWei = BigInt(0);
      if (amountOutMin && parseFloat(amountOutMin) > 0) {
        try {
          // Convert to a proper decimal string first
          const minOutFloat = parseFloat(amountOutMin);
          // If the number is extremely small, just use 0 (no slippage protection)
          if (minOutFloat < 1e-10) {
            amountOutMinWei = BigInt(0);
          } else {
            // Convert to fixed decimal string to avoid scientific notation
            const fixedString = minOutFloat.toFixed(tokenOutDecimals);
            amountOutMinWei = parseUnits(fixedString, tokenOutDecimals);
          }
        } catch (e) {
          console.warn("Failed to parse amountOutMin, using 0:", e);
          amountOutMinWei = BigInt(0);
        }
      }

      toast.update(toastId, "pending", "Swap Transaction", undefined, "Executing swap via SwapRouter...");

      // Deadline: 30 minutes from now
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);

      // Execute swap via SwapRouter.exactInputSingle
      const hash = await writeContractAsync({
        address: swapRouterAddress,
        abi: SwapRouterABI,
        functionName: "exactInputSingle",
        args: [{
          tokenIn: tokenInAddress,
          tokenOut: tokenOutAddress,
          fee: fee,
          recipient: receiverAddress,
          deadline: deadline,
          amountIn: amountInWei,
          amountOutMinimum: amountOutMinWei,
          sqrtPriceLimitX96: BigInt(0), // No price limit
        }],
        chainId,
      });

      toast.update(toastId, "pending", "Confirming...", hash, "Waiting for confirmation...");

      // Wait for transaction confirmation
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      
      toast.update(toastId, "success", "Swap Successful!", hash, `Swapped ${amountIn} ${tokenIn} for ${tokenOut}`);

      setIsLoading(false);
      return hash;

    } catch (error: any) {
      console.error("Swap error:", error);
      const message = error.shortMessage || error.message || "Transaction failed";
      toast.update(toastId, "error", "Swap Failed", undefined, message);
      setIsLoading(false);
      throw error;
    }
  };

  return {
    executeSwap,
    isLoading,
  };
}

