"use client";

import * as React from "react";
import {
  RainbowKitProvider,
  connectorsForWallets,
  darkTheme,
} from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  coinbaseWallet,
  walletConnectWallet,
  rainbowWallet,
  trustWallet,
  injectedWallet,
  safeWallet,
  ledgerWallet,
  braveWallet,
  argentWallet,
  okxWallet,
} from "@rainbow-me/rainbowkit/wallets";
import {
  mainnet,
  arbitrum,
  base,
} from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import "@rainbow-me/rainbowkit/styles.css";
import { ToastProvider } from "@/components/Toast";
import { SettingsProvider } from "@/contexts/SettingsContext";

// Custom Sonic chain
const sonic = {
  id: 146,
  name: "Sonic",
  nativeCurrency: {
    decimals: 18,
    name: "Sonic",
    symbol: "S",
  },
  rpcUrls: {
    default: { http: ["https://rpc.soniclabs.com"] },
  },
  blockExplorers: {
    default: { name: "Sonic Explorer", url: "https://sonicscan.org" },
  },
} as const;

// WalletConnect Project ID - get yours at https://cloud.walletconnect.com
const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "3a8170812b534d0ff9d794f19a901d64";

const appInfo = {
  appName: "WAGMI Swap",
};

// Configure wallet groups similar to Curve.fi
const connectors = connectorsForWallets(
  [
    {
      groupName: "Popular",
      wallets: [
        metaMaskWallet,
        coinbaseWallet,
        walletConnectWallet,
        rainbowWallet,
      ],
    },
    {
      groupName: "More Wallets",
      wallets: [
        trustWallet,
        okxWallet,
        braveWallet,
        argentWallet,
        ledgerWallet,
        safeWallet,
        injectedWallet,
      ],
    },
  ],
  {
    appName: appInfo.appName,
    projectId,
  }
);

// Supported chains
const chains = [sonic, arbitrum, base, mainnet] as const;

// Create wagmi config
const config = createConfig({
  connectors,
  chains,
  transports: {
    [sonic.id]: http("https://rpc.soniclabs.com"),
    [arbitrum.id]: http("https://arb1.arbitrum.io/rpc"),
    [base.id]: http("https://mainnet.base.org"),
    [mainnet.id]: http("https://ethereum-rpc.publicnode.com"),
  },
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  
  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          appInfo={appInfo}
          theme={darkTheme({
            accentColor: "#10B981",
            accentColorForeground: "white",
            borderRadius: "large",
            fontStack: "system",
            overlayBlur: "small",
          })}
          modalSize="compact"
          initialChain={sonic}
        >
          <ToastProvider>
            <SettingsProvider>
              {mounted ? children : null}
            </SettingsProvider>
          </ToastProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

// Export chains and config for use in other components
export { sonic, config, chains };
