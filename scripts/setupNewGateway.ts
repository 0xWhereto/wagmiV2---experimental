import hardhat, { ethers } from "hardhat";
import { Options } from "@layerzerolabs/lz-v2-utilities";

/**
 * Setup an already-deployed Gateway (set peer + link tokens)
 */

const LZ_GAS_LIMIT = 500000;

// Hub on Sonic
const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const SONIC_EID = 30332;

// Synthetic token addresses on Sonic
const SYNTHETIC_TOKENS = {
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  sUSDT: "0x72dFC771E515423E5B0CD2acf703d0F7eb30bdEa",
  sUSDC: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B",
};

// Synthetic decimals
const SYNTHETIC_DECIMALS: Record<keyof typeof SYNTHETIC_TOKENS, number> = {
  sWETH: 18,
  sUSDT: 6,
  sUSDC: 6,
};

// New Gateway addresses per chain
const NEW_GATEWAYS: Record<string, string> = {
  base: "0xB712543E7fB87C411AAbB10c6823cf39bbEBB4Bb",
};

// Token configs per chain
const TOKEN_CONFIGS: Record<string, Array<{
  symbol: string;
  address: string;
  decimals: number;
  syntheticSymbol: keyof typeof SYNTHETIC_TOKENS;
}>> = {
  base: [
    { symbol: "WETH", address: "0x4200000000000000000000000000000000000006", decimals: 18, syntheticSymbol: "sWETH" },
    { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6, syntheticSymbol: "sUSDC" },
  ],
};

function addressToBytes32(addr: string): string {
  return ethers.utils.hexZeroPad(addr, 32).toLowerCase();
}

async function main() {
  const network = hardhat.network.name;
  
  const gatewayAddress = NEW_GATEWAYS[network];
  const tokens = TOKEN_CONFIGS[network];
  
  if (!gatewayAddress || !tokens) {
    console.log(`Network ${network} not configured.`);
    return;
  }

  const [deployer] = await ethers.getSigners();
  
  console.log(`\n========================================`);
  console.log(`Setting up Gateway on ${network.toUpperCase()}`);
  console.log(`========================================`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH`);
  console.log(`Gateway: ${gatewayAddress}`);

  const gateway = await ethers.getContractAt("GatewayVault", gatewayAddress);
  
  // 1. Set peer to Hub
  console.log("\n--- Step 1: Setting peer to Hub ---");
  try {
    const currentPeer = await gateway.peers(SONIC_EID);
    const expectedPeer = addressToBytes32(HUB_ADDRESS);
    
    if (currentPeer.toLowerCase() === expectedPeer.toLowerCase()) {
      console.log("Peer already set correctly");
    } else {
      const tx = await gateway.setPeer(SONIC_EID, expectedPeer, { gasLimit: 100000 });
      console.log(`TX: ${tx.hash}`);
      await tx.wait();
      console.log("✓ Peer set!");
    }
  } catch (e: any) {
    console.log(`Failed: ${e.message?.slice(0, 100)}`);
  }

  // 2. Link tokens
  console.log("\n--- Step 2: Linking tokens ---");
  const lzOptions = Options.newOptions().addExecutorLzReceiveOption(LZ_GAS_LIMIT, 0).toHex().toString();
  
  for (const token of tokens) {
    const syntheticAddress = SYNTHETIC_TOKENS[token.syntheticSymbol];
    const syntheticDecimals = SYNTHETIC_DECIMALS[token.syntheticSymbol];
    
    console.log(`\n${token.symbol}:`);
    
    const tokenConfig = [{
      onPause: false,
      tokenAddress: token.address,
      syntheticTokenDecimals: syntheticDecimals,
      syntheticTokenAddress: syntheticAddress,
      minBridgeAmt: token.decimals === 18 
        ? ethers.utils.parseEther("0.001") 
        : ethers.utils.parseUnits("1", token.decimals),
    }];

    try {
      const fee = await gateway.quoteLinkTokenToHub(tokenConfig, lzOptions);
      console.log(`  Fee: ${ethers.utils.formatEther(fee)} ETH`);
      
      const tx = await gateway.linkTokenToHub(tokenConfig, lzOptions, {
        value: fee.mul(150).div(100),
        gasLimit: 600000,
      });
      console.log(`  TX: ${tx.hash}`);
      await tx.wait();
      console.log(`  ✓ Linked!`);
    } catch (e: any) {
      console.log(`  ✗ Failed: ${e.message?.slice(0, 100)}`);
    }
  }

  // Summary
  console.log("\n--- Final state ---");
  const finalCount = await gateway.getAvailableTokenLength();
  console.log(`Total linked tokens: ${finalCount}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


