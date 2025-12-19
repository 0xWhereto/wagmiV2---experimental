import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

// WBTC on different chains
const WBTC_ARBITRUM = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
const WBTC_ETHEREUM = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";

const ARBITRUM_EID = 30110;
const ETHEREUM_EID = 30101;

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Checking WBTC Links on Sonic Hub ===\n");
  
  // Read Hub storage directly to check the mappings
  const provider = ethers.provider;
  
  // First let's just try to call getSyntheticToken with low-level call
  const hub = new ethers.Contract(
    HUB_ADDRESS,
    [
      "function getSyntheticToken(uint32 srcEid, address remoteToken) view returns (address)",
      "function owner() view returns (address)"
    ],
    signer
  );

  // Check owner to verify Hub is responsive
  try {
    const owner = await hub.owner();
    console.log(`Hub owner: ${owner}`);
  } catch (e: any) {
    console.log(`Hub owner check failed: ${e.message?.slice(0, 80)}`);
  }

  // Try to get synthetic token for WBTC from Arbitrum
  console.log("\n=== Checking getSyntheticToken ===");
  
  // Encode the call manually
  const iface = new ethers.utils.Interface([
    "function getSyntheticToken(uint32 srcEid, address remoteToken) view returns (address)"
  ]);

  const calldata = iface.encodeFunctionData("getSyntheticToken", [ARBITRUM_EID, WBTC_ARBITRUM]);
  console.log(`Calldata: ${calldata}`);

  try {
    const result = await provider.call({
      to: HUB_ADDRESS,
      data: calldata
    });
    console.log(`Raw result: ${result}`);
    
    if (result !== "0x") {
      const decoded = iface.decodeFunctionResult("getSyntheticToken", result);
      console.log(`Decoded synthetic token: ${decoded[0]}`);
      
      if (decoded[0] === ethers.constants.AddressZero) {
        console.log("\n❌ Hub does NOT know about WBTC from Arbitrum");
        console.log("Need to send LinkToken message from Gateway to Hub");
      } else {
        console.log("\n✅ Hub knows WBTC! Synthetic:", decoded[0]);
      }
    }
  } catch (e: any) {
    console.log(`getSyntheticToken call failed: ${e.message?.slice(0, 100)}`);
  }

  // Also check from Ethereum
  console.log("\n=== Checking WBTC from Ethereum ===");
  const calldata2 = iface.encodeFunctionData("getSyntheticToken", [ETHEREUM_EID, WBTC_ETHEREUM]);
  try {
    const result = await provider.call({
      to: HUB_ADDRESS,
      data: calldata2
    });
    if (result !== "0x" && result.length > 2) {
      const decoded = iface.decodeFunctionResult("getSyntheticToken", result);
      console.log(`WBTC (Ethereum) -> Synthetic: ${decoded[0]}`);
    } else {
      console.log("No result or empty");
    }
  } catch (e: any) {
    console.log(`Error: ${e.message?.slice(0, 80)}`);
  }

  // Check what functions the Hub has
  console.log("\n=== Hub Bytecode Check ===");
  const code = await provider.getCode(HUB_ADDRESS);
  console.log(`Hub has code: ${code.length > 2 ? "YES" : "NO"}`);
  console.log(`Code length: ${code.length / 2 - 1} bytes`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

