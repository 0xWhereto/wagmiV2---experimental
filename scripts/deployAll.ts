import { ethers, network } from "hardhat";
import { EndpointId } from "@layerzerolabs/lz-definitions";

// LayerZero V2 Endpoint addresses
const LZ_ENDPOINTS: Record<string, string> = {
  sonic: "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B", // Correct Sonic endpoint
  arbitrum: "0x1a44076050125825900e736c501f859c50fE728c",
  ethereum: "0x1a44076050125825900e736c501f859c50fE728c",
  base: "0x1a44076050125825900e736c501f859c50fE728c",
};

// LayerZero Endpoint IDs
const EID: Record<string, number> = {
  sonic: EndpointId.SONIC_V2_MAINNET,      // 30332
  arbitrum: EndpointId.ARBITRUM_V2_MAINNET, // 30110
  ethereum: EndpointId.ETHEREUM_V2_MAINNET, // 30101
  base: EndpointId.BASE_V2_MAINNET,         // 30184
};

// Token addresses on each chain
const TOKENS: Record<string, Record<string, { address: string; decimals: number }>> = {
  arbitrum: {
    WETH: { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", decimals: 18 },
    WBTC: { address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", decimals: 8 },
    USDC: { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
    USDT: { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
  },
  ethereum: {
    WETH: { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18 },
    WBTC: { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8 },
    USDC: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
    USDT: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
  },
  base: {
    WETH: { address: "0x4200000000000000000000000000000000000006", decimals: 18 },
    USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
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

  if (networkName === "sonic") {
    await deployHub(deployer);
  } else if (["arbitrum", "ethereum", "base"].includes(networkName)) {
    await deployGateway(networkName, deployer);
  } else {
    console.log("Unknown network. Use: sonic, arbitrum, ethereum, or base");
  }
}

async function deployHub(deployer: any) {
  const lzEndpoint = LZ_ENDPOINTS.sonic;
  
  // Uniswap Universal Router and Permit2 on Sonic
  // Using zero addresses since we're not using Universal Router swaps
  const uniswapUniversalRouter = "0x0000000000000000000000000000000000000000";
  const uniswapPermitV2 = "0x0000000000000000000000000000000000000000";
  const balancer = deployer.address; // Owner can be balancer initially
  
  console.log("Deploying SyntheticTokenHub...");
  const Hub = await ethers.getContractFactory("SyntheticTokenHub");
  const hub = await Hub.deploy(
    lzEndpoint, 
    deployer.address, 
    uniswapUniversalRouter,
    uniswapPermitV2,
    balancer,
    { gasLimit: 8000000 }
  );
  await hub.deployed();
  console.log(`✅ SyntheticTokenHub deployed at: ${hub.address}`);

  console.log("\nDeploying SyntheticTokenHubGetters...");
  const Getters = await ethers.getContractFactory("SyntheticTokenHubGetters");
  const getters = await Getters.deploy(hub.address);
  await getters.deployed();
  console.log(`✅ SyntheticTokenHubGetters deployed at: ${getters.address}`);

  // Output for config update
  console.log("\n========================================");
  console.log("UPDATE FRONTEND CONFIG:");
  console.log("========================================");
  console.log(`syntheticTokenHub: "${hub.address}",`);
  console.log(`hubGetters: "${getters.address}",`);
  
  return { hub, getters };
}

async function deployGateway(networkName: string, deployer: any) {
  const lzEndpoint = LZ_ENDPOINTS[networkName];
  const hubEid = EID.sonic;

  console.log(`Deploying GatewayVault on ${networkName}...`);
  const Gateway = await ethers.getContractFactory("GatewayVault");
  const gateway = await Gateway.deploy(lzEndpoint, deployer.address, hubEid);
  await gateway.deployed();
  console.log(`✅ GatewayVault deployed at: ${gateway.address}`);

  // Output for config update
  console.log("\n========================================");
  console.log(`UPDATE FRONTEND CONFIG for ${networkName}:`);
  console.log("========================================");
  console.log(`gatewayVault: "${gateway.address}",`);

  return gateway;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

