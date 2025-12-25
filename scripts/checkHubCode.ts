import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("Checking Hub contract...\n");
  
  const hubAddress = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
  
  // Get code
  const code = await signer.provider!.getCode(hubAddress);
  console.log(`Hub code length: ${code.length / 2 - 1} bytes`);
  console.log(`Code hash: ${ethers.utils.keccak256(code)}`);
  
  // Try to call a known function to verify contract
  const hub = await ethers.getContractAt("SyntheticTokenHub", hubAddress);
  
  console.log("\nTrying to call Hub functions:");
  try {
    const owner = await hub.owner();
    console.log(`  owner(): ${owner} ✓`);
  } catch (e) {
    console.log(`  owner(): FAILED`);
  }
  
  try {
    const endpoint = await hub.endpoint();
    console.log(`  endpoint(): ${endpoint} ✓`);
  } catch (e) {
    console.log(`  endpoint(): FAILED`);
  }
  
  // Check if manualLinkRemoteToken function exists by trying to encode it
  console.log("\nFunction selector for manualLinkRemoteToken:");
  const iface = new ethers.utils.Interface([
    "function manualLinkRemoteToken(address,uint32,address,address,int8,uint256)"
  ]);
  console.log(`  ${iface.getSighash("manualLinkRemoteToken")}`);
  
  // Let's also check the actual error by making a low-level call
  console.log("\nMaking low-level call to check error...");
  const calldata = hub.interface.encodeFunctionData("manualLinkRemoteToken", [
    "0x2F0324268031E6413280F3B5ddBc4A97639A284a",
    30101,
    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    "0xba36FC6568B953f691dd20754607590C59b7646a",
    0,
    10000
  ]);
  console.log(`Calldata: ${calldata.slice(0, 74)}...`);
  
  try {
    const result = await signer.provider!.call({
      to: hubAddress,
      data: calldata,
      from: signer.address
    });
    console.log("Call succeeded with result:", result);
  } catch (e: any) {
    console.log("Call failed:");
    console.log("  Reason:", e.reason);
    console.log("  Code:", e.code);
    if (e.error?.data) {
      console.log("  Error data:", e.error.data);
      // Try to decode error
      try {
        const decoded = hub.interface.parseError(e.error.data);
        console.log("  Decoded error:", decoded);
      } catch {}
    }
  }
}

main();


