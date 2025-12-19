import hardhat, { ethers } from "hardhat";

/**
 * Configure OApp settings for GatewayVault contracts
 * This sets up the send/receive libraries and DVN configurations required by LayerZero V2
 */

// LayerZero V2 Endpoint addresses (same on all chains)
const LZ_ENDPOINT = "0x1a44076050125825900e736c501f859c50fE728c";

// Chain-specific configurations
const CONFIG: Record<string, {
  gatewayVault: string;
  dstEid: number; // Sonic EID
  sendLib: string;
  receiveLib: string;
  dvn: string;
  executor: string;
}> = {
  arbitrum: {
    gatewayVault: "0xb867d9E9D374E8b1165bcDF6D3f66d1A9AAd2447",
    dstEid: 30332, // Sonic
    sendLib: "0x975bcD720be66659e3EB3C0e4F1866a3020E493A",
    receiveLib: "0x7B9E184e07a6EE1aC23eAe0fe8D6Be2f663f05e6",
    dvn: "0x2f55c492897526677c5b68fb199ea31e2c126416", // LayerZero Labs DVN
    executor: "0x31CAe3B7fB82d847621859fb1585353c5720660D",
  },
  base: {
    gatewayVault: "0xb867d9E9D374E8b1165bcDF6D3f66d1A9AAd2447",
    dstEid: 30332,
    sendLib: "0xB5320B0B3a13cC860893E2Bd79FCd7e13484Dda2",
    receiveLib: "0xc70AB6f32772f59fBfc23889Caf4Ba3376C84bAf",
    dvn: "0x9e059a54699a285714207b43b055483e78faac25",
    executor: "0x2CCA08ae69E0C44b18a57Ab2A87644234dAebaE4",
  },
  ethereum: {
    gatewayVault: "0xc792AB26B1f1670B2f5081F8d74bD6a451aD6b44",
    dstEid: 30332,
    sendLib: "0xbB2Ea70C9E858123480642Cf96acbcCE1372dCe1",
    receiveLib: "0xc02Ab410f0734EFa3F14628780e6e695156024C2",
    dvn: "0x589dedbd617e0cbcb916a9223f4d1300c294236b", // LayerZero Labs DVN on ETH
    executor: "0x173272739Bd7Aa6e4e214714048a9fE699453059",
  },
};

// EVM ULN Config struct
interface UlnConfig {
  confirmations: bigint;
  requiredDVNCount: number;
  optionalDVNCount: number;
  optionalDVNThreshold: number;
  requiredDVNs: string[];
  optionalDVNs: string[];
}

// Endpoint ABI (partial - just the functions we need)
const ENDPOINT_ABI = [
  "function setSendLibrary(address oapp, uint32 eid, address sendLib) external",
  "function setReceiveLibrary(address oapp, uint32 eid, address receiveLib, uint256 gracePeriod) external",
  "function setConfig(address oapp, address lib, tuple(uint32 eid, uint32 configType, bytes config)[] params) external",
  "function getSendLibrary(address oapp, uint32 eid) external view returns (address)",
  "function getReceiveLibrary(address oapp, uint32 eid) external view returns (address)",
  "function isRegisteredLibrary(address lib) external view returns (bool)",
  "function defaultSendLibrary(uint32 eid) external view returns (address)",
  "function defaultReceiveLibrary(uint32 eid) external view returns (address)",
];

// MessageLib ABI for setConfig
const MESSAGELIB_ABI = [
  "function setConfig(address oapp, tuple(uint32 eid, uint32 configType, bytes config)[] params) external",
];

// ULN config type constants
const CONFIG_TYPE_ULN = 2; // ULN config type
const CONFIG_TYPE_EXECUTOR = 1; // Executor config type

function encodeUlnConfig(config: UlnConfig): string {
  const abiCoder = ethers.utils.defaultAbiCoder;
  return abiCoder.encode(
    ["tuple(uint64,uint8,uint8,uint8,address[],address[])"],
    [[
      config.confirmations,
      config.requiredDVNCount,
      config.optionalDVNCount,
      config.optionalDVNThreshold,
      config.requiredDVNs,
      config.optionalDVNs,
    ]]
  );
}

function encodeExecutorConfig(maxMessageSize: number, executor: string): string {
  const abiCoder = ethers.utils.defaultAbiCoder;
  return abiCoder.encode(
    ["tuple(uint32,address)"],
    [[maxMessageSize, executor]]
  );
}

