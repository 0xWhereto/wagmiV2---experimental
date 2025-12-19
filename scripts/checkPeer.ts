import { ethers } from "hardhat";

const GATEWAY_ARB = "0x527f843672C4CD7F45B126f3E1E82D60A741C609";
const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const HUB_EID = 30332;

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  const abi = [
    "function peers(uint32) view returns (bytes32)",
    "function DST_EID() view returns (uint32)",
  ];
  
  const gateway = new ethers.Contract(GATEWAY_ARB, abi, provider);
  
  console.log("Checking Arbitrum Gateway...");
  
  try {
    const dstEid = await gateway.DST_EID();
    console.log(`DST_EID: ${dstEid}`);
  } catch (e) {
    console.log("DST_EID not found");
  }
  
  try {
    const peer = await gateway.peers(HUB_EID);
    const expected = ethers.utils.hexZeroPad(HUB, 32);
    console.log(`Peer for ${HUB_EID}: ${peer}`);
    console.log(`Expected:         ${expected}`);
    console.log(`Match: ${peer.toLowerCase() === expected.toLowerCase()}`);
  } catch (e: any) {
    console.log(`Error: ${e.message?.substring(0, 50)}`);
  }
}

main().catch(console.error);
