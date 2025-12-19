import hardhat, { ethers } from "hardhat";

/**
 * Check Hub setup - Balancer and other required configs
 */

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const BALANCER_ADDRESS = "0x3a27f366e09fe76A50DD50D415c770f6caf0F3E6";

async function main() {
  const network = hardhat.network.name;
  if (network !== "sonic") {
    console.log("This script should be run on Sonic network");
    return;
  }

  console.log(`\n========================================`);
  console.log(`Checking Hub Setup on SONIC`);
  console.log(`========================================`);

  const hub = await ethers.getContractAt("SyntheticTokenHub", HUB_ADDRESS);

  // Check owner
  const owner = await hub.owner();
  console.log(`\nHub Owner: ${owner}`);

  // Check Balancer
  console.log("\n--- Balancer Config ---");
  try {
    const balancer = await hub.balancer();
    console.log(`Balancer address: ${balancer}`);
    console.log(`Expected: ${BALANCER_ADDRESS}`);
    
    if (balancer === ethers.constants.AddressZero) {
      console.log(`\n⚠️ BALANCER NOT SET! This is required for token operations.`);
      console.log(`Run: hub.setBalancer("${BALANCER_ADDRESS}")`);
    } else if (balancer.toLowerCase() !== BALANCER_ADDRESS.toLowerCase()) {
      console.log(`\n⚠️ Balancer address mismatch!`);
    } else {
      console.log(`✓ Balancer is configured correctly`);
    }
  } catch (e: any) {
    console.log(`Error getting balancer: ${e.message?.slice(0, 100)}`);
  }

  // Check token factory (synthetic token creation)
  console.log("\n--- Token Factory Config ---");
  try {
    // Check if there's a token factory or implementation address
    // The Hub should be able to deploy new synthetic tokens
    // Let's check what storage slots might contain this info
    
    // Try getting synthetic token count
    const tokenCount = await hub.syntheticTokenCount?.();
    console.log(`Synthetic token count: ${tokenCount || 'N/A'}`);
  } catch (e: any) {
    console.log(`Error checking token factory: ${e.message?.slice(0, 100)}`);
  }

  // Try to simulate what happens during _lzReceive for LinkToken
  console.log("\n--- Simulating LinkToken Processing ---");
  
  // Encode a test LinkToken message
  const MessageType = {
    Deposit: 0,
    Withdraw: 1,
    Swap: 2,
    RevertSwap: 3,
    LinkToken: 4,
  };
  
  const testToken = {
    onPause: false,
    tokenAddress: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH on Arbitrum
    syntheticTokenAddress: ethers.constants.AddressZero,
    decimalsDelta: 0,
    minBridgeAmt: ethers.utils.parseEther("0.001"),
  };

  const msgData = ethers.utils.defaultAbiCoder.encode(
    ["tuple(bool,address,address,int8,uint256)[]"],
    [[[testToken.onPause, testToken.tokenAddress, testToken.syntheticTokenAddress, testToken.decimalsDelta, testToken.minBridgeAmt]]]
  );
  const payload = ethers.utils.defaultAbiCoder.encode(
    ["uint8", "bytes"],
    [MessageType.LinkToken, msgData]
  );

  console.log(`\nTest payload length: ${payload.length} bytes`);
  console.log(`Message type: LinkToken (4)`);

  // Check if we can call a view function on the hub to verify it would work
  console.log("\n--- Checking if Hub can deploy tokens ---");
  
  // The issue might be in CREATE2 deployment or the synthetic token template
  try {
    // Check code at hub address
    const code = await ethers.provider.getCode(HUB_ADDRESS);
    console.log(`Hub contract code length: ${code.length / 2 - 1} bytes`);
    
    // Check if Balancer contract exists
    const balancerCode = await ethers.provider.getCode(BALANCER_ADDRESS);
    console.log(`Balancer contract code length: ${balancerCode.length / 2 - 1} bytes`);
    
    if (balancerCode === "0x") {
      console.log(`\n⚠️ BALANCER CONTRACT NOT DEPLOYED at ${BALANCER_ADDRESS}!`);
    }
  } catch (e: any) {
    console.log(`Error: ${e.message?.slice(0, 100)}`);
  }

  console.log("\n========================================");
  console.log("NEXT STEPS:");
  console.log("1. Make sure Balancer is set: hub.setBalancer(balancerAddress)");
  console.log("2. Retry failed messages via lzReceive");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

