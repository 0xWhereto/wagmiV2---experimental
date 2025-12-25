import { ethers } from "hardhat";

// The blocked TX from UI
const BLOCKED_TX = "0x352e2a5aa0e1f7b02f2342c0d679da0a6a75c3a2e0073d448134eefae7ccb814";

const ARB_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const LZ_ENDPOINT_ARB = "0x1a44076050125825900e736c501f859c50fE728c";
const SONIC_EID = 30332;

async function main() {
  console.log("=== DECODING BLOCKED TX ===\n");
  
  const arbProvider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  // Get the TX
  const tx = await arbProvider.getTransaction(BLOCKED_TX);
  const receipt = await arbProvider.getTransactionReceipt(BLOCKED_TX);
  
  console.log("1. TRANSACTION DETAILS:");
  console.log(`   Hash: ${tx?.hash}`);
  console.log(`   Block: ${tx?.blockNumber}`);
  console.log(`   From: ${tx?.from}`);
  console.log(`   To: ${tx?.to}`);
  console.log(`   Value: ${ethers.utils.formatEther(tx?.value || 0)} ETH`);
  console.log(`   Status: ${receipt?.status === 1 ? "✅ Success" : "❌ Failed"}`);
  
  // Check if it went to our gateway
  console.log(`\n   Expected Gateway: ${ARB_GATEWAY}`);
  console.log(`   TX Target: ${tx?.to}`);
  console.log(`   Match: ${tx?.to?.toLowerCase() === ARB_GATEWAY.toLowerCase()}`);
  
  // Decode the function call
  console.log("\n\n2. FUNCTION CALL:");
  const gatewayIface = new ethers.utils.Interface([
    "function deposit(address _recepient, tuple(address tokenAddress, uint256 tokenAmount)[] _assets, bytes _options) payable",
  ]);
  
  try {
    const decoded = gatewayIface.parseTransaction({ data: tx?.data || "0x", value: tx?.value });
    console.log(`   Function: ${decoded.name}`);
    console.log(`   Recipient: ${decoded.args._recepient}`);
    console.log(`   Assets: ${JSON.stringify(decoded.args._assets.map((a: any) => ({
      token: a.tokenAddress,
      amount: ethers.utils.formatEther(a.tokenAmount)
    })))}`);
    console.log(`   Options: ${decoded.args._options}`);
    
    // Decode options
    const options = decoded.args._options as string;
    console.log(`\n   Options breakdown:`);
    console.log(`      Raw: ${options}`);
    console.log(`      Length: ${(options.length - 2) / 2} bytes`);
    
    // Expected format: 0x + uint16 optionType + uint8 version + uint16 length + uint8 executorType + uint128 gas
    if (options.length >= 42) {
      const optionType = parseInt(options.slice(2, 6), 16);
      const version = parseInt(options.slice(6, 8), 16);
      const optionLength = parseInt(options.slice(8, 12), 16);
      const executorType = parseInt(options.slice(12, 14), 16);
      const gasLimit = BigInt("0x" + options.slice(14, 46));
      
      console.log(`      optionType: ${optionType}`);
      console.log(`      version: ${version}`);
      console.log(`      optionLength: ${optionLength}`);
      console.log(`      executorType: ${executorType}`);
      console.log(`      gasLimit: ${gasLimit}`);
    }
    
  } catch (e: any) {
    console.log(`   Failed to decode: ${e.message}`);
  }
  
  // Parse logs for PacketSent
  console.log("\n\n3. LAYERZERO PACKET SENT:");
  
  const packetSentTopic = ethers.utils.id("PacketSent(bytes,bytes,address)");
  const packetLog = receipt?.logs.find(l => l.topics[0] === packetSentTopic);
  
  if (packetLog) {
    console.log(`   PacketSent event found`);
    console.log(`   Address (send lib): ${packetLog.address}`);
    
    // Check if this is our expected send library
    const expectedSendLib = "0x975bcD720be66659e3EB3C0e4F1866a3020E493A";
    console.log(`   Expected send lib: ${expectedSendLib}`);
    console.log(`   Match: ${packetLog.address.toLowerCase() === expectedSendLib.toLowerCase()}`);
    
  } else {
    console.log(`   No PacketSent event found!`);
  }
  
  // Check current Gateway send config
  console.log("\n\n4. CURRENT GATEWAY CONFIG:");
  
  const endpointAbi = [
    "function getSendLibrary(address _sender, uint32 _dstEid) view returns (address)",
  ];
  
  const ulnAbi = [
    "function getUlnConfig(address _oapp, uint32 _remoteEid) view returns (tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs))",
    "function getExecutorConfig(address _oapp, uint32 _remoteEid) view returns (tuple(uint32 maxMessageSize, address executor))",
  ];
  
  const endpoint = new ethers.Contract(LZ_ENDPOINT_ARB, endpointAbi, arbProvider);
  const sendLib = await endpoint.getSendLibrary(ARB_GATEWAY, SONIC_EID);
  console.log(`   Send library: ${sendLib}`);
  
  const uln = new ethers.Contract(sendLib, ulnAbi, arbProvider);
  const dvnConfig = await uln.getUlnConfig(ARB_GATEWAY, SONIC_EID);
  const execConfig = await uln.getExecutorConfig(ARB_GATEWAY, SONIC_EID);
  
  console.log(`   DVN: ${dvnConfig.requiredDVNs.join(", ")}`);
  console.log(`   Executor: ${execConfig.executor}`);
}

main().catch(console.error);


