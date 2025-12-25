"use client";

import { useState, useCallback, useEffect } from "react";
import { useAccount, usePublicClient, useWalletClient, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits, encodePacked } from "viem";
import { ERC20ABI, NonfungiblePositionManagerABI, UniswapV3FactoryABI, UniswapV3PoolABI } from "../abis";
import { getHubChainConfig } from "../config";

// Hub chain ID (Sonic)
const HUB_CHAIN_ID = 146;

// Get contract addresses from config
const hubConfig = getHubChainConfig();
const POSITION_MANAGER = (hubConfig?.contracts as any)?.nonfungiblePositionManager as `0x${string}` || "0x0000000000000000000000000000000000000000";
const FACTORY = (hubConfig?.contracts as any)?.uniswapV3Factory as `0x${string}` || "0x0000000000000000000000000000000000000000";

// Fee tiers and tick spacings (Uniswap V3 standard)
export const FEE_TIERS = [
  { fee: 100, tickSpacing: 1, label: "0.01%", description: "Best for very stable pairs" },
  { fee: 500, tickSpacing: 10, label: "0.05%", description: "Best for stable pairs" },
  { fee: 3000, tickSpacing: 60, label: "0.3%", description: "Best for most pairs" },
  { fee: 10000, tickSpacing: 200, label: "1%", description: "Best for exotic pairs" },
] as const;

export interface Position {
  tokenId: bigint;
  token0: `0x${string}`;
  token1: `0x${string}`;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
  token0Symbol?: string;
  token1Symbol?: string;
  token0Decimals?: number;
  token1Decimals?: number;
}

export interface MintParams {
  token0: `0x${string}`;
  token1: `0x${string}`;
  fee: number;
  tickLower: number;
  tickUpper: number;
  amount0Desired: bigint;
  amount1Desired: bigint;
  amount0Min: bigint;
  amount1Min: bigint;
  // Optional: for creating new pools
  initialPrice?: number;
  token0Decimals?: number;
  token1Decimals?: number;
}

export interface PoolInfo {
  address: `0x${string}`;
  token0: `0x${string}`;
  token1: `0x${string}`;
  fee: number;
  tickSpacing: number;
  sqrtPriceX96: bigint;
  tick: number;
  liquidity: bigint;
}

// Math utilities for tick/price conversions
// Q96 = 2^96 (as a large number, avoiding BigInt exponentiation)
const Q96_STRING = "79228162514264337593543950336"; // 2^96
const Q96 = BigInt(Q96_STRING);
const Q192 = Q96 * Q96;

// Convert human-readable price to sqrtPriceX96
// Price is: how much token1 per token0 (e.g., 3000 USDC per 1 ETH)
// IMPORTANT: Tokens must be sorted by address first (token0 < token1)
export function priceToSqrtPriceX96(price: number, token0Decimals: number = 18, token1Decimals: number = 18): bigint {
  // Adjust price for decimal difference between tokens
  // Formula: sqrtPriceX96 = sqrt(price * 10^(token1Decimals - token0Decimals)) * 2^96
  const decimalAdjustment = Math.pow(10, token1Decimals - token0Decimals);
  const adjustedPrice = price * decimalAdjustment;
  const sqrtPrice = Math.sqrt(adjustedPrice);
  return BigInt(Math.floor(sqrtPrice * Number(Q96)));
}

// Convert sqrtPriceX96 to human-readable price
export function sqrtPriceX96ToPrice(sqrtPriceX96: bigint, token0Decimals: number, token1Decimals: number): number {
  // price = (sqrtPriceX96 / 2^96)^2 * 10^(token0Decimals - token1Decimals)
  const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
  const rawPrice = sqrtPrice * sqrtPrice;
  return rawPrice * Math.pow(10, token0Decimals - token1Decimals);
}

// Convert price to tick
export function priceToTick(price: number): number {
  return Math.floor(Math.log(price) / Math.log(1.0001));
}

// Convert tick to price
export function tickToPrice(tick: number): number {
  return Math.pow(1.0001, tick);
}

