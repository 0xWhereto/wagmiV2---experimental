import hardhat, { ethers } from "hardhat";
import { Options } from "@layerzerolabs/lz-v2-utilities";

/**
 * Fix the failed messages by skipping them, then re-link tokens with correct synthetic addresses
 */

// Gateways
const ARBITRUM_GATEWAY = "0xb867d9E9D374E8b1165bcDF6D3f66d1A9AAd2447";
const BASE_GATEWAY = "0xb867d9E9D374E8b1165bcDF6D3f66d1A9AAd2447";
const ETHEREUM_GATEWAY = "0xc792AB26B1f1670B2f5081F8d74bD6a451aD6b44";

// Hub
const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const LZ_ENDPOINT = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B"; // Sonic

// Endpoint IDs
const ARBITRUM_EID = 30110;
const BASE_EID = 30184;
const ETHEREUM_EID = 30101;

// Synthetic token addresses on Sonic
const SYNTHETIC_TOKENS = {
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  sUSDT: "0x72dFC771E515423E5B0CD2acf703d0F7eb30bdEa",
  sUSDC: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B",
};

// Token mappings per chain
const TOKEN_MAPPINGS: Record<string, { 
  gateway: string, 
  eid: number, 
  tokens: { remote: string, synthetic: string, decimals: number }[] 
}> = {
  arbitrum: {
    gateway: ARBITRUM_GATEWAY,
    eid: ARBITRUM_EID,
    tokens: [
      { remote: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", synthetic: SYNTHETIC_TOKENS.sWETH, decimals: 18 }, // WETH
      { remote: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", synthetic: SYNTHETIC_TOKENS.sUSDT, decimals: 6 },  // USDT
      { remote: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", synthetic: SYNTHETIC_TOKENS.sUSDC, decimals: 6 },  // USDC
    ],
  },
  base: {
    gateway: BASE_GATEWAY,
    eid: BASE_EID,
    tokens: [
      { remote: "0x4200000000000000000000000000000000000006", synthetic: SYNTHETIC_TOKENS.sWETH, decimals: 18 }, // WETH
      { remote: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", synthetic: SYNTHETIC_TOKENS.sUSDC, decimals: 6 },  // USDC
    ],
  },
  ethereum: {
    gateway: ETHEREUM_GATEWAY,
    eid: ETHEREUM_EID,
    tokens: [
      { remote: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", synthetic: SYNTHETIC_TOKENS.sWETH, decimals: 18 }, // WETH
      { remote: "0xdAC17F958D2ee523a2206206994597C13D831ec7", synthetic: SYNTHETIC_TOKENS.sUSDT, decimals: 6 },  // USDT
      { remote: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", synthetic: SYNTHETIC_TOKENS.sUSDC, decimals: 6 },  // USDC
    ],
  },
};

function addressToBytes32(address: string): string {
  return ethers.utils.hexZeroPad(address, 32);
}

const LZ_GAS_LIMIT = 500000;

async function skipFailedMessages() {
  console.log("\n--- Skipping Failed Messages on Sonic ---");
  
  const endpoint = await ethers.getContractAt(
    [
      "function skip(address oapp, uint32 srcEid, bytes32 sender, uint64 nonce) external",
      "function inboundNonce(address receiver, uint32 srcEid, bytes32 sender) view returns (uint64)",
      "function inboundPayloadHash(address receiver, uint32 srcEid, bytes32 sender, uint64 nonce) view returns (bytes32)",
    ],
    LZ_ENDPOINT
  );

  // Skip failed messages from Arbitrum
  const arbitrumSender = addressToBytes32(ARBITRUM_GATEWAY);
  const nonce = await endpoint.inboundNonce(HUB_ADDRESS, ARBITRUM_EID, arbitrumSender);
  console.log(`Arbitrum inbound nonce: ${nonce}`);

  for (let i = 1n; i <= nonce; i++) {
    const payloadHash = await endpoint.inboundPayloadHash(HUB_ADDRESS, ARBITRUM_EID, arbitrumSender, i);
    if (payloadHash !== ethers.constants.HashZero) {
      console.log(`Skipping message ${i} from Arbitrum (payload hash: ${payloadHash.slice(0, 10)}...)...`);
      try {
        const tx = await endpoint.skip(HUB_ADDRESS, ARBITRUM_EID, arbitrumSender, i, {
          gasLimit: 200000,
        });
        await tx.wait();
        console.log(`✓ Skipped message ${i}`);
      } catch (e: any) {
        console.log(`Failed to skip: ${e.reason || e.message?.slice(0, 150)}`);
      }
    } else {
      console.log(`Message ${i}: Already executed or cleared`);
    }
  }
}

async function relinkTokensOnGateway(networkName: string) {
  const mapping = TOKEN_MAPPINGS[networkName];
  if (!mapping) {
    console.log(`No mapping for ${networkName}`);
    return;
  }

  console.log(`\n--- Re-linking tokens on ${networkName.toUpperCase()} ---`);
  
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH`);

  const gatewayVault = await ethers.getContractAt("GatewayVault", mapping.gateway);

  const lzOptions = Options.newOptions().addExecutorLzReceiveOption(LZ_GAS_LIMIT, 0).toHex().toString();

  for (const token of mapping.tokens) {
    console.log(`\nLinking remote ${token.remote.slice(0, 10)}... to synthetic ${token.synthetic.slice(0, 10)}...`);
    
    // Check if token already linked
    try {
      const existingIndex = await gatewayVault.getTokenIndex(token.remote);
      console.log(`Token already linked at index ${existingIndex}`);
      continue;
    } catch {
      // Token not linked, proceed
    }

    const tokenConfig = [{
      onPause: false,
      tokenAddress: token.remote,
      syntheticTokenDecimals: token.decimals,
      syntheticTokenAddress: token.synthetic, // NOW USING CORRECT ADDRESS!
      minBridgeAmt: token.decimals === 18 
        ? ethers.utils.parseEther("0.001")
        : ethers.utils.parseUnits("1", token.decimals),
    }];

    try {
      const fee = await gatewayVault.quoteLinkTokenToHub(tokenConfig, lzOptions);
      console.log(`Fee: ${ethers.utils.formatEther(fee)} ETH`);

      const tx = await gatewayVault.linkTokenToHub(tokenConfig, lzOptions, {
        value: fee.mul(150).div(100),
        gasLimit: 600000,
      });
      console.log(`TX: ${tx.hash}`);
      await tx.wait();
      console.log(`✓ Linked!`);
    } catch (e: any) {
      console.log(`Failed: ${e.message?.slice(0, 100)}`);
    }
  }
}

async function main() {
  const network = hardhat.network.name;
  
  if (network === "sonic") {
    await skipFailedMessages();
    console.log("\nNow run this script on each gateway chain (arbitrum, base, ethereum)");
  } else if (TOKEN_MAPPINGS[network]) {
    await relinkTokensOnGateway(network);
  } else {
    console.log(`Unknown network: ${network}`);
    console.log("Run on: sonic (to skip), then arbitrum, base, ethereum (to relink)");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

