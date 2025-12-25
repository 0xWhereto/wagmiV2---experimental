"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const navItems = [
  { name: "Swap", href: "/" },
  { name: "Bridge", href: "/bridge" },
  { name: "Liquidity", href: "/liquidity" },
  { name: "Dashboard", href: "/dashboard" },
];

// Logo Icon
function LogoIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" stroke="#10B981" strokeWidth="2" fill="none" />
      <path d="M10 20L16 10L22 20" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 17H20" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// Menu icon
function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

// Close icon
function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

// Wallet icon
function WalletIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="6" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <circle cx="17" cy="14" r="2" />
    </svg>
  );
}

// Settings icon
function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
    </svg>
  );
}

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header 
      className="fixed top-0 left-0 right-0 z-50 px-6 py-4 bg-zinc-950"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <LogoIcon />
          <span className="text-lg font-medium text-white">
            SwapLab
          </span>
        </Link>

        {/* Desktop Navigation - Hidden for minimal design */}
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className="text-sm font-medium transition-all hover:text-white"
                style={{
                  color: isActive ? "white" : "#6B7280",
                }}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Right side buttons */}
        <div className="hidden md:flex items-center gap-3">
          {/* Settings */}
          <button className="p-2 rounded-lg transition-all hover:bg-white/5">
            <SettingsIcon />
          </button>

          {/* Connect Wallet Button */}
          <ConnectButton.Custom>
            {({
              account,
              chain,
              openAccountModal,
              openChainModal,
              openConnectModal,
              authenticationStatus,
              mounted,
            }) => {
              const ready = mounted && authenticationStatus !== "loading";
              const connected =
                ready &&
                account &&
                chain &&
                (!authenticationStatus || authenticationStatus === "authenticated");

              return (
                <div
                  {...(!ready && {
                    "aria-hidden": true,
                    style: {
                      opacity: 0,
                      pointerEvents: "none",
                      userSelect: "none",
                    },
                  })}
                >
                  {(() => {
                    if (!connected) {
                      return (
                        <button
                          onClick={openConnectModal}
                          type="button"
                          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all hover:bg-gray-100"
                          style={{
                            background: "white",
                            color: "#0f0f0f",
                          }}
                        >
                          <WalletIcon />
                          Connect Wallet
                        </button>
                      );
                    }

                    if (chain.unsupported) {
                      return (
                        <button
                          onClick={openChainModal}
                          type="button"
                          className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
                          style={{
                            background: "#EF4444",
                            color: "white",
                          }}
                        >
                          Wrong Network
                        </button>
                      );
                    }

                    return (
                      <div className="flex items-center gap-2">
                        {/* Chain Selector */}
                        <button
                          onClick={openChainModal}
                          type="button"
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border hover:bg-white/5"
                          style={{
                            background: "transparent",
                            color: "white",
                            borderColor: "#374151",
                          }}
                        >
                          {chain.hasIcon && (
                            <div
                              style={{
                                background: chain.iconBackground,
                                width: 18,
                                height: 18,
                                borderRadius: 999,
                                overflow: "hidden",
                              }}
                            >
                              {chain.iconUrl && (
                                <img
                                  alt={chain.name ?? "Chain icon"}
                                  src={chain.iconUrl}
                                  style={{ width: 18, height: 18 }}
                                />
                              )}
                            </div>
                          )}
                          {chain.name}
                        </button>

                        {/* Account Button */}
                        <button
                          onClick={openAccountModal}
                          type="button"
                          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-gray-100"
                          style={{
                            background: "white",
                            color: "#0f0f0f",
                          }}
                        >
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ background: "linear-gradient(135deg, #667EEA 0%, #764BA2 100%)" }}
                          />
                          {account.displayName}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg transition-all text-white"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div 
          className="md:hidden absolute top-full left-0 right-0 p-4 border-t border-zinc-900 bg-zinc-950"
        >
          <nav className="flex flex-col gap-2 mb-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className="px-4 py-3 rounded-lg transition-all"
                  style={{
                    color: isActive ? "white" : "#6B7280",
                  }}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>
          
          {/* Mobile Connect Button */}
          <ConnectButton.Custom>
            {({
              account,
              chain,
              openAccountModal,
              openChainModal,
              openConnectModal,
              authenticationStatus,
              mounted,
            }) => {
              const ready = mounted && authenticationStatus !== "loading";
              const connected =
                ready &&
                account &&
                chain &&
                (!authenticationStatus || authenticationStatus === "authenticated");

              return (
                <div
                  {...(!ready && {
                    "aria-hidden": true,
                    style: {
                      opacity: 0,
                      pointerEvents: "none",
                      userSelect: "none",
                    },
                  })}
                >
                  {(() => {
                    if (!connected) {
                      return (
                        <button 
                          onClick={openConnectModal}
                          type="button"
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all"
                          style={{
                            background: "white",
                            color: "#0f0f0f",
                          }}
                        >
                          <WalletIcon />
                          Connect Wallet
                        </button>
                      );
                    }

                    if (chain.unsupported) {
                      return (
                        <button
                          onClick={openChainModal}
                          type="button"
                          className="w-full py-3 rounded-lg font-medium"
                          style={{
                            background: "#EF4444",
                            color: "white",
                          }}
                        >
                          Wrong Network
                        </button>
                      );
                    }

                    return (
                      <div className="space-y-2">
                        <button
                          onClick={openChainModal}
                          type="button"
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium border"
                          style={{
                            background: "transparent",
                            color: "white",
                            borderColor: "#374151",
                          }}
                        >
                          {chain.hasIcon && chain.iconUrl && (
                            <img
                              alt={chain.name ?? "Chain icon"}
                              src={chain.iconUrl}
                              style={{ width: 18, height: 18, borderRadius: 999 }}
                            />
                          )}
                          {chain.name}
                        </button>
                        <button 
                          onClick={openAccountModal}
                          type="button"
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium"
                          style={{
                            background: "white",
                            color: "#0f0f0f",
                          }}
                        >
                          <div 
                            className="w-5 h-5 rounded-full"
                            style={{ background: "linear-gradient(135deg, #667EEA 0%, #764BA2 100%)" }}
                          />
                          {account.displayName}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>
      )}
    </header>
  );
}
