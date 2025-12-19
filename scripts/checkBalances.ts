import { ethers } from "hardhat";

const DEPLOYER = "0x4151E05ABe56192e2A6775612C2020509Fd50637";

async function main() {
  console.log("=== Deployer Balances ===\n");
  
  const chains = [
    { name: "Arbitrum", rpc: "https://arb1.arbitrum.io/rpc" },
    { name: "Ethereum", rpc: "https://ethereum-rpc.publicnode.com" },
    { name: "Sonic", rpc: "https://rpc.soniclabs.com" },
  ];

  for (const chain of chains) {
    const provider = new ethers.providers.JsonRpcProvider(chain.rpc);
    const balance = await provider.getBalance(DEPLOYER);
    console.log(`${chain.name}: ${ethers.utils.formatEther(balance)} ETH`);
  }
}

main().catch(console.error);
