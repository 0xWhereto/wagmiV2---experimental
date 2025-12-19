import { ethers } from "hardhat";

const LZ_ENDPOINT_SONIC = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const ARB_EID = 30110;
const ARB_GATEWAY = "0x527f843672C4CD7F45B126f3E1E82D60A741C609";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=== CHECKING MESSAGE STATUS ON SONIC ===\n");
  
  // Check if there are pending messages
  const endpointAbi = [
    "function inboundNonce(address _receiver, uint32 _srcEid, bytes32 _sender) view returns (uint64)",
    "function lazyInboundNonce(address _receiver, uint32 _srcEid, bytes32 _sender) view returns (uint64)",
  ];
  
  const endpoint = new ethers.Contract(LZ_ENDPOINT_SONIC, endpointAbi, deployer);
  
  const senderBytes32 = ethers.utils.hexZeroPad(ARB_GATEWAY, 32);
  
  try {
    const inboundNonce = await endpoint.inboundNonce(HUB, ARB_EID, senderBytes32);
    console.log(`Inbound nonce (received): ${inboundNonce}`);
    
    const lazyNonce = await endpoint.lazyInboundNonce(HUB, ARB_EID, senderBytes32);
    console.log(`Lazy inbound nonce (pending): ${lazyNonce}`);
    
    if (lazyNonce.gt(inboundNonce)) {
      console.log(`\n⚠️ There are ${lazyNonce.sub(inboundNonce).toString()} pending messages!`);
      console.log("These messages are verified but not yet executed.");
    }
  } catch (e: any) {
    console.log(`Error: ${e.message?.substring(0, 100)}`);
  }
  
  // Check the receive library executor config
  console.log("\n=== RECEIVE LIBRARY EXECUTOR CONFIG ===");
  
  const receiveLibAbi = [
    "function getExecutorConfig(address _oapp, uint32 _remoteEid) view returns (tuple(uint32 maxMessageSize, address executor))",
  ];
  
  const receiveLib = "0xe1844c5D63a9543023008D332Bd3d2e6f1FE1043";
  const lib = new ethers.Contract(receiveLib, receiveLibAbi, deployer);
  
  try {
    const execConfig = await lib.getExecutorConfig(HUB, ARB_EID);
    console.log(`Executor on Sonic for Arbitrum messages: ${execConfig.executor}`);
  } catch (e: any) {
    console.log(`Error: ${e.message?.substring(0, 100)}`);
  }
}

main().catch(console.error);