// Get nearest valid tick for a fee tier
export function nearestUsableTick(tick: number, tickSpacing: number): number {
  const rounded = Math.round(tick / tickSpacing) * tickSpacing;
  return rounded;
}

// Get tick spacing for fee
export function getTickSpacing(fee: number): number {
  const tier = FEE_TIERS.find(t => t.fee === fee);
  return tier?.tickSpacing || 60;
}

// Min/Max ticks for full range
export const MIN_TICK = -887272;
export const MAX_TICK = 887272;

// Hook for checking if pool exists
export function usePoolExists(token0: `0x${string}`, token1: `0x${string}`, fee: number) {
  const { data: poolAddress, isLoading, refetch } = useReadContract({
    address: FACTORY,
    abi: UniswapV3FactoryABI,
    functionName: "getPool",
    args: [token0, token1, fee],
    chainId: HUB_CHAIN_ID,
    query: {
      enabled: token0 !== "0x0000000000000000000000000000000000000000" && 
               token1 !== "0x0000000000000000000000000000000000000000" &&
               FACTORY !== "0x0000000000000000000000000000000000000000",
    }
  });

  const exists = poolAddress && poolAddress !== "0x0000000000000000000000000000000000000000";

  return { poolAddress: poolAddress as `0x${string}`, exists, isLoading, refetch };
}

// Hook for getting pool info
export function usePoolInfo(poolAddress: `0x${string}` | undefined) {
  const { data: slot0, isLoading: loadingSlot0 } = useReadContract({
    address: poolAddress,
    abi: UniswapV3PoolABI,
    functionName: "slot0",
    chainId: HUB_CHAIN_ID,
    query: {
      enabled: !!poolAddress && poolAddress !== "0x0000000000000000000000000000000000000000",
    }
  });

  const { data: liquidity, isLoading: loadingLiquidity } = useReadContract({
    address: poolAddress,
    abi: UniswapV3PoolABI,
    functionName: "liquidity",
    chainId: HUB_CHAIN_ID,
    query: {
      enabled: !!poolAddress && poolAddress !== "0x0000000000000000000000000000000000000000",
    }
  });

  const isLoading = loadingSlot0 || loadingLiquidity;

  return {
    sqrtPriceX96: slot0?.[0] as bigint | undefined,
    tick: slot0?.[1] as number | undefined,
    liquidity: liquidity as bigint | undefined,
    isLoading,
  };
}

