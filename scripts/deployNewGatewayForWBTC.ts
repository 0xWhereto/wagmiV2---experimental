import { ethers } from "hardhat";

/**
 * Deploy a new Arbitrum Gateway with WBTC support.
 * The new Gateway has `updateSyntheticTokenAddress` function.
 * 
 * Steps:
 * 1. Deploy new Gateway
 * 2. Set Hub as peer
 * 3. Configure DVN for sending
 * 4. Link all tokens (WETH, USDT, USDC, WBTC)
 */

const CONFIG = {
  // Hub (Sonic)
  hub: "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd",
  sonicEid: 30332,
  
  // Arbitrum
  endpoint: "0x1a44076050125825900e736c501f859c50fE728c",
  dvn: "0x2f55C492897526677C5B68fb199ea31E2c126416",
  executor: "0x31CAe3B7fB82d847621859fb1585353c5720660D",
  
  // sBTC found earlier
  sbtc: "0x2F0324268031E6413280F3B5ddBc4A97639A284a",
  
  // Tokens to link
  tokens: [
    {
      name: "WETH",
      address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
      synthetic: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
      syntheticDecimals: 18,
      minBridge: ethers.utils.parseEther("0.0001"),
    },
    {
      name: "USDT",
      address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      synthetic: "0x72dFC771E515423E5B0CD2acf703d0F7eb30bdEa",
      syntheticDecimals: 6,
      minBridge: ethers.utils.parseUnits("1", 6),
    },
    {
      name: "USDC",
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      synthetic: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B",
      syntheticDecimals: 6,
      minBridge: ethers.utils.parseUnits("1", 6),
    },
    {
      name: "WBTC",
      address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
      synthetic: "0x2F0324268031E6413280F3B5ddBc4A97639A284a", // sBTC
      syntheticDecimals: 8,
      minBridge: ethers.utils.parseUnits("0.00001", 8),
    },
  ],
};

async function main() {
  console.log("=== DEPLOYING NEW ARBITRUM GATEWAY WITH WBTC ===\n");
  
  const [signer] = await ethers.getSigners();
  console.log(`Deployer: ${signer.address}`);
  const balance = await signer.getBalance();
  console.log(`Balance: ${ethers.utils.formatEther(balance)} ETH`);
  
  if (balance.lt(ethers.utils.parseEther("0.002"))) {
    console.log("❌ Need at least 0.002 ETH for deployment");
    return;
  }
  
  // Step 1: Deploy Gateway
  console.log("\n--- Step 1: Deploying Gateway ---");
  const GatewayVault = await ethers.getContractFactory("GatewayVault");
  const gateway = await GatewayVault.deploy(
    CONFIG.endpoint,
    signer.address,
    CONFIG.sonicEid
  );
  await gateway.deployed();
  console.log(`✅ Gateway deployed: ${gateway.address}`);
  
  // Step 2: Set Hub as peer
  console.log("\n--- Step 2: Setting Hub as peer ---");
  const hubPeer = ethers.utils.hexZeroPad(CONFIG.hub, 32);
  const tx1 = await gateway.setPeer(CONFIG.sonicEid, hubPeer);
  await tx1.wait();
  console.log(`✅ Set Hub as peer`);
  
  // Step 3: Configure DVN
  console.log("\n--- Step 3: Configuring DVN ---");
  
  const endpointAbi = [
    "function setConfig(address oapp, address lib, tuple(uint32 eid, uint32 configType, bytes config)[] params)",
    "function getSendLibrary(address sender, uint32 eid) view returns (address)",
  ];
  
  const endpoint = new ethers.Contract(CONFIG.endpoint, endpointAbi, signer);
  
  // Get send library
  const sendLib = await endpoint.getSendLibrary(gateway.address, CONFIG.sonicEid);
  console.log(`Send library: ${sendLib}`);
  
  // ULN config
  const ulnConfig = ethers.utils.defaultAbiCoder.encode(
    ["tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)"],
    [{
      confirmations: 15,
      requiredDVNCount: 1,
      optionalDVNCount: 0,
      optionalDVNThreshold: 0,
      requiredDVNs: [CONFIG.dvn],
      optionalDVNs: [],
    }]
  );
  
  // Executor config
  const executorConfig = ethers.utils.defaultAbiCoder.encode(
    ["tuple(uint32 maxMessageSize, address executor)"],
    [{ maxMessageSize: 10000, executor: CONFIG.executor }]
  );
  
  const tx2 = await endpoint.setConfig(
    gateway.address,
    sendLib,
    [
      { eid: CONFIG.sonicEid, configType: 2, config: ulnConfig },
      { eid: CONFIG.sonicEid, configType: 1, config: executorConfig },
    ]
  );
  await tx2.wait();
  console.log(`✅ Configured DVN and Executor`);
  
  // Step 4: Link tokens
  console.log("\n--- Step 4: Linking tokens ---");
  
  const tokensConfig = CONFIG.tokens.map(t => ({
    onPause: false,
    tokenAddress: t.address,
    syntheticTokenDecimals: t.syntheticDecimals,
    syntheticTokenAddress: t.synthetic,
    minBridgeAmt: t.minBridge,
  }));
  
  for (const t of CONFIG.tokens) {
    console.log(`  ${t.name}: ${t.address} -> ${t.synthetic}`);
  }
  
  // LZ options
  const lzOptions = ethers.utils.solidityPack(
    ["uint16", "uint8", "uint16", "uint8", "uint128"],
    [3, 1, 17, 1, 500000]
  );
  
  // Quote fee
  const fee = await gateway.quoteLinkTokenToHub(tokensConfig, lzOptions);
  console.log(`\nLink fee: ${ethers.utils.formatEther(fee)} ETH`);
  
  // Link
  const tx3 = await gateway.linkTokenToHub(tokensConfig, lzOptions, {
    value: fee.mul(120).div(100), // 20% buffer
  });
  console.log(`TX: ${tx3.hash}`);
  await tx3.wait();
  console.log(`✅ Tokens linked!`);
  
  // Summary
  console.log("\n========================================");
  console.log("DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log(`New Gateway: ${gateway.address}`);
  console.log(`\nNEXT STEPS:`);
  console.log(`1. Update Hub peer on Sonic to new Gateway:`);
  console.log(`   npx hardhat run scripts/updateHubPeer.ts --network sonic`);
  console.log(`2. Rescue tokens from old Gateway to new one`);
  console.log(`3. Update frontend config`);
  console.log(`4. Wait for LZ messages to be delivered`);
}

main().catch(console.error);

