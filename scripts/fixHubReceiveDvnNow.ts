import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const LZ_ENDPOINT_SONIC = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";

// The correct LZ Labs DVN on Sonic
// This corresponds to the LZ Labs DVN on Arbitrum (0x2f55C492897526677C5B68fb199ea31E2c126416)
const SONIC_LZ_LABS_DVN = "0x282b3386571f7f794450d5789911a9804fa346b4";

// Chain EIDs
const CHAIN_EIDS = {
  arbitrum: 30110,
  base: 30184,
  ethereum: 30101,
};

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=== FIXING HUB RECEIVE DVN CONFIG ===\n");
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Target DVN: ${SONIC_LZ_LABS_DVN}`);
  
  const endpointAbi = [
    "function getReceiveLibrary(address _receiver, uint32 _srcEid) external view returns (address, bool)",
    "function setConfig(address _oapp, address _lib, tuple(uint32 eid, uint32 configType, bytes config)[] _params) external",
    "function getConfig(address _oapp, address _lib, uint32 _eid, uint32 _configType) external view returns (bytes)",
  ];
  
  const ulnAbi = [
    "function getUlnConfig(address _oapp, uint32 _remoteEid) view returns (tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs))",
  ];
  
  const endpoint = new ethers.Contract(LZ_ENDPOINT_SONIC, endpointAbi, deployer);
  
  for (const [chain, eid] of Object.entries(CHAIN_EIDS)) {
    console.log(`\n${"=".repeat(50)}`);
    console.log(`${chain.toUpperCase()} (EID ${eid})`);
    console.log("=".repeat(50));
    
    // Get current receive library
    const [receiveLib, isDefault] = await endpoint.getReceiveLibrary(HUB, eid);
    console.log(`Receive library: ${receiveLib}`);
    
    // Get current DVN config
    const uln = new ethers.Contract(receiveLib, ulnAbi, deployer);
    
    try {
      const currentConfig = await uln.getUlnConfig(HUB, eid);
      console.log(`Current DVNs: ${currentConfig.requiredDVNs.join(", ")}`);
      console.log(`Current confirmations: ${currentConfig.confirmations}`);
      
      // Check if update needed
      const currentDvn = currentConfig.requiredDVNs[0]?.toLowerCase();
      const targetDvn = SONIC_LZ_LABS_DVN.toLowerCase();
      
      if (currentDvn === targetDvn) {
        console.log(`✅ Already using correct DVN`);
        continue;
      }
      
      console.log(`\n⚠️ DVN mismatch!`);
      console.log(`   Current: ${currentDvn}`);
      console.log(`   Target:  ${targetDvn}`);
      
      // Build new config
      const newConfig = ethers.utils.defaultAbiCoder.encode(
        ["tuple(uint64, uint8, uint8, uint8, address[], address[])"],
        [[
          20, // confirmations (match what gateway uses)
          1,  // requiredDVNCount
          0,  // optionalDVNCount
          0,  // optionalDVNThreshold
          [SONIC_LZ_LABS_DVN], // requiredDVNs
          [], // optionalDVNs
        ]]
      );
      
      console.log(`\nUpdating to use LZ Labs DVN...`);
      const tx = await endpoint.setConfig(HUB, receiveLib, [
        { eid: eid, configType: 2, config: newConfig }
      ], { gasLimit: 300000 });
      console.log(`TX: ${tx.hash}`);
      await tx.wait();
      console.log(`✅ Updated!`);
      
      // Verify
      const newConfigCheck = await uln.getUlnConfig(HUB, eid);
      console.log(`New DVNs: ${newConfigCheck.requiredDVNs.join(", ")}`);
      
    } catch (e: any) {
      console.log(`Error: ${e.message?.substring(0, 150)}`);
    }
  }
  
  console.log("\n\n" + "=".repeat(50));
  console.log("DONE! Pending messages should now be verified and delivered.");
  console.log("=".repeat(50));
}

main().catch(console.error);

