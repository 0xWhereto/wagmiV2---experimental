"use client";

import { useReadContract, useWriteContract, useAccount } from "wagmi";
import { formatUnits } from "viem";
import {
  MAGICPOOL_ADDRESSES,
  WTOKEN_ABI,
  ERC20_ABI,
} from "./index";

const HUB_CHAIN_ID = 146; // Sonic

// Simple Oracle ABI
const ORACLE_ABI = [
  {
    inputs: [],
    name: "getPrice",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

type VaultType = "sWETH" | "sWBTC";

/**
 * Hook for Zero-IL vault interactions
 * Both sWETH and sWBTC vaults are now deployed
 */
export function useZeroILVault(vaultType: VaultType) {
  const { address } = useAccount();
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();

  // Select vault addresses based on type
  const vaultAddress = vaultType === "sWETH" 
    ? MAGICPOOL_ADDRESSES.wETH 
    : MAGICPOOL_ADDRESSES.wBTC;
  const assetAddress = vaultType === "sWETH" 
    ? MAGICPOOL_ADDRESSES.sWETH 
    : MAGICPOOL_ADDRESSES.sWBTC;
  const oracleAddress = vaultType === "sWETH"
    ? MAGICPOOL_ADDRESSES.oracleAdapter
    : MAGICPOOL_ADDRESSES.wBTCOracle;
  const decimals = vaultType === "sWETH" ? 18 : 8;

  // Get wToken balance (vault shares)
  const { data: wTokenBalance, refetch: refetchWToken } = useReadContract({
    address: vaultAddress,
    abi: WTOKEN_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: HUB_CHAIN_ID,
    query: { enabled: !!address },
  });

  // Get user asset balance
  const { data: assetBalance, refetch: refetchAsset } = useReadContract({
    address: assetAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: HUB_CHAIN_ID,
    query: { enabled: !!address },
  });

  // Get asset allowance for vault
  const { data: assetAllowance, refetch: refetchAllowance } = useReadContract({
    address: assetAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, vaultAddress] : undefined,
    chainId: HUB_CHAIN_ID,
    query: { enabled: !!address },
  });

  // Get wToken stats
  const { data: pricePerShare } = useReadContract({
    address: vaultAddress,
    abi: WTOKEN_ABI,
    functionName: "pricePerShare",
    chainId: HUB_CHAIN_ID,
  });

  const { data: totalValue } = useReadContract({
    address: vaultAddress,
    abi: WTOKEN_ABI,
    functionName: "getTotalValue",
    chainId: HUB_CHAIN_ID,
  });

  const { data: positionValue } = useReadContract({
    address: vaultAddress,
    abi: WTOKEN_ABI,
    functionName: "getPositionValue",
    args: address ? [address] : undefined,
    chainId: HUB_CHAIN_ID,
    query: { enabled: !!address },
  });

  // Get asset price from oracle (MIM per asset)
  // Since MIM is 1:1 with USDC, this gives USD price
  const { data: oraclePrice } = useReadContract({
    address: oracleAddress,
    abi: ORACLE_ABI,
    functionName: "getPrice",
    chainId: HUB_CHAIN_ID,
  });

  // Asset price in USD (oracle returns raw Uniswap price with 18 decimal precision)
  // Need to adjust for decimal difference between asset and MIM:
  // - sWETH (18 decimals) vs MIM (18 decimals): divide by 1e18 → price is direct
  // - sWBTC (8 decimals) vs MIM (18 decimals): divide by 1e28 effectively (1e18 + 1e10 adjustment)
  const defaultPrice = vaultType === "sWETH" ? 3000 : 95000;
  let assetPriceUSD = defaultPrice;
  if (oraclePrice) {
    const rawPrice = parseFloat(formatUnits(oraclePrice, 18));
    // For sWBTC, the raw price needs to be divided by 1e10 due to decimal difference (18 - 8 = 10)
    assetPriceUSD = vaultType === "sWBTC" ? rawPrice / 1e10 : rawPrice;
  }

  // Approve asset for vault
  const approveAsset = async (amount: bigint) => {
    return writeContractAsync({
      address: assetAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [vaultAddress, amount],
      chainId: HUB_CHAIN_ID,
    });
  };

  // Deposit asset to vault
  const deposit = async (amount: bigint, minShares: bigint = BigInt(0)) => {
    return writeContractAsync({
      address: vaultAddress,
      abi: WTOKEN_ABI,
      functionName: "deposit",
      args: [amount, minShares],
      chainId: HUB_CHAIN_ID,
    });
  };

  // Withdraw asset from vault
  const withdraw = async (shares: bigint, minAssets: bigint = BigInt(0)) => {
    return writeContractAsync({
      address: vaultAddress,
      abi: WTOKEN_ABI,
      functionName: "withdraw",
      args: [shares, minAssets],
      chainId: HUB_CHAIN_ID,
    });
  };

  const refetch = () => {
    refetchWToken();
    refetchAsset();
    refetchAllowance();
  };

  // Calculate approximate APR (trading fees + rebalancing rewards - borrow interest)
  // This is a placeholder - real APR would come from historical data
  const apr = 15; // Default 15% APR estimate

  return {
    // Vault info
    vaultAddress,
    assetAddress,
    vaultType,
    decimals,
    
    // Vault stats
    totalDeposited: totalValue ? formatUnits(totalValue, decimals) : "0",
    totalBorrowed: "0", // Would come from LeverageAMM
    currentDTV: 50, // Target 50% DTV
    assetPrice: assetPriceUSD, // From oracle
    totalValueUSD: totalValue 
      ? (parseFloat(formatUnits(totalValue, decimals)) * assetPriceUSD).toString() 
      : "0",
    pendingYield: "0",
    apr,
    pricePerShare: pricePerShare ? formatUnits(pricePerShare, 18) : "1.0",
    
    // User balances
    wTokenBalance: wTokenBalance ? formatUnits(wTokenBalance, decimals) : "0",
    wTokenBalanceRaw: wTokenBalance || BigInt(0),
    assetBalance: assetBalance ? formatUnits(assetBalance, decimals) : "0",
    assetBalanceRaw: assetBalance || BigInt(0),
    positionValue: positionValue ? formatUnits(positionValue, decimals) : "0",
    
    // Allowance
    assetAllowance: assetAllowance || BigInt(0),
    needsApproval: (amount: bigint) => (assetAllowance || BigInt(0)) < amount,
    
    // Actions
    approveAsset,
    deposit,
    withdraw,
    
    // State
    isPending: isWritePending,
    refetch,
  };
}

// Hook to get both wETH and wBTC vaults
export function useAllZeroILVaults() {
  const wethVault = useZeroILVault("sWETH");
  const wbtcVault = useZeroILVault("sWBTC");

  return {
    wethVault,
    wbtcVault,
    refetchAll: () => {
      wethVault.refetch();
      wbtcVault.refetch();
    },
  };
}
