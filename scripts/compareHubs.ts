import { ethers } from "hardhat";

const OLD_HUB = "0x4208D6E27538189bB48E603D6123A94b8Abe0A0b";
const NEW_HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const LZ_ENDPOINT = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
const ARB_EID = 30110;

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=== COMPARING OLD vs NEW HUB LZ CONFIG ===\n");
  
  const endpointAbi = [
    "function getReceiveLibrary(address, uint32) view returns (address, bool)",
    "function getConfig(address, address, uint32, uint32) view returns (bytes)",
    "function delegates(address) view returns (address)",
  ];
  
  const endpoint = new ethers.Contract(LZ_ENDPOINT, endpointAbi, deployer);
  
  for (const [name, hub] of [["OLD", OLD_HUB], ["NEW", NEW_HUB]]) {
    console.log(`\n=== ${name} HUB: ${hub} ===`);
    
    // Check delegate
    try {
      const delegate = await endpoint.delegates(hub);
      console.log(`Delegate: ${delegate}`);
    } catch (e) {
      console.log("No delegate");
    }
    
    // Check receive library
    try {
      const [receiveLib, isDefault] = await endpoint.getReceiveLibrary(hub, ARB_EID);
      console.log(`Receive library: ${receiveLib} (default: ${isDefault})`);
      
      // DVN config
      const dvnConfig = await endpoint.getConfig(hub, receiveLib, ARB_EID, 2);
      const dvnDecoded = ethers.utils.defaultAbiCoder.decode(
        ["tuple(uint64, uint8, uint8, uint8, address[], address[])"],
        dvnConfig
      );
      console.log(`DVNs: ${dvnDecoded[0][4].join(", ")}`);
      console.log(`Confirmations: ${dvnDecoded[0][0]}`);
      
    } catch (e: any) {
      console.log(`Error getting receive config: ${e.message?.substring(0, 80)}`);
    }
    
    // Check inbound nonces
    console.log("\nInbound nonces from Arbitrum:");
    
    // Check with OLD Arb gateway
    const OLD_ARB_GW = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
    const NEW_ARB_GW = "0x527f843672C4CD7F45B126f3E1E82D60A741C609";
    
    const inboundAbi = [
      "function inboundNonce(address, uint32, bytes32) view returns (uint64)",
    ];
    const ep = new ethers.Contract(LZ_ENDPOINT, inboundAbi, deployer);
    
    for (const [gwName, gw] of [["OLD GW", OLD_ARB_GW], ["NEW GW", NEW_ARB_GW]]) {
      const senderBytes = ethers.utils.hexZeroPad(gw, 32);
      try {
        const nonce = await ep.inboundNonce(hub, ARB_EID, senderBytes);
        console.log(`  From ${gwName}: ${nonce}`);
      } catch (e) {
        console.log(`  From ${gwName}: error`);
      }
    }
  }
}

main().catch(console.error);
