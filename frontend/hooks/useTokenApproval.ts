"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, maxUint256 } from "viem";
import { getTokensForChain } from "@/lib/tokens/tokenList";
import { CHAIN_CONFIG, getChainConfig } from "@/lib/contracts/config";

// ERC20 ABI for allowance and approve
const erc20Abi = [
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// Get spender address for a chain (GatewayVault or SyntheticTokenHub)
function getSpenderAddress(chainId: number): `0x${string}` | null {
  const config = getChainConfig(chainId);
  if (!config) return null;
  
  if (config.isHubChain) {
    // Sonic - use SyntheticTokenHub
    return CHAIN_CONFIG.sonic.contracts.syntheticTokenHub as `0x${string}`;
  } else {
    // Gateway chains - use GatewayVault
    return (config.contracts as { gatewayVault?: string }).gatewayVault as `0x${string}` || null;
  }
}

export interface ApprovalState {
  needsApproval: boolean;
  isApproving: boolean;
  isCheckingAllowance: boolean;
  approvalTxHash: `0x${string}` | undefined;
  error: string | null;
}

export function useTokenApproval({
  tokenSymbol,
  amount,
  chainId,
  spenderAddress,
}: {
  tokenSymbol: string;
  amount: string;
  chainId: number;
  spenderAddress?: `0x${string}`;
}) {
  const { address, isConnected } = useAccount();
  const [error, setError] = useState<string | null>(null);

  // Get token address
  const tokens = getTokensForChain(chainId);
  const token = tokens.find(t => t.symbol === tokenSymbol);
  const tokenAddress = token?.address as `0x${string}` | undefined;
  const decimals = token?.decimals || 18;

  // Use provided spender or get from config
  const spender = spenderAddress || getSpenderAddress(chainId);

  // Check if it's a native token (no approval needed)
  const isNativeToken = !tokenAddress || 
    tokenAddress === "0x0000000000000000000000000000000000000000" ||
    tokenSymbol === "ETH" || 
    tokenSymbol === "S";

  // Parse amount to wei
  const amountWei = amount && parseFloat(amount) > 0 
    ? parseUnits(amount, decimals) 
    : BigInt(0);

  // Read current allowance
  const { 
    data: allowance, 
    isLoading: isCheckingAllowance,
    refetch: refetchAllowance,
  } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && spender ? [address, spender] : undefined,
    chainId,
    query: {
      enabled: isConnected && !!address && !!tokenAddress && !!spender && !isNativeToken,
    },
  });

  // Write contract for approval
  const { 
    writeContract, 
    data: approvalTxHash, 
    isPending: isApproving,
    reset: resetApproval,
  } = useWriteContract();

  // Wait for transaction
  const { isLoading: isWaitingForTx, isSuccess: approvalSuccess } = useWaitForTransactionReceipt({
    hash: approvalTxHash,
  });

  // Refetch allowance after successful approval
  useEffect(() => {
    if (approvalSuccess) {
      refetchAllowance();
    }
  }, [approvalSuccess, refetchAllowance]);

  // Check if approval is needed
  const needsApproval = !isNativeToken && 
    isConnected && 
    amountWei > BigInt(0) && 
    (allowance === undefined || allowance < amountWei);

  // Approve function
  const approve = async () => {
    if (!tokenAddress || !spender || !address) {
      setError("Missing required data for approval");
      return;
    }

    setError(null);
    
    try {
      writeContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, maxUint256], // Approve max for convenience
        chainId,
      });
    } catch (err: any) {
      setError(err.message || "Approval failed");
    }
  };

  return {
    needsApproval,
    isApproving: isApproving || isWaitingForTx,
    isCheckingAllowance,
    approvalTxHash,
    approvalSuccess,
    error,
    approve,
    resetApproval,
    allowance,
    refetchAllowance,
  };
}

// Hook for multiple token approvals (for multi-sell)
export function useMultiTokenApproval({
  tokens,
  chainId,
  spenderAddress,
}: {
  tokens: { symbol: string; amount: string }[];
  chainId: number;
  spenderAddress?: `0x${string}`;
}) {
  const { isConnected } = useAccount();
  
  // For simplicity, check the first token that needs approval
  // In production, you might want to batch these or check all
  const firstToken = tokens.find(t => parseFloat(t.amount) > 0);
  
  const approval = useTokenApproval({
    tokenSymbol: firstToken?.symbol || "",
    amount: firstToken?.amount || "0",
    chainId,
    spenderAddress,
  });

  // Check if any token needs approval
  const anyNeedsApproval = isConnected && tokens.some(t => {
    const amt = parseFloat(t.amount);
    return amt > 0;
  }) && approval.needsApproval;

  return {
    ...approval,
    needsApproval: anyNeedsApproval,
    currentToken: firstToken?.symbol,
  };
}

// Export helper for getting spender addresses
export { getSpenderAddress };