// Main liquidity management hook
export function useLiquidity() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);

  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: HUB_CHAIN_ID });
  const { data: walletClient } = useWalletClient({ chainId: HUB_CHAIN_ID });

  // Write contract hooks
  const { writeContractAsync, data: txHash, isPending: isWritePending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Fetch user's positions
  const fetchPositions = useCallback(async () => {
    if (!address || !publicClient || POSITION_MANAGER === "0x0000000000000000000000000000000000000000") {
      setPositions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get number of positions
      const balance = await publicClient.readContract({
        address: POSITION_MANAGER,
        abi: NonfungiblePositionManagerABI,
        functionName: "balanceOf",
        args: [address],
      }) as bigint;

      if (balance === BigInt(0)) {
        setPositions([]);
        setIsLoading(false);
        return;
      }

      const positionsList: Position[] = [];

      for (let i = BigInt(0); i < balance; i++) {
        try {
          // Get token ID
          const tokenId = await publicClient.readContract({
            address: POSITION_MANAGER,
            abi: NonfungiblePositionManagerABI,
            functionName: "tokenOfOwnerByIndex",
            args: [address, i],
          }) as bigint;

          // Get position details
          const position = await publicClient.readContract({
            address: POSITION_MANAGER,
            abi: NonfungiblePositionManagerABI,
            functionName: "positions",
            args: [tokenId],
          }) as unknown as any[];

          // Only add positions with liquidity > 0
          if (position[7] > BigInt(0)) {
            // Get token symbols
            let token0Symbol = "???";
            let token1Symbol = "???";
            let token0Decimals = 18;
            let token1Decimals = 18;

            try {
              const [symbol0, symbol1, decimals0, decimals1] = await Promise.all([
                publicClient.readContract({
                  address: position[2] as `0x${string}`,
                  abi: ERC20ABI,
                  functionName: "symbol",
                }),
                publicClient.readContract({
                  address: position[3] as `0x${string}`,
                  abi: ERC20ABI,
                  functionName: "symbol",
                }),
                publicClient.readContract({
                  address: position[2] as `0x${string}`,
                  abi: ERC20ABI,
                  functionName: "decimals",
                }),
                publicClient.readContract({
                  address: position[3] as `0x${string}`,
                  abi: ERC20ABI,
                  functionName: "decimals",
                }),
              ]);
              token0Symbol = symbol0 as string;
              token1Symbol = symbol1 as string;
              token0Decimals = Number(decimals0);
              token1Decimals = Number(decimals1);
            } catch (e) {
              console.warn("Could not fetch token info:", e);
            }

            positionsList.push({
              tokenId,
              token0: position[2],
              token1: position[3],
              fee: Number(position[4]),
              tickLower: Number(position[5]),
              tickUpper: Number(position[6]),
              liquidity: position[7],
              tokensOwed0: position[10],
              tokensOwed1: position[11],
              token0Symbol,
              token1Symbol,
              token0Decimals,
              token1Decimals,
            });
          }
        } catch (e) {
          console.warn("Error fetching position:", e);
        }
      }

      setPositions(positionsList);
    } catch (err: any) {
      console.error("Error fetching positions:", err);
      setError(err.message || "Failed to fetch positions");
    } finally {
      setIsLoading(false);
    }
  }, [address, publicClient]);

  // Fetch positions on mount and when address changes
  useEffect(() => {
    if (isConnected && address) {
      fetchPositions();
    }
  }, [isConnected, address, fetchPositions]);

  // Create pool and initialize
  // initialPrice is: how much token1 you get per 1 token0 (as user entered it)
  // token0Decimals and token1Decimals are the decimals of the tokens as passed by user
  const createPool = useCallback(async (
    token0: `0x${string}`,
    token1: `0x${string}`,
    fee: number,
    initialPrice: number,
    token0Decimals: number = 18,
    token1Decimals: number = 18
  ): Promise<`0x${string}` | null> => {
    if (!address || !walletClient || POSITION_MANAGER === "0x0000000000000000000000000000000000000000") {
      setError("Wallet not connected or contracts not configured");
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Sort tokens by address (Uniswap V3 requirement)
      const needsSwap = token0.toLowerCase() > token1.toLowerCase();
      const [sortedToken0, sortedToken1] = needsSwap 
        ? [token1, token0] 
        : [token0, token1];
      
      // If we swapped the tokens, we need to invert the price
      // User entered: price = token1 per token0
      // After swap: we need token0_new per token1_new = 1/price
      const sortedPrice = needsSwap ? (1 / initialPrice) : initialPrice;
      
      // Also swap decimals if needed
      const sortedToken0Decimals = needsSwap ? token1Decimals : token0Decimals;
      const sortedToken1Decimals = needsSwap ? token0Decimals : token1Decimals;
      
      console.log("Creating pool:", {
        sortedToken0,
        sortedToken1,
        fee,
        userPrice: initialPrice,
        sortedPrice,
        sortedToken0Decimals,
        sortedToken1Decimals,
        needsSwap,
      });

      // Calculate sqrtPriceX96 with proper decimal adjustment
      const sqrtPriceX96 = priceToSqrtPriceX96(sortedPrice, sortedToken0Decimals, sortedToken1Decimals);
      
      console.log("sqrtPriceX96:", sqrtPriceX96.toString());

      const hash = await writeContractAsync({
        address: POSITION_MANAGER,
        abi: NonfungiblePositionManagerABI,
        functionName: "createAndInitializePoolIfNecessary",
        args: [sortedToken0, sortedToken1, fee, sqrtPriceX96],
        chainId: HUB_CHAIN_ID,
      });

      // Wait for confirmation
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log("Pool created:", receipt);
      }

      return hash;
    } catch (err: any) {
      console.error("Error creating pool:", err);
      setError(err.message || "Failed to create pool");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [address, walletClient, publicClient, writeContractAsync]);

  // Approve tokens for position manager
  const approveToken = useCallback(async (
    token: `0x${string}`,
    amount: bigint
  ): Promise<boolean> => {
    if (!address || !publicClient) return false;

    try {
      // Check current allowance
      const allowance = await publicClient.readContract({
        address: token,
        abi: ERC20ABI,
        functionName: "allowance",
        args: [address, POSITION_MANAGER],
      }) as bigint;

      if (allowance >= amount) return true;

      // Approve max
      const hash = await writeContractAsync({
        address: token,
        abi: ERC20ABI,
        functionName: "approve",
        args: [POSITION_MANAGER, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")],
        chainId: HUB_CHAIN_ID,
      });

      await publicClient.waitForTransactionReceipt({ hash });
      return true;
    } catch (err) {
      console.error("Error approving token:", err);
      return false;
    }
  }, [address, publicClient, writeContractAsync]);

  // Add liquidity (mint new position)
  // If initialPrice is provided and pool doesn't exist, creates the pool first
  const addLiquidity = useCallback(async (params: MintParams): Promise<`0x${string}` | null> => {
    if (!address || !walletClient || !publicClient || POSITION_MANAGER === "0x0000000000000000000000000000000000000000") {
      setError("Wallet not connected or contracts not configured");
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Sort tokens and amounts
      let token0 = params.token0;
      let token1 = params.token1;
      let amount0Desired = params.amount0Desired;
      let amount1Desired = params.amount1Desired;
      let amount0Min = params.amount0Min;
      let amount1Min = params.amount1Min;
      let initialPrice = params.initialPrice;
      let token0Decimals = params.token0Decimals || 18;
      let token1Decimals = params.token1Decimals || 18;

      const needsSwap = params.token0.toLowerCase() > params.token1.toLowerCase();
      if (needsSwap) {
        token0 = params.token1;
        token1 = params.token0;
        amount0Desired = params.amount1Desired;
        amount1Desired = params.amount0Desired;
        amount0Min = params.amount1Min;
        amount1Min = params.amount0Min;
        // Invert initial price if tokens are swapped
        if (initialPrice) {
          initialPrice = 1 / initialPrice;
        }
        // Swap decimals too
        const tempDecimals = token0Decimals;
        token0Decimals = token1Decimals;
        token1Decimals = tempDecimals;
      }

      // Check if pool exists
      const poolAddress = await publicClient.readContract({
        address: FACTORY,
        abi: UniswapV3FactoryABI,
        functionName: "getPool",
        args: [token0, token1, params.fee],
      }) as `0x${string}`;

      const poolExists = poolAddress && poolAddress !== "0x0000000000000000000000000000000000000000";

      // If pool doesn't exist and we have initial price, create it
      if (!poolExists && initialPrice) {
        console.log("Pool doesn't exist, creating with initial price:", initialPrice);
        
        const sqrtPriceX96 = priceToSqrtPriceX96(initialPrice, token0Decimals, token1Decimals);
        console.log("sqrtPriceX96 for new pool:", sqrtPriceX96.toString());

        const createHash = await writeContractAsync({
          address: POSITION_MANAGER,
          abi: NonfungiblePositionManagerABI,
          functionName: "createAndInitializePoolIfNecessary",
          args: [token0, token1, params.fee, sqrtPriceX96],
          chainId: HUB_CHAIN_ID,
        });

        await publicClient.waitForTransactionReceipt({ hash: createHash });
        console.log("Pool created successfully");
      } else if (!poolExists && !initialPrice) {
        throw new Error("Pool doesn't exist and no initial price provided");
      }

      // Approve tokens
      const [approved0, approved1] = await Promise.all([
        approveToken(token0, amount0Desired),
        approveToken(token1, amount1Desired),
      ]);

      if (!approved0 || !approved1) {
        throw new Error("Token approval failed");
      }

      // Mint position
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800); // 30 minutes

      const hash = await writeContractAsync({
        address: POSITION_MANAGER,
        abi: NonfungiblePositionManagerABI,
        functionName: "mint",
        args: [{
          token0,
          token1,
          fee: params.fee,
          tickLower: params.tickLower,
          tickUpper: params.tickUpper,
          amount0Desired,
          amount1Desired,
          amount0Min,
          amount1Min,
          recipient: address,
          deadline,
        }],
        chainId: HUB_CHAIN_ID,
      });

      // Wait for confirmation and refresh positions
      await publicClient.waitForTransactionReceipt({ hash });
      await fetchPositions();

      return hash;
    } catch (err: any) {
      console.error("Error adding liquidity:", err);
      setError(err.message || "Failed to add liquidity");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [address, walletClient, publicClient, writeContractAsync, approveToken, fetchPositions]);

  // Remove liquidity
  const removeLiquidity = useCallback(async (
    tokenId: bigint,
    liquidity: bigint,
    amount0Min: bigint = BigInt(0),
    amount1Min: bigint = BigInt(0)
  ): Promise<`0x${string}` | null> => {
    if (!address || !walletClient || POSITION_MANAGER === "0x0000000000000000000000000000000000000000") {
      setError("Wallet not connected");
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);

      // Decrease liquidity
      const decreaseHash = await writeContractAsync({
        address: POSITION_MANAGER,
        abi: NonfungiblePositionManagerABI,
        functionName: "decreaseLiquidity",
        args: [{
          tokenId,
          liquidity,
          amount0Min,
          amount1Min,
          deadline,
        }],
        chainId: HUB_CHAIN_ID,
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: decreaseHash });
      }

      // Collect tokens
      const collectHash = await writeContractAsync({
        address: POSITION_MANAGER,
        abi: NonfungiblePositionManagerABI,
        functionName: "collect",
        args: [{
          tokenId,
          recipient: address,
          amount0Max: BigInt("0xffffffffffffffffffffffffffffffff"),
          amount1Max: BigInt("0xffffffffffffffffffffffffffffffff"),
        }],
        chainId: HUB_CHAIN_ID,
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: collectHash });
        await fetchPositions();
      }

      return collectHash;
    } catch (err: any) {
      console.error("Error removing liquidity:", err);
      setError(err.message || "Failed to remove liquidity");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [address, walletClient, publicClient, writeContractAsync, fetchPositions]);

  // Collect fees only
  const collectFees = useCallback(async (tokenId: bigint): Promise<`0x${string}` | null> => {
    if (!address || !walletClient || POSITION_MANAGER === "0x0000000000000000000000000000000000000000") {
      setError("Wallet not connected");
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const hash = await writeContractAsync({
        address: POSITION_MANAGER,
        abi: NonfungiblePositionManagerABI,
        functionName: "collect",
        args: [{
          tokenId,
          recipient: address,
          amount0Max: BigInt("0xffffffffffffffffffffffffffffffff"),
          amount1Max: BigInt("0xffffffffffffffffffffffffffffffff"),
        }],
        chainId: HUB_CHAIN_ID,
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
        await fetchPositions();
      }

      return hash;
    } catch (err: any) {
      console.error("Error collecting fees:", err);
      setError(err.message || "Failed to collect fees");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [address, walletClient, publicClient, writeContractAsync, fetchPositions]);

  return {
    // State
    positions,
    isLoading: isLoading || isWritePending || isConfirming,
    error,
    isConfirmed,
    
    // Contract addresses
    positionManager: POSITION_MANAGER,
    factory: FACTORY,
    
    // Actions
    fetchPositions,
    createPool,
    addLiquidity,
    removeLiquidity,
    collectFees,
    approveToken,
    
    // Utilities
    priceToTick,
    tickToPrice,
    nearestUsableTick,
    getTickSpacing,
  };
}

export default useLiquidity;
