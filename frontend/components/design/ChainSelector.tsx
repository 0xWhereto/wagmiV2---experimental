"use client";

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { getChainLogo } from '@/lib/tokens/logos';

interface Chain {
  id: number;
  name: string;
  icon?: string;
}

interface ChainSelectorProps {
  label: string;
  selectedChain: Chain;
  chains: Chain[];
  onSelect: (chain: Chain) => void;
}

export function ChainSelector({ label, selectedChain, chains, onSelect }: ChainSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex-1">
      <div className="text-zinc-500 mb-2">{label}</div>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/50 hover:bg-zinc-900 rounded-lg transition-colors group"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full overflow-hidden bg-gradient-to-br from-zinc-400 to-zinc-500">
              <Image 
                src={getChainLogo(selectedChain.id)} 
                alt={selectedChain.name} 
                width={24} 
                height={24} 
                className="w-full h-full object-cover token-icon"
              />
            </div>
            <span className="text-zinc-100">{selectedChain.name}</span>
          </div>
          <ChevronDown className="w-4 h-4 text-zinc-400 group-hover:text-zinc-300" />
        </button>

        <AnimatePresence>
          {isOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 rounded-lg overflow-hidden shadow-2xl z-20"
              >
                {chains.map((chain) => (
                  <button
                    key={chain.id}
                    onClick={() => {
                      onSelect(chain);
                      setIsOpen(false);
                    }}
                    className="w-full px-4 py-3 flex items-center gap-2 hover:bg-zinc-800 transition-colors group"
                  >
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-gradient-to-br from-zinc-400 to-zinc-500">
                      <Image 
                        src={getChainLogo(chain.id)} 
                        alt={chain.name} 
                        width={24} 
                        height={24} 
                        className="w-full h-full object-cover token-icon"
                      />
                    </div>
                    <span className="text-zinc-300 group-hover:text-zinc-100">
                      {chain.name}
                    </span>
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

