import { useEffect, useState } from "react";
import { getChainConfig } from "@/lib/contracts/config";
import { getTokenBySymbol, type Token } from "@/lib/tokens/tokenList";
import { formatUnits } from "viem";

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

interface GatewayBalance {
  balance: string;
  balanceFormatted: string;
  isLoading: boolean;
  error: string | null;
  nativeSymbol: string;
}

/**
 * Hook to fetch the available balance of a token on a Gateway vault.
 * Used when bridging FROM Hub to show how much liquidity is available.
 * 
 * @param destChainId - The destination chain ID (gateway chain)
 * @param tokenSymbol - The synthetic token symbol (e.g., "sWETH")
 */
export function useGatewayBalance(
  destChainId: number,
  tokenSymbol: string
): GatewayBalance {
  const [balance, setBalance] = useState<string>("0");
  const [balanceFormatted, setBalanceFormatted] = useState<string>("0.00");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nativeSymbol, setNativeSymbol] = useState<string>("");

  useEffect(() => {
    const fetchBalance = async () => {
      // Only fetch for gateway chains (not Hub)
      const destConfig = getChainConfig(destChainId);
      if (!destConfig || destConfig.isHubChain) {
        setBalance("0");
        setBalanceFormatted("0.00");
        setNativeSymbol("");
        return;
      }

      // Get the gateway vault address
      const gatewayVault = (destConfig.contracts as Record<string, string>)?.gatewayVault;
      if (!gatewayVault) {
        setError("No gateway vault configured");
        return;
      }

      // Map synthetic token to native token on destination chain
      // e.g., sWETH -> WETH, sUSDC -> USDC, sWBTC -> WBTC
      // Handle edge case: "S" is native Sonic token (not bridgeable to other chains via gateway)
      let mappedNativeSymbol = tokenSymbol;
      if (tokenSymbol.startsWith("s") && tokenSymbol.length > 1 && tokenSymbol !== "S") {
        mappedNativeSymbol = tokenSymbol.slice(1); // Remove leading 's'
      }
      
      setNativeSymbol(mappedNativeSymbol);
      
      const token = getTokenBySymbol(destChainId, mappedNativeSymbol);
      
      if (!token) {
        // Token not supported for bridging (e.g., native "S" token)
        setError(`Not bridgeable`);
        setBalance("0");
        setBalanceFormatted("0.00");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Fetch balance using fetch API to avoid wagmi chain switching issues
        const response = await fetch(destConfig.rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_call",
            params: [
              {
                to: token.address,
                data: `0x70a08231000000000000000000000000${gatewayVault.slice(2).toLowerCase()}`,
              },
              "latest",
            ],
          }),
        });

        const data = await response.json();
        
        if (data.error) {
          throw new Error(data.error.message);
        }

        const rawBalance = BigInt(data.result || "0x0");
        const formatted = formatUnits(rawBalance, token.decimals);
        
        setBalance(rawBalance.toString());
        setBalanceFormatted(parseFloat(formatted).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: token.decimals <= 8 ? token.decimals : 6,
        }));
      } catch (err: any) {
        console.error("Failed to fetch gateway balance:", err);
        setError(err.message || "Failed to fetch balance");
        setBalance("0");
        setBalanceFormatted("0.00");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBalance();
  }, [destChainId, tokenSymbol]);

  return { balance, balanceFormatted, isLoading, error, nativeSymbol };
}

