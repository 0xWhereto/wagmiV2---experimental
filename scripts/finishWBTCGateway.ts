import { ethers } from "hardhat";

const NEW_WBTC_GATEWAY = "0xbA69c4938BE6bB8204415689d72af1324Cc5c3bA";
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
  console.log("=== FINISHING WBTC GATEWAY SETUP ===\n");
  
  const [signer] = await ethers.getSigners();
  const gateway = await ethers.getContractAt("GatewayVault", NEW_WBTC_GATEWAY);
  
  // Configure DVN with correct encoding
  const endpointAbi = [
    "function setConfig(address oapp, address lib, tuple(uint32 eid, uint32 configType, bytes config)[] params)",
    "function getSendLibrary(address sender, uint32 eid) view returns (address)",
  ];
  const endpoint = new ethers.Contract(CONFIG.endpoint, endpointAbi, signer);
  const sendLib = await endpoint.getSendLibrary(gateway.address, CONFIG.sonicEid);
  console.log(`Send library: ${sendLib}`);
  
  // Proper encoding
  const ulnConfig = ethers.utils.defaultAbiCoder.encode(
    ["tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)"],
    [[15, 1, 0, 0, [CONFIG.dvn], []]]
  );
  
  const executorConfig = ethers.utils.defaultAbiCoder.encode(
    ["tuple(uint32 maxMessageSize, address executor)"],
    [[10000, CONFIG.executor]]
  );
  
  console.log("Setting DVN config...");
  const tx1 = await endpoint.setConfig(gateway.address, sendLib, [
    { eid: CONFIG.sonicEid, configType: 2, config: ulnConfig },
    { eid: CONFIG.sonicEid, configType: 1, config: executorConfig },
  ]);
  await tx1.wait();
  console.log("✅ DVN configured");
  
  // Link WBTC
  console.log("\nLinking WBTC...");
  const tokensConfig = [{
    onPause: false,
    tokenAddress: CONFIG.wbtc.address,
    syntheticTokenDecimals: CONFIG.wbtc.syntheticDecimals,
    syntheticTokenAddress: CONFIG.wbtc.synthetic,
    minBridgeAmt: CONFIG.wbtc.minBridge,
  }];
  
  const lzOptions = ethers.utils.solidityPack(
    ["uint16", "uint8", "uint16", "uint8", "uint128"],
    [3, 1, 17, 1, 500000]
  );
  
  const fee = await gateway.quoteLinkTokenToHub(tokensConfig, lzOptions);
  console.log(`Fee: ${ethers.utils.formatEther(fee)} ETH`);
  
  const tx2 = await gateway.linkTokenToHub(tokensConfig, lzOptions, { value: fee.mul(150).div(100) });
  console.log(`Link TX: ${tx2.hash}`);
  await tx2.wait();
  console.log("✅ Link sent!");
  
  console.log("\n========================================");
  console.log("WBTC Gateway: " + NEW_WBTC_GATEWAY);
  console.log("========================================");
}

main().catch(console.error);
