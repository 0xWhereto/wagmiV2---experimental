import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

// WBTC addresses
const WBTC_ARBITRUM = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
const WBTC_ETHEREUM = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";

// Gateway addresses
const ARBITRUM_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const ETHEREUM_GATEWAY = "0xba36FC6568B953f691dd20754607590C59b7646a";

// EIDs
const ARBITRUM_EID = 30110;
const ETHEREUM_EID = 30101;

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Creating sBTC and Linking WBTC ===\n");
  console.log(`Signer: ${signer.address}`);
  
  const hub = await ethers.getContractAt(
    [
      "function owner() view returns (address)",
      "function createSyntheticToken(string memory _symbol, uint8 _decimals) external",
      "function manualLinkRemoteToken(address _syntheticTokenAddress, uint32 _srcEid, address _remoteTokenAddress, address _gatewayVault, int8 _decimalsDelta, uint256 _minBridgeAmt) external"
    ],
    HUB_ADDRESS,
    signer
  );

  // Check owner
  const owner = await hub.owner();
  console.log(`Hub owner: ${owner}`);
  
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.log("❌ You are NOT the owner!");
    return;
  }
  console.log("✅ You are the owner!\n");

  // Step 1: Create sBTC synthetic token
  console.log("=== Step 1: Creating sBTC ===");
  let sbtcAddress: string;
  
  try {
    console.log("Calling createSyntheticToken('sBTC', 8)...");
    const createTx = await hub.createSyntheticToken("sBTC", 8, {
      gasLimit: 2000000
    });
    console.log(`TX: ${createTx.hash}`);
    
    const receipt = await createTx.wait();
    console.log(`Block: ${receipt.blockNumber}`);
    
    // Find the SyntheticTokenAdded event to get the address
    const addedEvent = receipt.events?.find((e: any) => e.event === "SyntheticTokenAdded");
    if (addedEvent && addedEvent.args) {
      sbtcAddress = addedEvent.args.tokenAddress;
      console.log(`✅ sBTC created at: ${sbtcAddress}`);
    } else {
      // Try to decode from logs manually
      const eventSig = ethers.utils.id("SyntheticTokenAdded(uint256,address,string,uint8)");
      const log = receipt.logs.find((l: any) => l.topics[0] === eventSig);
      if (log) {
        const decoded = ethers.utils.defaultAbiCoder.decode(
          ["address", "string", "uint8"],
          log.data
        );
        sbtcAddress = decoded[0];
        console.log(`✅ sBTC created at: ${sbtcAddress}`);
      } else {
        console.log("Could not find sBTC address from events. Check transaction manually.");
        console.log("Events:", receipt.events?.map((e: any) => e.event));
        return;
      }
    }
  } catch (e: any) {
    if (e.message?.includes("already exists") || e.reason?.includes("already exists")) {
      console.log("sBTC may already exist. Checking...");
      // We'll need to find it another way
      return;
    }
    console.log(`Error creating sBTC: ${e.reason || e.message}`);
    return;
  }

  // Step 2: Link WBTC from Arbitrum
  console.log("\n=== Step 2: Linking WBTC from Arbitrum ===");
  try {
    // WBTC has 8 decimals, sBTC has 8 decimals, so decimalsDelta = 0
    const decimalsDelta = 0;
    const minBridgeAmt = ethers.utils.parseUnits("0.00001", 8); // 0.00001 BTC minimum

    console.log(`Linking WBTC (${WBTC_ARBITRUM}) -> sBTC (${sbtcAddress})`);
    console.log(`Gateway: ${ARBITRUM_GATEWAY}, EID: ${ARBITRUM_EID}`);
    
    const linkTx = await hub.manualLinkRemoteToken(
      sbtcAddress,
      ARBITRUM_EID,
      WBTC_ARBITRUM,
      ARBITRUM_GATEWAY,
      decimalsDelta,
      minBridgeAmt,
      { gasLimit: 500000 }
    );
    console.log(`TX: ${linkTx.hash}`);
    await linkTx.wait();
    console.log("✅ WBTC from Arbitrum linked!");
  } catch (e: any) {
    console.log(`Error linking Arbitrum WBTC: ${e.reason || e.message}`);
  }

  // Step 3: Link WBTC from Ethereum
  console.log("\n=== Step 3: Linking WBTC from Ethereum ===");
  try {
    const decimalsDelta = 0;
    const minBridgeAmt = ethers.utils.parseUnits("0.00001", 8);

    console.log(`Linking WBTC (${WBTC_ETHEREUM}) -> sBTC (${sbtcAddress})`);
    console.log(`Gateway: ${ETHEREUM_GATEWAY}, EID: ${ETHEREUM_EID}`);
    
    const linkTx = await hub.manualLinkRemoteToken(
      sbtcAddress,
      ETHEREUM_EID,
      WBTC_ETHEREUM,
      ETHEREUM_GATEWAY,
      decimalsDelta,
      minBridgeAmt,
      { gasLimit: 500000 }
    );
    console.log(`TX: ${linkTx.hash}`);
    await linkTx.wait();
    console.log("✅ WBTC from Ethereum linked!");
  } catch (e: any) {
    console.log(`Error linking Ethereum WBTC: ${e.reason || e.message}`);
  }

  console.log("\n=== Done ===");
  console.log(`sBTC Address: ${sbtcAddress}`);
  console.log("\nUpdate your config.ts with this sBTC address!");
  console.log("Try bridging WBTC again!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

