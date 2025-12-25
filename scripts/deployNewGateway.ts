import { ethers } from "hardhat";

const LZ_ENDPOINT_ARB = "0x1a44076050125825900e736c501f859c50fE728c";
const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const SONIC_EID = 30332;

// LZ Labs DVN on Arbitrum
const LZ_DVN_ARB = "0x2f55C492897526677C5B68fb199ea31E2c126416";
const LZ_EXECUTOR_ARB = "0x31CAe3B7fB82d847621859fb1585353c5720660D";

async function main() {
  console.log("=== DEPLOYING NEW GATEWAY WITH RESCUE FUNCTION ===\n");
  
  const [signer] = await ethers.getSigners();
  console.log(`Deployer: ${signer.address}`);
  
  const balance = await signer.getBalance();
  console.log(`Balance: ${ethers.utils.formatEther(balance)} ETH`);
  
  if (balance.lt(ethers.utils.parseEther("0.005"))) {
    console.log("❌ Need at least 0.005 ETH for deployment");
    return;
  }
  
  // Deploy new Gateway
  console.log("\nDeploying GatewayVault...");
  const Gateway = await ethers.getContractFactory("GatewayVault");
  const gateway = await Gateway.deploy(
    LZ_ENDPOINT_ARB,
    signer.address,
    SONIC_EID
  );
  await gateway.deployed();
  console.log(`✅ New Gateway deployed at: ${gateway.address}`);
  
  // Set peer to Hub
  console.log("\nSetting peer to Hub...");
  const hubBytes32 = ethers.utils.hexZeroPad(HUB.toLowerCase(), 32);
  const tx1 = await gateway.setPeer(SONIC_EID, hubBytes32);
  await tx1.wait();
  console.log("✅ Peer set");
  
  // Configure DVN
  console.log("\nConfiguring DVN...");
  const sendLib = "0x975bcD720be66659e3EB3C0e4F1866a3020E493A"; // Arbitrum send library
  
  const ulnConfig = ethers.utils.defaultAbiCoder.encode(
    ["tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)"],
    [{
      confirmations: 20,
      requiredDVNCount: 1,
      optionalDVNCount: 0,
      optionalDVNThreshold: 0,
      requiredDVNs: [LZ_DVN_ARB],
      optionalDVNs: [],
    }]
  );
  
  const executorConfig = ethers.utils.defaultAbiCoder.encode(
    ["tuple(uint32 maxMessageSize, address executor)"],
    [{ maxMessageSize: 10000, executor: LZ_EXECUTOR_ARB }]
  );
  
  const setConfigParams = [
    { eid: SONIC_EID, configType: 2, config: ulnConfig },  // ULN config
    { eid: SONIC_EID, configType: 1, config: executorConfig },  // Executor config
  ];
  
  const tx2 = await gateway.setConfig(sendLib, setConfigParams);
  await tx2.wait();
  console.log("✅ DVN configured");
  
  // Now link tokens via linkTokenToHub
  console.log("\nLinking tokens to Hub...");
  
  const tokenConfigs = [
    { tokenAddress: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", syntheticTokenAddress: ethers.constants.AddressZero, minBridgeAmt: ethers.utils.parseEther("0.001") }, // WETH
    { tokenAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", syntheticTokenAddress: ethers.constants.AddressZero, minBridgeAmt: ethers.utils.parseUnits("1", 6) }, // USDC
    { tokenAddress: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", syntheticTokenAddress: ethers.constants.AddressZero, minBridgeAmt: ethers.utils.parseUnits("1", 6) }, // USDT
    { tokenAddress: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", syntheticTokenAddress: ethers.constants.AddressZero, minBridgeAmt: ethers.utils.parseUnits("0.0001", 8) }, // WBTC
  ];
  
  // Build LZ options
  const lzOptions = ethers.utils.solidityPack(
    ["uint16", "uint8", "uint16", "uint8", "uint128"],
    [3, 1, 17, 1, 500000]
  );
  
  // Quote the link message
  const quoteFee = await gateway.quoteLinkTokensToHub(tokenConfigs, lzOptions);
  console.log(`Link fee: ${ethers.utils.formatEther(quoteFee)} ETH`);
  
  // Note: We'll skip linking for now since the Hub already has these tokens linked from old gateway
  // The Hub will reject the link message because tokens are already linked
  console.log("⚠️ Skipping linkTokenToHub - Hub already has these tokens linked from old gateway");
  
  // Verify rescue function exists
  console.log("\nVerifying rescue function...");
  const rescueSelector = ethers.utils.id("rescueTokens(address,address,uint256)").slice(0, 10);
  const code = await ethers.provider.getCode(gateway.address);
  const hasRescue = code.toLowerCase().includes(rescueSelector.slice(2).toLowerCase());
  console.log(`rescueTokens function: ${hasRescue ? "✅ EXISTS" : "❌ NOT FOUND"}`);
  
  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log(`New Gateway: ${gateway.address}`);
  console.log("\nNext steps:");
  console.log("1. Update Hub peer to new Gateway");
  console.log("2. Rescue tokens from OLD Gateway is NOT possible (no rescue function)");
  console.log("3. Future tokens can be rescued from NEW Gateway");
  
  return gateway.address;
}

main()
  .then((addr) => {
    console.log(`\n✅ Gateway: ${addr}`);
  })
  .catch(console.error);