async function main() {
  const network = hardhat.network.name;
  
  if (!CONFIG[network]) {
    console.log(`Network ${network} not configured. Available: ${Object.keys(CONFIG).join(", ")}`);
    return;
  }

  const [deployer] = await ethers.getSigners();
  const config = CONFIG[network];

  console.log(`\n========================================`);
  console.log(`Configuring OApp on ${network.toUpperCase()}`);
  console.log(`========================================`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Gateway Vault: ${config.gatewayVault}`);
  console.log(`Destination EID (Sonic): ${config.dstEid}`);

  const endpoint = new ethers.Contract(LZ_ENDPOINT, ENDPOINT_ABI, deployer);

  // Check current configuration
  console.log("\n--- Current Configuration ---");
  try {
    const currentSendLib = await endpoint.getSendLibrary(config.gatewayVault, config.dstEid);
    console.log(`Current Send Library: ${currentSendLib}`);
    
    const defaultSendLib = await endpoint.defaultSendLibrary(config.dstEid);
    console.log(`Default Send Library: ${defaultSendLib}`);
    
    const currentReceiveLib = await endpoint.getReceiveLibrary(config.gatewayVault, config.dstEid);
    console.log(`Current Receive Library: ${currentReceiveLib}`);
    
    if (currentSendLib !== ethers.constants.AddressZero && currentSendLib !== config.sendLib) {
      console.log(`\n⚠️ Send library is already set to ${currentSendLib}`);
      console.log(`   Expected: ${config.sendLib}`);
    }
  } catch (e: any) {
    console.log(`Could not get current config: ${e.message?.slice(0, 100)}`);
  }

  // The Gateway owner needs to call endpoint.setSendLibrary
  // But actually, for delegate pattern, the OApp owner can call endpoint directly
  
  console.log("\n--- Setting Send Library ---");
  try {
    // Check if it's already set
    const currentSendLib = await endpoint.getSendLibrary(config.gatewayVault, config.dstEid);
    if (currentSendLib === config.sendLib) {
      console.log("✓ Send library already configured correctly");
    } else if (currentSendLib === ethers.constants.AddressZero) {
      console.log("Using default send library, no explicit config needed");
    } else {
      // Need to set it - but this requires the OApp owner to call
      // Actually, the OApp owner can call endpoint.setSendLibrary if they are the delegate
      console.log(`Setting send library to ${config.sendLib}...`);
      const tx = await endpoint.setSendLibrary(config.gatewayVault, config.dstEid, config.sendLib);
      await tx.wait();
      console.log("✓ Send library set");
    }
  } catch (e: any) {
    console.log(`Failed to set send library: ${e.message?.slice(0, 200)}`);
  }

  console.log("\n--- Setting Receive Library ---");
  try {
    const currentReceiveLib = await endpoint.getReceiveLibrary(config.gatewayVault, config.dstEid);
    if (currentReceiveLib === config.receiveLib) {
      console.log("✓ Receive library already configured correctly");
    } else if (currentReceiveLib === ethers.constants.AddressZero) {
      console.log("Using default receive library, setting explicitly...");
      const tx = await endpoint.setReceiveLibrary(config.gatewayVault, config.dstEid, config.receiveLib, 0);
      await tx.wait();
      console.log("✓ Receive library set");
    } else {
      console.log(`Setting receive library to ${config.receiveLib}...`);
      const tx = await endpoint.setReceiveLibrary(config.gatewayVault, config.dstEid, config.receiveLib, 0);
      await tx.wait();
      console.log("✓ Receive library set");
    }
  } catch (e: any) {
    console.log(`Failed to set receive library: ${e.message?.slice(0, 200)}`);
  }

  console.log("\n--- Setting ULN Config ---");
  try {
    const ulnConfig: UlnConfig = {
      confirmations: BigInt(20),
      requiredDVNCount: 1,
      optionalDVNCount: 0,
      optionalDVNThreshold: 0,
      requiredDVNs: [config.dvn],
      optionalDVNs: [],
    };
    
    const encodedUlnConfig = encodeUlnConfig(ulnConfig);
    const encodedExecutorConfig = encodeExecutorConfig(10000, config.executor);
    
    const sendLib = new ethers.Contract(config.sendLib, MESSAGELIB_ABI, deployer);
    
    console.log("Setting send config (ULN + Executor)...");
    const setConfigParams = [
      { eid: config.dstEid, configType: CONFIG_TYPE_EXECUTOR, config: encodedExecutorConfig },
      { eid: config.dstEid, configType: CONFIG_TYPE_ULN, config: encodedUlnConfig },
    ];
    
    const tx = await sendLib.setConfig(config.gatewayVault, setConfigParams);
    await tx.wait();
    console.log("✓ Send config set");
  } catch (e: any) {
    console.log(`Failed to set ULN config: ${e.message?.slice(0, 200)}`);
    console.log("This might require specific permissions or the endpoint interface might be different");
  }

  console.log("\n========================================");
  console.log("Configuration complete!");
  console.log("Now try running the linkTokens script again");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


