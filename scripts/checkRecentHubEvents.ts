import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const USER = "0x4151E05ABe56192e2A6775612C2020509Fd50637";
const SUSDC = "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B";
const SONIC_RPC = "https://rpc.soniclabs.com";

async function main() {
  console.log("=== CHECKING RECENT HUB EVENTS ===\n");
  
  const provider = new ethers.providers.JsonRpcProvider(SONIC_RPC);
  
  // Get current block
  const currentBlock = await provider.getBlockNumber();
  console.log(`Current block: ${currentBlock}`);
  
  // Hub ABI for events
  const hubAbi = [
    "event MessageReceived(bytes32 guid, address from, address to, tuple(address tokenAddress, uint256 tokenAmount)[] assets, uint32 srcEid)",
    "event TokenMinted(uint256 indexed tokenIndex, address recipient, uint256 amount, uint32 sourceEid)",
  ];
  
  const hub = new ethers.Contract(HUB, hubAbi, provider);
  
  // Check last 1000 blocks for MessageReceived events
  console.log("\n--- MessageReceived Events (last 1000 blocks) ---");
  try {
    const filter = hub.filters.MessageReceived();
    const events = await hub.queryFilter(filter, currentBlock - 1000, currentBlock);
    
    if (events.length === 0) {
      console.log("No MessageReceived events in last 1000 blocks");
    } else {
      console.log(`Found ${events.length} events:`);
      for (const event of events.slice(-5)) { // Show last 5
        console.log(`\n  Block: ${event.blockNumber}`);
        console.log(`  TX: ${event.transactionHash}`);
        console.log(`  GUID: ${event.args?.guid}`);
        console.log(`  From: ${event.args?.from}`);
        console.log(`  To: ${event.args?.to}`);
        console.log(`  SrcEid: ${event.args?.srcEid}`);
      }
    }
  } catch (e: any) {
    console.log(`Error querying events: ${e.message?.slice(0, 100)}`);
  }
  
  // Check sUSDC Transfer events to user
  console.log("\n\n--- sUSDC Transfer Events to User (last 2000 blocks) ---");
  const erc20Abi = [
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "function decimals() view returns (uint8)",
  ];
  
  const sUSDC = new ethers.Contract(SUSDC, erc20Abi, provider);
  
  try {
    const filter = sUSDC.filters.Transfer(null, USER);
    const events = await sUSDC.queryFilter(filter, currentBlock - 2000, currentBlock);
    
    if (events.length === 0) {
      console.log("No sUSDC transfers to user in last 2000 blocks");
    } else {
      console.log(`Found ${events.length} transfers to user:`);
      for (const event of events) {
        const block = await event.getBlock();
        console.log(`\n  Block: ${event.blockNumber}`);
        console.log(`  TX: ${event.transactionHash}`);
        console.log(`  Time: ${new Date(block.timestamp * 1000).toISOString()}`);
        console.log(`  From: ${event.args?.from}`);
        console.log(`  Amount: ${ethers.utils.formatUnits(event.args?.value || 0, 6)} sUSDC`);
      }
    }
  } catch (e: any) {
    console.log(`Error querying sUSDC transfers: ${e.message?.slice(0, 100)}`);
  }
  
  // Check if there are any recent transactions TO the hub
  console.log("\n\n--- Recent Transactions to Hub ---");
  console.log("Check https://sonicscan.org/address/0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd");
  
  // Check LZ endpoint events
  console.log("\n\n--- LZ Endpoint PacketReceived Events ---");
  const lzEndpoint = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
  const lzAbi = [
    "event PacketReceived(bytes32 guid, uint32 srcEid, address receiver)",
  ];
  const lz = new ethers.Contract(lzEndpoint, lzAbi, provider);
  
  try {
    const filter = lz.filters.PacketReceived(null, null, HUB);
    const events = await lz.queryFilter(filter, currentBlock - 1000, currentBlock);
    
    if (events.length === 0) {
      console.log("No PacketReceived events for Hub in last 1000 blocks");
    } else {
      console.log(`Found ${events.length} packets received by Hub:`);
      for (const event of events.slice(-5)) {
        const block = await event.getBlock();
        console.log(`\n  Block: ${event.blockNumber}`);
        console.log(`  TX: ${event.transactionHash}`);
        console.log(`  Time: ${new Date(block.timestamp * 1000).toISOString()}`);
        console.log(`  GUID: ${event.args?.guid}`);
        console.log(`  SrcEid: ${event.args?.srcEid}`);
      }
    }
  } catch (e: any) {
    console.log(`Error querying LZ events: ${e.message?.slice(0, 100)}`);
  }
}

main().catch(console.error);


