import { ethers } from "hardhat";

/**
 * The original link message might be stuck due to DVN config.
 * Deploy a fresh WBTC-only Gateway and send link again.
 */

const CONFIG = {
  hub: "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd",
  sonicEid: 30332,
  endpoint: "0x1a44076050125825900e736c501f859c50fE728c",
  dvn: "0x2f55C492897526677C5B68fb199ea31E2c126416",
  executor: "0x31CAe3B7fB82d847621859fb1585353c5720660D",
  
  wbtc: {
    address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
    synthetic: "0x2F0324268031E6413280F3B5ddBc4A97639A284a",
    syntheticDecimals: 8,
    minBridge: ethers.utils.parseUnits("0.00001", 8),
  },
};

async function main() {
  console.log("=== DEPLOYING FRESH WBTC GATEWAY ===\n");
  
  const [signer] = await ethers.getSigners();
  console.log(`Deployer: ${signer.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(await signer.getBalance())} ETH`);
  
  // Deploy
  console.log("\nDeploying Gateway...");
  const GatewayVault = await ethers.getContractFactory("GatewayVault");
  const gateway = await GatewayVault.deploy(CONFIG.endpoint, signer.address, CONFIG.sonicEid);
  await gateway.deployed();
  console.log(`Gateway: ${gateway.address}`);
  
  // Set peer
  await (await gateway.setPeer(CONFIG.sonicEid, ethers.utils.hexZeroPad(CONFIG.hub, 32))).wait();
  console.log("✅ Peer set");
  
  // Configure DVN
  const endpointAbi = [
    "function setConfig(address oapp, address lib, tuple(uint32 eid, uint32 configType, bytes config)[] params)",
    "function getSendLibrary(address sender, uint32 eid) view returns (address)",
  ];
  const endpoint = new ethers.Contract(CONFIG.endpoint, endpointAbi, signer);
  const sendLib = await endpoint.getSendLibrary(gateway.address, CONFIG.sonicEid);
  
  const ulnConfig = ethers.utils.defaultAbiCoder.encode(
    ["tuple(uint64,uint8,uint8,uint8,address[],address[])"],
    [{ confirmations: 15, requiredDVNCount: 1, optionalDVNCount: 0, optionalDVNThreshold: 0, requiredDVNs: [CONFIG.dvn], optionalDVNs: [] }]
  );
  const executorConfig = ethers.utils.defaultAbiCoder.encode(
    ["tuple(uint32,address)"],
    [{ maxMessageSize: 10000, executor: CONFIG.executor }]
  );
  
  await (await endpoint.setConfig(gateway.address, sendLib, [
    { eid: CONFIG.sonicEid, configType: 2, config: ulnConfig },
    { eid: CONFIG.sonicEid, configType: 1, config: executorConfig },
  ])).wait();
  console.log("✅ DVN configured");
  
  // Link WBTC
  const tokensConfig = [{
    onPause: false,
    tokenAddress: CONFIG.wbtc.address,
    syntheticTokenDecimals: CONFIG.wbtc.syntheticDecimals,
    syntheticTokenAddress: CONFIG.wbtc.synthetic,
    minBridgeAmt: CONFIG.wbtc.minBridge,
  }];
  
  const lzOptions = ethers.utils.solidityPack(["uint16","uint8","uint16","uint8","uint128"], [3, 1, 17, 1, 500000]);
  const fee = await gateway.quoteLinkTokenToHub(tokensConfig, lzOptions);
  
  const tx = await gateway.linkTokenToHub(tokensConfig, lzOptions, { value: fee.mul(150).div(100) });
  console.log(`Link TX: ${tx.hash}`);
  await tx.wait();
  console.log("✅ Link sent!");
  
  console.log("\n========================================");
  console.log("New WBTC Gateway: " + gateway.address);
  console.log("========================================");
  console.log("\nNow update Hub peer to this gateway:");
  console.log(`hub.setPeer(30110, ${ethers.utils.hexZeroPad(gateway.address, 32)})`);
}

main().catch(console.error);
