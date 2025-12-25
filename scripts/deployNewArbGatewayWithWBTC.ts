import { ethers } from "hardhat";

/**
 * Deploy a new Arbitrum Gateway with WBTC support.
 * 
 * Steps:
 * 1. Find or create sBTC on Hub (if needed)
 * 2. Deploy new Gateway on Arbitrum
 * 3. Set Hub as peer on new Gateway
 * 4. Set new Gateway as peer on Hub
 * 5. Configure DVN settings
 * 6. Link all tokens (WETH, USDT, USDC, WBTC)
 */

const CONFIG = {
  // Hub (Sonic)
  hub: "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd",
  hubGetters: "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e",
  sonicEid: 30332,
  sonicDvn: "0x282b3386571f7f794450d5789911a9804fa346b4", // LZ Labs DVN on Sonic
  
  // Arbitrum
  arbitrumEid: 30110,
  endpoint: "0x1a44076050125825900e736c501f859c50fE728c",
  dvn: "0x2f55C492897526677C5B68fb199ea31E2c126416", // LZ Labs DVN on Arbitrum
  executor: "0x31CAe3B7fB82d847621859fb1585353c5720660D", // LZ Labs Executor on Arbitrum
  
  // Tokens
  tokens: {
    WETH: {
      address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
      synthetic: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
      syntheticDecimals: 18,
      minBridge: ethers.utils.parseEther("0.0001"),
    },
    USDT: {
      address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      synthetic: "0x72dFC771E515423E5B0CD2acf703d0F7eb30bdEa",
      syntheticDecimals: 6,
      minBridge: ethers.utils.parseUnits("1", 6),
    },
    USDC: {
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      synthetic: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B",
      syntheticDecimals: 6,
      minBridge: ethers.utils.parseUnits("1", 6),
    },
    WBTC: {
      address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
      synthetic: "", // Will be set after finding/creating
      syntheticDecimals: 8,
      minBridge: ethers.utils.parseUnits("0.00001", 8), // 0.00001 BTC
    },
  },
};

