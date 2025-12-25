import { ethers } from "hardhat";
import hardhat from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const ARB_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";

const LZ_ENDPOINT_SONIC = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
const LZ_ENDPOINT_ARB = "0x1a44076050125825900e736c501f859c50fE728c";

const SONIC_EID = 30332;
const ARB_EID = 30110;

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = hardhat.network.name;
  
  console.log("=== FIXING DVN TO USE DEFAULT ===\n");
  console.log(`Network: ${network}`);
  console.log(`Deployer: ${deployer.address}`);
  
  const endpointAbi = [
    "function getSendLibrary(address _sender, uint32 _dstEid) view returns (address)",
    "function getReceiveLibrary(address _receiver, uint32 _srcEid) view returns (address, bool)",
    "function defaultSendLibrary(uint32 _dstEid) view returns (address)",
    "function defaultReceiveLibrary(uint32 _srcEid) view returns (address)",
    "function setConfig(address _oapp, address _lib, tuple(uint32 eid, uint32 configType, bytes config)[] _params) external",
  ];
  
  const ulnAbi = [
    "function getUlnConfig(address _oapp, uint32 _remoteEid) view returns (tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs))",
  ];
  
  if (network === "sonic") {
    // Fix Hub receive config to use default DVN
    console.log("\n=== FIXING HUB RECEIVE CONFIG ON SONIC ===");
    
    const endpoint = new ethers.Contract(LZ_ENDPOINT_SONIC, endpointAbi, deployer);
    
    // Get default receive config for Arbitrum
    const defaultReceiveLib = await endpoint.defaultReceiveLibrary(ARB_EID);
    console.log(`Default receive lib: ${defaultReceiveLib}`);
    
    const defaultUln = new ethers.Contract(defaultReceiveLib, ulnAbi, deployer);
    const defaultConfig = await defaultUln.getUlnConfig(ethers.constants.AddressZero, ARB_EID);
    console.log(`Default DVN: ${defaultConfig.requiredDVNs[0]}`);
    
    // Get current Hub config
    const [hubReceiveLib] = await endpoint.getReceiveLibrary(HUB, ARB_EID);
    const hubUln = new ethers.Contract(hubReceiveLib, ulnAbi, deployer);
    const hubConfig = await hubUln.getUlnConfig(HUB, ARB_EID);
    console.log(`Hub current DVN: ${hubConfig.requiredDVNs[0]}`);
    
    if (hubConfig.requiredDVNs[0].toLowerCase() !== defaultConfig.requiredDVNs[0].toLowerCase()) {
      console.log(`\n⚠️ Mismatch! Updating Hub to use default DVN...`);
      
      // Build new config with default DVN
      const newConfig = ethers.utils.defaultAbiCoder.encode(
        ["tuple(uint64, uint8, uint8, uint8, address[], address[])"],
        [[
          defaultConfig.confirmations, // use default confirmations
          defaultConfig.requiredDVNCount,
          defaultConfig.optionalDVNCount,
          defaultConfig.optionalDVNThreshold,
          defaultConfig.requiredDVNs, // use default DVNs
          defaultConfig.optionalDVNs,
        ]]
      );
      
      const tx = await endpoint.setConfig(HUB, hubReceiveLib, [
        { eid: ARB_EID, configType: 2, config: newConfig }
      ], { gasLimit: 300000 });
      console.log(`TX: ${tx.hash}`);
      await tx.wait();
      console.log(`✅ Hub receive config updated to use default DVN!`);
    } else {
      console.log(`✅ Hub already using default DVN`);
    }
    
  } else if (network === "arbitrum") {
    // Fix Gateway send config to use default DVN
    console.log("\n=== FIXING GATEWAY SEND CONFIG ON ARBITRUM ===");
    
    const endpoint = new ethers.Contract(LZ_ENDPOINT_ARB, endpointAbi, deployer);
    
    // Get default send config for Sonic
    const defaultSendLib = await endpoint.defaultSendLibrary(SONIC_EID);
    console.log(`Default send lib: ${defaultSendLib}`);
    
    const defaultUln = new ethers.Contract(defaultSendLib, ulnAbi, deployer);
    const defaultConfig = await defaultUln.getUlnConfig(ethers.constants.AddressZero, SONIC_EID);
    console.log(`Default DVN: ${defaultConfig.requiredDVNs[0]}`);
    
    // Get current Gateway config
    const gatewaySendLib = await endpoint.getSendLibrary(ARB_GATEWAY, SONIC_EID);
    const gatewayUln = new ethers.Contract(gatewaySendLib, ulnAbi, deployer);
    const gatewayConfig = await gatewayUln.getUlnConfig(ARB_GATEWAY, SONIC_EID);
    console.log(`Gateway current DVN: ${gatewayConfig.requiredDVNs[0]}`);
    
    if (gatewayConfig.requiredDVNs[0].toLowerCase() !== defaultConfig.requiredDVNs[0].toLowerCase()) {
      console.log(`\n⚠️ Mismatch! Updating Gateway to use default DVN...`);
      
      // Build new config with default DVN
      const newConfig = ethers.utils.defaultAbiCoder.encode(
        ["tuple(uint64, uint8, uint8, uint8, address[], address[])"],
        [[
          defaultConfig.confirmations,
          defaultConfig.requiredDVNCount,
          defaultConfig.optionalDVNCount,
          defaultConfig.optionalDVNThreshold,
          defaultConfig.requiredDVNs,
          defaultConfig.optionalDVNs,
        ]]
      );
      
      const tx = await endpoint.setConfig(ARB_GATEWAY, gatewaySendLib, [
        { eid: SONIC_EID, configType: 2, config: newConfig }
      ], { gasLimit: 300000 });
      console.log(`TX: ${tx.hash}`);
      await tx.wait();
      console.log(`✅ Gateway send config updated to use default DVN!`);
    } else {
      console.log(`✅ Gateway already using default DVN`);
    }
  }
}

main().catch(console.error);


