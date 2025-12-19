import hardhat, { ethers } from "hardhat";

/**
 * Manually link remote tokens to synthetic tokens on Sonic Hub
 */

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

// Synthetic token addresses on Sonic
const SYNTHETIC_TOKENS = {
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  sUSDT: "0x72dFC771E515423E5B0CD2acf703d0F7eb30bdEa",
  sUSDC: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B",
};

// Chain EIDs
const CHAIN_EIDS = {
  arbitrum: 30110,
  base: 30184,
  ethereum: 30101,
};

// Gateway addresses
const GATEWAYS = {
  arbitrum: "0xb867d9E9D374E8b1165bcDF6D3f66d1A9AAd2447",
  base: "0xb867d9E9D374E8b1165bcDF6D3f66d1A9AAd2447",
  ethereum: "0xc792AB26B1f1670B2f5081F8d74bD6a451aD6b44",
};

// Remote tokens to link
const REMOTE_TOKENS = [
  // Arbitrum
  { 
    synthetic: "sWETH", 
    chain: "arbitrum", 
    remoteAddress: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", 
    decimals: 18,
    minBridge: ethers.utils.parseEther("0.001") 
  },
  { 
    synthetic: "sUSDT", 
    chain: "arbitrum", 
    remoteAddress: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", 
    decimals: 6,
    minBridge: ethers.utils.parseUnits("1", 6) 
  },
  { 
    synthetic: "sUSDC", 
    chain: "arbitrum", 
    remoteAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", 
    decimals: 6,
    minBridge: ethers.utils.parseUnits("1", 6) 
  },
  // Base
  { 
    synthetic: "sWETH", 
    chain: "base", 
    remoteAddress: "0x4200000000000000000000000000000000000006", 
    decimals: 18,
    minBridge: ethers.utils.parseEther("0.001") 
  },
  { 
    synthetic: "sUSDC", 
    chain: "base", 
    remoteAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", 
    decimals: 6,
    minBridge: ethers.utils.parseUnits("1", 6) 
  },
  // Ethereum
  { 
    synthetic: "sWETH", 
    chain: "ethereum", 
    remoteAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", 
    decimals: 18,
    minBridge: ethers.utils.parseEther("0.001") 
  },
  { 
    synthetic: "sUSDT", 
    chain: "ethereum", 
    remoteAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7", 
    decimals: 6,
    minBridge: ethers.utils.parseUnits("1", 6) 
  },
  { 
    synthetic: "sUSDC", 
    chain: "ethereum", 
    remoteAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", 
    decimals: 6,
    minBridge: ethers.utils.parseUnits("1", 6) 
  },
];

// Synthetic tokens all have decimals matching their type (WETH=18, stables=6)
const SYNTHETIC_DECIMALS = {
  sWETH: 18,
  sUSDT: 6,
  sUSDC: 6,
};

async function main() {
  const network = hardhat.network.name;
  if (network !== "sonic") {
    console.log("This script should be run on Sonic network");
    return;
  }

  const [deployer] = await ethers.getSigners();
  console.log(`\n========================================`);
  console.log(`Manually Linking Remote Tokens on SONIC`);
  console.log(`========================================`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(await deployer.getBalance())} S`);

  const hub = await ethers.getContractAt("SyntheticTokenHub", HUB_ADDRESS);

  // Link each remote token
  console.log("\n--- Linking Remote Tokens ---");
  
  for (const token of REMOTE_TOKENS) {
    const syntheticAddress = SYNTHETIC_TOKENS[token.synthetic as keyof typeof SYNTHETIC_TOKENS];
    const srcEid = CHAIN_EIDS[token.chain as keyof typeof CHAIN_EIDS];
    const gateway = GATEWAYS[token.chain as keyof typeof GATEWAYS];
    const syntheticDecimals = SYNTHETIC_DECIMALS[token.synthetic as keyof typeof SYNTHETIC_DECIMALS];
    
    // Calculate decimals delta: syntheticDecimals - remoteDecimals
    const decimalsDelta = syntheticDecimals - token.decimals;
    
    console.log(`\nLinking ${token.synthetic} <- ${token.chain} (${token.remoteAddress})`);
    console.log(`  Synthetic: ${syntheticAddress}`);
    console.log(`  Chain EID: ${srcEid}`);
    console.log(`  Gateway: ${gateway}`);
    console.log(`  Decimals delta: ${decimalsDelta}`);
    console.log(`  Min bridge: ${token.minBridge.toString()}`);
    
    try {
      // First try static call to get detailed error
      console.log(`  Simulating...`);
      await hub.callStatic.manualLinkRemoteToken(
        syntheticAddress,
        srcEid,
        token.remoteAddress,
        gateway,
        decimalsDelta,
        token.minBridge,
        { gasLimit: 500000 }
      );
      console.log(`  Simulation passed, executing...`);
      
      const tx = await hub.manualLinkRemoteToken(
        syntheticAddress,
        srcEid,
        token.remoteAddress,
        gateway,
        decimalsDelta,
        token.minBridge,
        { gasLimit: 500000 }
      );
      console.log(`  TX: ${tx.hash}`);
      await tx.wait();
      console.log(`  ✓ Linked!`);
    } catch (e: any) {
      if (e.message?.includes("Already linked")) {
        console.log(`  ✓ Already linked`);
      } else {
        console.log(`  ✗ Failed: ${e.message?.slice(0, 200)}`);
        if (e.reason) console.log(`  Reason: ${e.reason}`);
        if (e.error?.data) console.log(`  Error data: ${e.error.data}`);
      }
    }
  }

  console.log("\n========================================");
  console.log("LINKING COMPLETE!");
  console.log("========================================");
  console.log("\nYou can now bridge tokens from Arbitrum/Base/Ethereum to Sonic.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

