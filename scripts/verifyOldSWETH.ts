import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const OLD_SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";

async function main() {
  const provider = ethers.provider;
  
  console.log("=== Verifying OLD sWETH Configuration ===\n");

  const sweth = await ethers.getContractAt(
    [
      "function owner() view returns (address)",
      "function name() view returns (string)",
      "function symbol() view returns (string)",
      "function decimals() view returns (uint8)",
      "function totalSupply() view returns (uint256)",
      "function balanceOf(address) view returns (uint256)"
    ],
    OLD_SWETH
  );

  const name = await sweth.name();
  const symbol = await sweth.symbol();
  const decimals = await sweth.decimals();
  const owner = await sweth.owner();
  const totalSupply = await sweth.totalSupply();

  console.log(`Token: ${name} (${symbol})`);
  console.log(`Decimals: ${decimals}`);
  console.log(`Owner: ${owner}`);
  console.log(`Total Supply: ${ethers.utils.formatEther(totalSupply)}`);
  
  if (owner.toLowerCase() === HUB_ADDRESS.toLowerCase()) {
    console.log("✅ Owner is the Hub - Hub can mint this token");
  } else {
    console.log("❌ Owner is NOT the Hub!");
    console.log(`   Expected: ${HUB_ADDRESS}`);
    console.log(`   Actual: ${owner}`);
  }

  // Check the remoteTokenInfo for Arbitrum
  console.log("\n=== Checking Remote Token Info via Hub Getters ===");
  
  const HUB_GETTERS = "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e";
  const ARBITRUM_EID = 30110;
  
  // Read getRemoteTokenInfo using raw call
  const selector = ethers.utils.id("getRemoteTokenInfo(address,uint32)").slice(0, 10);
  const params = ethers.utils.defaultAbiCoder.encode(
    ["address", "uint32"],
    [OLD_SWETH, ARBITRUM_EID]
  );
  
  try {
    const result = await provider.call({
      to: HUB_GETTERS,
      data: selector + params.slice(2)
    });
    
    console.log(`Raw result (${result.length} chars): ${result.slice(0, 200)}...`);
    
    if (result && result.length >= 322) {
      // Decode the tuple
      const decoded = ethers.utils.defaultAbiCoder.decode(
        ["address", "int8", "bool", "uint256", "uint256"],
        result
      );
      console.log(`\nDecoded RemoteTokenInfo for Arbitrum:`);
      console.log(`  Remote Address: ${decoded[0]}`);
      console.log(`  Decimals Delta: ${decoded[1]}`);
      console.log(`  Paused: ${decoded[2]}`);
      console.log(`  Total Balance: ${ethers.utils.formatEther(decoded[3])}`);
      console.log(`  Min Bridge Amount: ${decoded[4]}`);
      
      if (decoded[2] === true) {
        console.log("\n⚠️ WARNING: This token is PAUSED! Deposits will fail!");
      }
    }
  } catch (e: any) {
    console.log(`Error reading remote info: ${e.message?.slice(0, 200)}`);
  }

  // Let's also verify the _lzReceive flow
  console.log("\n=== Checking _processDepositMessage Requirements ===");
  console.log("For a deposit to succeed, the Hub needs:");
  console.log("1. _syntheticAddressByRemoteAddress[srcEid][tokenAddress] != address(0)");
  console.log("2. The synthetic token owner == Hub (so Hub can mint)");
  
  // Check requirement 1
  const WETH_ARBITRUM = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
  const innerKey = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["uint32", "uint256"], [ARBITRUM_EID, 8])
  );
  const outerKey = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["address", "bytes32"], [WETH_ARBITRUM, innerKey])
  );
  const mappingValue = await provider.getStorageAt(HUB_ADDRESS, outerKey);
  const syntheticAddr = "0x" + mappingValue.slice(26, 66);
  
  console.log(`\n_syntheticAddressByRemoteAddress[${ARBITRUM_EID}][${WETH_ARBITRUM}]`);
  console.log(`  = ${syntheticAddr}`);
  
  if (syntheticAddr.toLowerCase() === OLD_SWETH.toLowerCase()) {
    console.log("  ✅ Points to OLD sWETH correctly!");
  } else if (syntheticAddr === "0x0000000000000000000000000000000000000000") {
    console.log("  ❌ Not linked!");
  }

  // Check requirement 2
  console.log(`\nOLD sWETH owner: ${owner}`);
  if (owner.toLowerCase() === HUB_ADDRESS.toLowerCase()) {
    console.log("  ✅ Hub can mint!");
  }

  console.log("\n=== Conclusion ===");
  console.log("The OLD sWETH configuration looks correct.");
  console.log("If bridges are still failing, the issue might be:");
  console.log("1. The Arbitrum Gateway is not properly configured");
  console.log("2. LayerZero message execution is failing");
  console.log("3. The LZ options (gas limit) are too low");
  console.log("\nUI should use OLD sWETH address: 0x5E501C482952c1F2D58a4294F9A97759968c5125");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


