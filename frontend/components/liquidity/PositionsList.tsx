"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { PositionCard } from "./PositionCard";

// Mock positions data
const MOCK_POSITIONS = [
  {
    id: "1",
    token0: { symbol: "sWAGMI", icon: "wagmi" },
    token1: { symbol: "sETH", icon: "eth" },
    feeTier: 0.3,
    liquidity: "12,345.67",
    liquidityUsd: "$45,678.90",
    minPrice: "0.000015",
    maxPrice: "0.000025",
    currentPrice: "0.000018",
    inRange: true,
    unclaimedFees: {
      token0: "123.45",
      token1: "0.0234",
      usd: "$89.12",
    },
    apr: "24.5%",
  },
  {
    id: "2",
    token0: { symbol: "sDAI", icon: "dai" },
    token1: { symbol: "sUSDC", icon: "usdc" },
    feeTier: 0.05,
    liquidity: "50,000.00",
    liquidityUsd: "$100,234.56",
    minPrice: "0.998",
    maxPrice: "1.002",
    currentPrice: "1.0001",
    inRange: true,
    unclaimedFees: {
      token0: "45.67",
      token1: "45.89",
      usd: "$91.56",
    },
    apr: "8.2%",
  },
  {
    id: "3",
    token0: { symbol: "sWAGMI", icon: "wagmi" },
    token1: { symbol: "sDAI", icon: "dai" },
    feeTier: 1,
    liquidity: "5,678.90",
    liquidityUsd: "$12,345.67",
    minPrice: "0.025",
    maxPrice: "0.045",
    currentPrice: "0.052",
    inRange: false,
    unclaimedFees: {
      token0: "234.56",
      token1: "0",
      usd: "$53.88",
    },
    apr: "0%",
  },
];

type FilterType = "all" | "in-range" | "out-of-range";

interface PositionsListProps {
  onRemoveLiquidity: (position: any) => void;
  onAddLiquidity: () => void;
}

// Wallet icon
function WalletIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 6H3C2.44772 6 2 6.44772 2 7V16C2 16.5523 2.44772 17 3 17H17C17.5523 17 18 16.5523 18 16V7C18 6.44772 17.5523 6 17 6Z" stroke="#AFB6C9" strokeWidth="1.5"/>
      <path d="M14 11.5C14 12.0523 13.5523 12.5 13 12.5C12.4477 12.5 12 12.0523 12 11.5C12 10.9477 12.4477 10.5 13 10.5C13.5523 10.5 14 10.9477 14 11.5Z" fill="#AFB6C9"/>
      <path d="M4 6V5C4 3.89543 4.89543 3 6 3H14C15.1046 3 16 3.89543 16 5V6" stroke="#AFB6C9" strokeWidth="1.5"/>
    </svg>
  );
}

export function PositionsList({ onRemoveLiquidity, onAddLiquidity }: PositionsListProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const { isConnected } = useAccount();

  const filteredPositions = MOCK_POSITIONS.filter((pos) => {
    if (filter === "all") return true;
    if (filter === "in-range") return pos.inRange;
    if (filter === "out-of-range") return !pos.inRange;
    return true;
  });

  // Not connected state
  if (!isConnected) {
    return (
      <div 
        className="rounded-xl px-4 py-8 text-center"
        style={{ background: 'rgba(31, 36, 46, 0.6)' }}
      >
        <div className="flex justify-center mb-3">
          <WalletIcon />
        </div>
        <p className="text-sm font-normal tracking-[0.25px]" style={{ color: '#AFB6C9' }}>
          Connect wallet to view positions
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-4">
        {[
          { id: "all", label: "All", count: MOCK_POSITIONS.length },
          { id: "in-range", label: "In Range", count: MOCK_POSITIONS.filter(p => p.inRange).length },
          { id: "out-of-range", label: "Out of Range", count: MOCK_POSITIONS.filter(p => !p.inRange).length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as FilterType)}
            className="px-3 py-1.5 rounded-xl text-sm font-normal tracking-[0.25px] transition-all"
            style={{
              background: filter === tab.id ? '#20262F' : 'transparent',
              color: filter === tab.id ? '#FCFCFC' : '#7B8187',
              border: filter === tab.id ? '1px solid rgba(109, 119, 135, 0.2)' : '1px solid transparent',
            }}
          >
            {tab.label}
            <span 
              className="ml-1.5 text-xs"
              style={{ color: filter === tab.id ? '#AFB6C9' : '#7B8187' }}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Positions */}
      {filteredPositions.length > 0 ? (
        <div className="space-y-3">
          {filteredPositions.map((position) => (
            <PositionCard
              key={position.id}
              position={position}
              onRemove={() => onRemoveLiquidity(position)}
            />
          ))}
        </div>
      ) : (
        <div 
          className="rounded-xl px-4 py-8 text-center"
          style={{ background: 'rgba(31, 36, 46, 0.6)' }}
        >
          <p className="text-sm font-normal tracking-[0.25px] mb-3" style={{ color: '#AFB6C9' }}>
            No {filter.replace("-", " ")} positions
          </p>
          <button
            onClick={onAddLiquidity}
            className="text-sm font-medium tracking-[0.25px]"
            style={{ color: '#5D93B2' }}
          >
            Create a position
          </button>
        </div>
      )}
    </div>
  );
}
