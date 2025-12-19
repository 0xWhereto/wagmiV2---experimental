import { ethers } from "hardhat";

const LZ_ENDPOINT_SONIC = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
const ARB_EID = 30110;

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=== FINDING SONIC EXECUTOR ===\n");
  
  const endpointAbi = [
    "function defaultReceiveLibrary(uint32) view returns (address)",
    "function getConfig(address, address, uint32, uint32) view returns (bytes)",
  ];
  
  const endpoint = new ethers.Contract(LZ_ENDPOINT_SONIC, endpointAbi, deployer);
  
  // Get default receive library
  const defaultLib = await endpoint.defaultReceiveLibrary(ARB_EID);
  console.log(`Default receive library: ${defaultLib}`);
  
  // Get executor config from default library (for any OApp)
  try {
    // Config type 1 = executor
    const execConfig = await endpoint.getConfig(ethers.constants.AddressZero, defaultLib, ARB_EID, 1);
    console.log(`\nDefault executor config: ${execConfig}`);
    
    const decoded = ethers.utils.defaultAbiCoder.decode(
      ["tuple(uint32 maxMessageSize, address executor)"],
      execConfig
    );
    console.log(`Executor address: ${decoded[0].executor}`);
    console.log(`Max message size: ${decoded[0].maxMessageSize}`);
    
    // Check balance
    const balance = await deployer.provider!.getBalance(decoded[0].executor);
    console.log(`\nExecutor balance: ${ethers.utils.formatEther(balance)} S`);
    
    if (balance.lt(ethers.utils.parseEther("1"))) {
      console.log("\n⚠️ Executor might need more S to pay for gas!");
      console.log("However, LayerZero executors are usually funded by LayerZero Labs.");
    }
    
  } catch (e: any) {
    console.log(`Error: ${e.message?.substring(0, 100)}`);
  }
  
  // Let's also check the SendLib302 and ReceiveLib302 which have executor addresses
  console.log("\n=== CHECKING KNOWN LZ INFRASTRUCTURE ===");
  
  // LayerZero typically deploys these
  const potentialExecutors = [
    { name: "LZ Executor V2", address: "0x2CCA08ae69E0C44b18a57Ab2A87644234dAebaE4" },
  ];
  
  for (const pe of potentialExecutors) {
    try {
      const balance = await deployer.provider!.getBalance(pe.address);
      const code = await deployer.provider!.getCode(pe.address);
      console.log(`${pe.name}: ${pe.address}`);
      console.log(`  Balance: ${ethers.utils.formatEther(balance)} S`);
      console.log(`  Has code: ${code.length > 2}`);
    } catch (e) {
      console.log(`${pe.name}: Error checking`);
    }
  }
}

main().catch(console.error);
