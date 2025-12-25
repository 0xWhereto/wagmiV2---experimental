import hardhat, { ethers } from "hardhat";
import { EndpointId } from "@layerzerolabs/lz-definitions";

/**
 * Diagnostic script to check Gateway Vault configuration
 */

const GATEWAY_ADDRESSES: Record<string, string> = {
  arbitrum: "0xb867d9E9D374E8b1165bcDF6D3f66d1A9AAd2447",
  base: "0xb867d9E9D374E8b1165bcDF6D3f66d1A9AAd2447",
  ethereum: "0xc792AB26B1f1670B2f5081F8d74bD6a451aD6b44",
};

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const SONIC_EID = 30332; // EndpointId.SONIC_V2_MAINNET

async function main() {
  const network = hardhat.network.name;
  
  if (!GATEWAY_ADDRESSES[network]) {
    console.log(`Network ${network} is not a gateway chain`);
    return;
  }

  const [deployer] = await ethers.getSigners();
  console.log(`\n========================================`);
  console.log(`Checking Gateway on ${network.toUpperCase()}`);
  console.log(`========================================`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH`);

  const gatewayAddress = GATEWAY_ADDRESSES[network];
  console.log(`\nGateway Vault: ${gatewayAddress}`);

  const gatewayVault = await ethers.getContractAt("GatewayVault", gatewayAddress);

  // Check owner
  try {
    const owner = await gatewayVault.owner();
    console.log(`Owner: ${owner}`);
    console.log(`Is deployer owner: ${owner.toLowerCase() === deployer.address.toLowerCase()}`);
  } catch (e) {
    console.log("Could not get owner");
  }

  // Check destination EID
  try {
    const dstEid = await gatewayVault.DST_EID();
    console.log(`\nDestination EID: ${dstEid}`);
    console.log(`Expected (Sonic): ${SONIC_EID}`);
    console.log(`Match: ${dstEid.toString() === SONIC_EID.toString()}`);
  } catch (e) {
    console.log("Could not get DST_EID");
  }

  // Check if peer is set
  try {
    const peer = await gatewayVault.peers(SONIC_EID);
    console.log(`\nPeer for Sonic (${SONIC_EID}): ${peer}`);
    const expectedPeer = ethers.utils.hexZeroPad(HUB_ADDRESS, 32);
    console.log(`Expected peer: ${expectedPeer}`);
    console.log(`Peer set correctly: ${peer.toLowerCase() === expectedPeer.toLowerCase()}`);
    
    if (peer === ethers.constants.HashZero) {
      console.log(`\n⚠️ PEER NOT SET! Run: npx hardhat run scripts/setupPeers.ts --network ${network}`);
    }
  } catch (e: any) {
    console.log("Could not get peer:", e.message?.slice(0, 100));
  }

  // Check LayerZero endpoint
  try {
    const endpoint = await gatewayVault.endpoint();
    console.log(`\nLayerZero Endpoint: ${endpoint}`);
  } catch (e) {
    console.log("Could not get endpoint");
  }

  // Check linked tokens
  try {
    const tokenCount = await gatewayVault.getAvailableTokenLength();
    console.log(`\nLinked tokens: ${tokenCount}`);
    
    if (tokenCount.gt(0)) {
      const tokens = await gatewayVault.getAllAvailableTokens();
      for (const token of tokens) {
        console.log(`  - ${token.tokenSymbol} (${token.tokenAddress})`);
        console.log(`    Paused: ${token.onPause}`);
        console.log(`    Synthetic: ${token.syntheticTokenAddress}`);
      }
    }
  } catch (e: any) {
    console.log("Could not get tokens:", e.message?.slice(0, 100));
  }

  // Try to get a quote
  console.log("\n--- Testing Quote ---");
  const testToken = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"; // WETH on Arbitrum
  const testConfig = [{
    onPause: false,
    tokenAddress: testToken,
    syntheticTokenDecimals: 18,
    syntheticTokenAddress: ethers.constants.AddressZero,
    minBridgeAmt: ethers.utils.parseEther("0.001"),
  }];
  const lzOptions = "0x00030011010000000000000000000000000000000000000000000000000000061a80";
  
  try {
    const quote = await gatewayVault.quoteLinkTokenToHub(testConfig, lzOptions);
    console.log(`Quote for linking 1 token: ${ethers.utils.formatEther(quote)} ETH`);
  } catch (e: any) {
    console.log(`Quote failed: ${e.message?.slice(0, 200)}`);
    console.log(`\nThis likely means the peer is not set or LayerZero endpoint is misconfigured.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });



