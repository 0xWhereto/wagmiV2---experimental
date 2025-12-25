"use client";

import { useReadContract, useWriteContract, useAccount } from "wagmi";
import { formatUnits } from "viem";
import {
  MAGICPOOL_ADDRESSES,
  MIM_TOKEN_ABI,
  STAKING_VAULT_ABI,
  ERC20_ABI,
} from "./index";

const HUB_CHAIN_ID = 146; // Sonic

// ============ Hook for MIM Token (Mint/Redeem with sUSDC) ============

export function useMIMMinter() {
  const { address } = useAccount();
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();

  // Get user sUSDC balance
  const { data: sUSDCBalance, refetch: refetchSUSDC } = useReadContract({
    address: MAGICPOOL_ADDRESSES.sUSDC,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: HUB_CHAIN_ID,
    query: { enabled: !!address },
  });

  // Get user MIM balance
  const { data: mimBalance, refetch: refetchMIM } = useReadContract({
    address: MAGICPOOL_ADDRESSES.mimToken,
    abi: MIM_TOKEN_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: HUB_CHAIN_ID,
    query: { enabled: !!address },
  });

  // Get allowance for sUSDC to MIM contract
  const { data: sUSDCAllowance, refetch: refetchAllowance } = useReadContract({
    address: MAGICPOOL_ADDRESSES.sUSDC,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, MAGICPOOL_ADDRESSES.mimToken] : undefined,
    chainId: HUB_CHAIN_ID,
    query: { enabled: !!address },
  });

  // Get total MIM supply and backing
  const { data: totalSupply, refetch: refetchSupply } = useReadContract({
    address: MAGICPOOL_ADDRESSES.mimToken,
    abi: MIM_TOKEN_ABI,
    functionName: "totalSupply",
    chainId: HUB_CHAIN_ID,
  });

  const { data: totalBacking, refetch: refetchBacking } = useReadContract({
    address: MAGICPOOL_ADDRESSES.mimToken,
    abi: MIM_TOKEN_ABI,
    functionName: "totalBacking",
    chainId: HUB_CHAIN_ID,
  });

  // Approve sUSDC for MIM contract
  const approveSUSDC = async (amount: bigint) => {
    return writeContractAsync({
      address: MAGICPOOL_ADDRESSES.sUSDC,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [MAGICPOOL_ADDRESSES.mimToken, amount],
      chainId: HUB_CHAIN_ID,
    });
  };

  // Mint MIM with sUSDC (1:1)
  const mintMIM = async (amount: bigint) => {
    return writeContractAsync({
      address: MAGICPOOL_ADDRESSES.mimToken,
      abi: MIM_TOKEN_ABI,
      functionName: "mintWithUSDC",
      args: [amount],
      chainId: HUB_CHAIN_ID,
    });
  };

  // Redeem MIM for sUSDC (1:1)
  const redeemMIM = async (amount: bigint) => {
    return writeContractAsync({
      address: MAGICPOOL_ADDRESSES.mimToken,
      abi: MIM_TOKEN_ABI,
      functionName: "redeemForUSDC",
      args: [amount],
      chainId: HUB_CHAIN_ID,
    });
  };

  const refetch = () => {
    refetchSUSDC();
    refetchMIM();
    refetchAllowance();
    refetchSupply();
    refetchBacking();
  };

  return {
    // Pool stats
    totalMIMSupply: totalSupply ? formatUnits(totalSupply, 18) : "0", // MIM has 18 decimals
    totalSUSDCBacking: totalBacking ? formatUnits(totalBacking, 6) : "0", // sUSDC has 6 decimals
    
    // User balances
    sUSDCBalance: sUSDCBalance ? formatUnits(sUSDCBalance, 6) : "0", // sUSDC has 6 decimals
    sUSDCBalanceRaw: sUSDCBalance || BigInt(0),
    mimBalance: mimBalance ? formatUnits(mimBalance, 18) : "0", // MIM has 18 decimals
    mimBalanceRaw: mimBalance || BigInt(0),
    
    // Allowance
    sUSDCAllowance: sUSDCAllowance || BigInt(0),
    needsApproval: (amount: bigint) => (sUSDCAllowance || BigInt(0)) < amount,
    
    // Actions
    approveSUSDC,
    mintMIM,
    redeemMIM,
    
    // State
    isPending: isWritePending,
    refetch,
  };
}

// ============ Hook for Staking Vault (sMIM) ============

export function useStakingVault() {
  const { address } = useAccount();
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();

  // Get user sMIM balance
  const { data: sMIMBalance, refetch: refetchSMIM } = useReadContract({
    address: MAGICPOOL_ADDRESSES.stakingVault,
    abi: STAKING_VAULT_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: HUB_CHAIN_ID,
    query: { enabled: !!address },
  });

  // Get user MIM balance
  const { data: mimBalance, refetch: refetchMIM } = useReadContract({
    address: MAGICPOOL_ADDRESSES.mimToken,
    abi: MIM_TOKEN_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: HUB_CHAIN_ID,
    query: { enabled: !!address },
  });

  // Get MIM allowance for StakingVault
  const { data: mimAllowance, refetch: refetchAllowance } = useReadContract({
    address: MAGICPOOL_ADDRESSES.mimToken,
    abi: MIM_TOKEN_ABI,
    functionName: "allowance",
    args: address ? [address, MAGICPOOL_ADDRESSES.stakingVault] : undefined,
    chainId: HUB_CHAIN_ID,
    query: { enabled: !!address },
  });

  // Get vault stats
  const { data: totalAssets, refetch: refetchTotalAssets } = useReadContract({
    address: MAGICPOOL_ADDRESSES.stakingVault,
    abi: STAKING_VAULT_ABI,
    functionName: "totalAssets",
    chainId: HUB_CHAIN_ID,
  });

  const { data: totalBorrows, refetch: refetchTotalBorrows } = useReadContract({
    address: MAGICPOOL_ADDRESSES.stakingVault,
    abi: STAKING_VAULT_ABI,
    functionName: "totalBorrows",
    chainId: HUB_CHAIN_ID,
  });

  const { data: availableCash, refetch: refetchCash } = useReadContract({
    address: MAGICPOOL_ADDRESSES.stakingVault,
    abi: STAKING_VAULT_ABI,
    functionName: "getCash",
    chainId: HUB_CHAIN_ID,
  });

  const { data: utilizationRate, refetch: refetchUtilization } = useReadContract({
    address: MAGICPOOL_ADDRESSES.stakingVault,
    abi: STAKING_VAULT_ABI,
    functionName: "utilizationRate",
    chainId: HUB_CHAIN_ID,
  });

  const { data: borrowRateRaw, refetch: refetchBorrowRate } = useReadContract({
    address: MAGICPOOL_ADDRESSES.stakingVault,
    abi: STAKING_VAULT_ABI,
    functionName: "borrowRate",
    chainId: HUB_CHAIN_ID,
  });

  const { data: supplyRateRaw, refetch: refetchSupplyRate } = useReadContract({
    address: MAGICPOOL_ADDRESSES.stakingVault,
    abi: STAKING_VAULT_ABI,
    functionName: "supplyRate",
    chainId: HUB_CHAIN_ID,
  });

  // Approve MIM for StakingVault
  const approveMIM = async (amount: bigint) => {
    return writeContractAsync({
      address: MAGICPOOL_ADDRESSES.mimToken,
      abi: MIM_TOKEN_ABI,
      functionName: "approve",
      args: [MAGICPOOL_ADDRESSES.stakingVault, amount],
      chainId: HUB_CHAIN_ID,
    });
  };

  // Deposit MIM to get sMIM
  const deposit = async (amount: bigint) => {
    return writeContractAsync({
      address: MAGICPOOL_ADDRESSES.stakingVault,
      abi: STAKING_VAULT_ABI,
      functionName: "deposit",
      args: [amount],
      chainId: HUB_CHAIN_ID,
    });
  };

  // Withdraw sMIM to get MIM back
  const withdraw = async (shares: bigint) => {
    return writeContractAsync({
      address: MAGICPOOL_ADDRESSES.stakingVault,
      abi: STAKING_VAULT_ABI,
      functionName: "withdraw",
      args: [shares],
      chainId: HUB_CHAIN_ID,
    });
  };

  const refetch = () => {
    refetchSMIM();
    refetchMIM();
    refetchAllowance();
    refetchTotalAssets();
    refetchTotalBorrows();
    refetchCash();
    refetchUtilization();
    refetchBorrowRate();
    refetchSupplyRate();
  };

  // Calculate utilization as percentage (from 18 decimals)
  const utilizationPct = utilizationRate 
    ? Number(utilizationRate) / 1e16 // Convert from 18 decimals to percentage
    : 0;
  
  // Calculate interest rates as percentages (from 18 decimals)
  const borrowAPR = borrowRateRaw 
    ? Number(borrowRateRaw) / 1e16 // Convert from 18 decimals to percentage
    : 10; // Default 10% base rate
    
  const supplyAPR = supplyRateRaw
    ? Number(supplyRateRaw) / 1e16 
    : 0;

  return {
    // Vault stats
    totalAssets: totalAssets ? formatUnits(totalAssets, 18) : "0", // MIM has 18 decimals
    totalBorrowed: totalBorrows ? formatUnits(totalBorrows, 18) : "0", // MIM has 18 decimals
    availableLiquidity: availableCash ? formatUnits(availableCash, 18) : "0", // MIM has 18 decimals
    utilization: utilizationPct,
    interestRate: borrowAPR,
    supplyRate: supplyAPR,
    totalInterestEarned: "0", // TODO: Calculate from borrow index changes
    
    // User balances
    sMIMBalance: sMIMBalance ? formatUnits(sMIMBalance, 18) : "0", // sMIM has 18 decimals
    sMIMBalanceRaw: sMIMBalance || BigInt(0),
    mimBalance: mimBalance ? formatUnits(mimBalance, 18) : "0", // MIM has 18 decimals
    mimBalanceRaw: mimBalance || BigInt(0),
    
    // Allowance
    mimAllowance: mimAllowance || BigInt(0),
    needsApproval: (amount: bigint) => (mimAllowance || BigInt(0)) < amount,
    
    // Actions
    approveMIM,
    deposit,
    withdraw,
    
    // State
    isPending: isWritePending,
    refetch,
  };
}

// ============ Combined Hook ============

export function useMagicPool() {
  const minter = useMIMMinter();
  const vault = useStakingVault();

  return {
    minter,
    vault,
    refetchAll: () => {
      minter.refetch();
      vault.refetch();
    },
  };
}