async function main() {
  console.log("=== DEPLOYING NEW ARBITRUM GATEWAY WITH WBTC ===\n");
  
  const [signer] = await ethers.getSigners();
  console.log(`Deployer: ${signer.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(await signer.getBalance())} ETH\n`);
  
  // Step 1: Find sBTC on Hub
  console.log("--- Step 1: Finding sBTC on Hub ---");
  const sonicProvider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");
  
  const hubGettersAbi = [
    "function getSyntheticTokenCount() view returns (uint256)",
    "function getSyntheticTokenInfo(uint256) view returns (address, string, uint8)",
    "function getRemoteTokenInfo(address, uint32) view returns (address, int8, uint256, uint256)",
  ];
  
  const hubGetters = new ethers.Contract(CONFIG.hubGetters, hubGettersAbi, sonicProvider);
  
  const count = await hubGetters.getSyntheticTokenCount();
  console.log(`Total synthetic tokens on Hub: ${count}`);
  
  let sbtcAddress = "";
  for (let i = 1; i <= count.toNumber(); i++) {
    try {
      const info = await hubGetters.getSyntheticTokenInfo(i);
      if (info[1] === "sBTC") {
        // Check if already linked to Arbitrum
        try {
          const remoteInfo = await hubGetters.getRemoteTokenInfo(info[0], CONFIG.arbitrumEid);
          if (remoteInfo[0] === ethers.constants.AddressZero) {
            console.log(`Found unlinked sBTC at index ${i}: ${info[0]}`);
            sbtcAddress = info[0];
            break;
          } else {
            console.log(`sBTC at ${info[0]} already linked to Arbitrum (${remoteInfo[0]})`);
          }
        } catch (e) {
          sbtcAddress = info[0];
          break;
        }
      }
    } catch (e) {}
  }
  
  if (!sbtcAddress) {
    console.log("\n⚠️ No unlinked sBTC found!");
    console.log("You need to create sBTC on the Hub first.");
    console.log("Run: npx hardhat run scripts/createSBTCOnHub.ts --network sonic");
    return;
  }
  
  CONFIG.tokens.WBTC.synthetic = sbtcAddress;
  console.log(`\nUsing sBTC: ${sbtcAddress}`);
  
  // Step 2: Deploy new Gateway
  console.log("\n--- Step 2: Deploying new Gateway ---");
  const GatewayVault = await ethers.getContractFactory("GatewayVault");
  const gateway = await GatewayVault.deploy(
    CONFIG.endpoint,
    signer.address, // owner
    CONFIG.sonicEid // destination EID
  );
  await gateway.deployed();
  console.log(`✅ New Gateway deployed: ${gateway.address}`);
  
  // Step 3: Set Hub as peer on Gateway
  console.log("\n--- Step 3: Setting Hub as peer on Gateway ---");
  const hubPeer = ethers.utils.hexZeroPad(CONFIG.hub, 32);
  const tx1 = await gateway.setPeer(CONFIG.sonicEid, hubPeer);
  await tx1.wait();
  console.log(`✅ Set Hub (${CONFIG.hub}) as peer for Sonic EID ${CONFIG.sonicEid}`);
  
  // Step 4: Configure DVN for sending
  console.log("\n--- Step 4: Configuring DVN ---");
  
  // Send config: Use Arbitrum's LZ Labs DVN
  const endpointAbi = [
    "function setConfig(address oapp, address lib, tuple(uint32 eid, uint32 configType, bytes config)[] params)",
  ];
  const sendLibAbi = [
    "function getSendLibrary(address sender, uint32 eid) view returns (address)",
  ];
  
  const endpoint = new ethers.Contract(CONFIG.endpoint, endpointAbi, signer);
  const sendLibReader = new ethers.Contract(CONFIG.endpoint, sendLibAbi, signer);
  
  // Get send library
  const sendLib = await sendLibReader.getSendLibrary(gateway.address, CONFIG.sonicEid);
  console.log(`Send library: ${sendLib}`);
  
  // Encode ULN config with DVN
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
  
  // Encode executor config
  const executorConfig = ethers.utils.defaultAbiCoder.encode(
    ["tuple(uint32 maxMessageSize, address executor)"],
    [{
      maxMessageSize: 10000,
      executor: CONFIG.executor,
    }]
  );
  
  const tx2 = await endpoint.setConfig(
    gateway.address,
    sendLib,
    [
      { eid: CONFIG.sonicEid, configType: 2, config: ulnConfig }, // ULN config
      { eid: CONFIG.sonicEid, configType: 1, config: executorConfig }, // Executor config
    ]
  );
  await tx2.wait();
  console.log("✅ Configured DVN and Executor for sending");
  
  // Step 5: Link tokens
  console.log("\n--- Step 5: Linking tokens ---");
  
  const tokensConfig = Object.entries(CONFIG.tokens).map(([name, token]) => ({
    onPause: false,
    tokenAddress: token.address,
    syntheticTokenDecimals: token.syntheticDecimals,
    syntheticTokenAddress: token.synthetic,
    minBridgeAmt: token.minBridge,
  }));
  
  console.log("Token configs:");
  for (const t of tokensConfig) {
    console.log(`  ${t.tokenAddress} -> ${t.syntheticTokenAddress}`);
  }
  
  // Build LZ options
  const lzOptions = ethers.utils.solidityPack(
    ["uint16", "uint8", "uint16", "uint8", "uint128"],
    [3, 1, 17, 1, 500000]
  );
  
  // Quote the link fee
  const linkFee = await gateway.quoteLinkTokenToHub(tokensConfig, lzOptions);
  console.log(`Link fee: ${ethers.utils.formatEther(linkFee)} ETH`);
  
  // Link tokens
  const tx3 = await gateway.linkTokenToHub(tokensConfig, lzOptions, {
    value: linkFee.mul(110).div(100), // 10% buffer
  });
  console.log(`TX: ${tx3.hash}`);
  await tx3.wait();
  console.log("✅ Tokens linked! LZ message sent to Hub");
  
  // Summary
  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log(`New Gateway: ${gateway.address}`);
  console.log(`\nNEXT STEPS:`);
  console.log(`1. Update Hub peer on Sonic to point to new Gateway:`);
  console.log(`   hub.setPeer(${CONFIG.arbitrumEid}, ${ethers.utils.hexZeroPad(gateway.address, 32)})`);
  console.log(`2. Update Hub receive DVN config to accept from new Gateway`);
  console.log(`3. Update frontend config with new Gateway address`);
  console.log(`4. Verify LZ message was delivered on Hub`);
}

main().catch(console.error);


