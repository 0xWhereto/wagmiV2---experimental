import { ethers, network } from "hardhat";
import { EndpointId } from "@layerzerolabs/lz-definitions";

// Existing Hub on Sonic
const EXISTING_HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const SONIC_EID = EndpointId.SONIC_V2_MAINNET; // 30332

// LayerZero V2 Endpoint addresses per chain
const LZ_ENDPOINTS: Record<string, string> = {
  arbitrum: "0x1a44076050125825900e736c501f859c50fE728c",
  ethereum: "0x1a44076050125825900e736c501f859c50fE728c",
  base: "0x1a44076050125825900e736c501f859c50fE728c",
};

// Token addresses per chain
const TOKENS: Record<string, Record<string, { address: string; symbol: string; decimals: number }>> = {
  arbitrum: {
    WETH: { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", symbol: "WETH", decimals: 18 },
    WBTC: { address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", symbol: "WBTC", decimals: 8 },
    USDC: { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", symbol: "USDC", decimals: 6 },
    USDT: { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", symbol: "USDT", decimals: 6 },
  },
  ethereum: {
    WETH: { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH", decimals: 18 },
    WBTC: { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", symbol: "WBTC", decimals: 8 },
    USDC: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", decimals: 6 },
    USDT: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT", decimals: 6 },
  },
  base: {
    WETH: { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 },
    USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6 },
  },
};

async function main() {
  const networkName = network.name;
  console.log(`\n========================================`);
  console.log(`Deploying on ${networkName}`);
  console.log(`========================================\n`);

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  const balance = await deployer.getBalance();
  console.log(`Balance: ${ethers.utils.formatEther(balance)} native token\n`);

  if (["arbitrum", "ethereum", "base"].includes(networkName)) {
    await deployGateway(networkName, deployer);
  } else {
    console.log("Use this script on: arbitrum, ethereum, or base");
  }
}

async function deployGateway(networkName: string, deployer: any) {
  const lzEndpoint = LZ_ENDPOINTS[networkName];

  console.log(`Deploying GatewayVault on ${networkName}...`);
  console.log(`  LZ Endpoint: ${lzEndpoint}`);
  console.log(`  Hub EID: ${SONIC_EID}`);

  const Gateway = await ethers.getContractFactory("GatewayVault");
  const gateway = await Gateway.deploy(
    lzEndpoint, 
    deployer.address, 
    SONIC_EID,
    { gasLimit: 5000000 }
  );
  await gateway.deployed();
  console.log(`✅ GatewayVault deployed at: ${gateway.address}`);

  // Convert Hub address to bytes32 for setPeer
  const hubBytes32 = ethers.utils.hexZeroPad(EXISTING_HUB, 32);
  console.log(`\nSetting peer to Hub (${EXISTING_HUB})...`);
  const tx = await gateway.setPeer(SONIC_EID, hubBytes32);
  await tx.wait();
  console.log(`✅ Peer set to Hub`);

  // Register tokens
  console.log(`\nRegistering tokens...`);
  const tokens = TOKENS[networkName];
  for (const [name, info] of Object.entries(tokens)) {
    try {
      const registerTx = await gateway.registerToken(info.address, true, { gasLimit: 200000 });
      await registerTx.wait();
      console.log(`  ✅ ${name} registered (${info.address})`);
    } catch (e: any) {
      console.log(`  ⚠️ ${name} registration: ${e.reason || e.message}`);
    }
  }

  // Output for config and Hub setup
  console.log("\n========================================");
  console.log(`SAVE THESE FOR ${networkName.toUpperCase()}:`);
  console.log("========================================");
  console.log(`gatewayVault: "${gateway.address}",`);
  console.log(`\nNow run on Sonic to set peer:`);
  console.log(`hub.setPeer(${getEid(networkName)}, "${ethers.utils.hexZeroPad(gateway.address, 32)}")`);
}

function getEid(network: string): number {
  const eids: Record<string, number> = {
    arbitrum: EndpointId.ARBITRUM_V2_MAINNET,
    ethereum: EndpointId.ETHEREUM_V2_MAINNET,
    base: EndpointId.BASE_V2_MAINNET,
  };
  return eids[network] || 0;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

