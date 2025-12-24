import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const ARB_EID = 30110;
const SONIC_LZ_ENDPOINT = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
const SONIC_RECEIVE_LIB = "0xe1844c5D63a9543023008D332Bd3d2e6f1FE1043";

// The ARBITRUM DVN - this is what the Hub should expect for messages FROM Arbitrum
const ARB_LZ_DVN = ethers.utils.getAddress("0x2f55c492897526677c5b68fb199ea31e2c126416");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=== Fix Hub Receive DVN ===");
  console.log("Setting Hub to expect Arbitrum DVN:", ARB_LZ_DVN);
  
  const endpoint = await ethers.getContractAt(
    ["function setConfig(address oapp, address lib, tuple(uint32 eid, uint32 configType, bytes config)[] configs) external"],
    SONIC_LZ_ENDPOINT
  );
  
  // ULN Config expecting ARBITRUM DVN
  const ulnConfig = ethers.utils.defaultAbiCoder.encode(
    ['tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)'],
    [{
      confirmations: 1,
      requiredDVNCount: 1,
      optionalDVNCount: 0,
      optionalDVNThreshold: 0,
      requiredDVNs: [ARB_LZ_DVN],
      optionalDVNs: []
    }]
  );
  
  const configs = [{
    eid: ARB_EID,
    configType: 2,
    config: ulnConfig
  }];
  
  console.log("\nUpdating Hub receive config...");
  const tx = await endpoint.setConfig(HUB_ADDRESS, SONIC_RECEIVE_LIB, configs);
  console.log("TX:", tx.hash);
  await tx.wait();
  console.log("✓ Hub now expects Arbitrum DVN for messages from Arbitrum!");
  
  // Verify
  console.log("\nVerifying...");
  const endpointRead = await ethers.getContractAt(
    ["function getConfig(address oapp, address lib, uint32 eid, uint32 configType) external view returns (bytes memory config)"],
    SONIC_LZ_ENDPOINT
  );
  const config = await endpointRead.getConfig(HUB_ADDRESS, SONIC_RECEIVE_LIB, ARB_EID, 2);
  const decoded = ethers.utils.defaultAbiCoder.decode(
    ['tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)'],
    config
  );
  console.log("New requiredDVNs:", decoded[0].requiredDVNs);
}

main().catch(console.error);
