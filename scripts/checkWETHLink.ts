import { ethers } from "hardhat";

async function main() {
  // Contract addresses - use lowercase then let ethers checksum
  const HUB_GETTERS = ethers.utils.getAddress("0xee1aa06f55c77b5cf24fde91b0f9e2c465a9e0c4");
  const SWETH_ADDRESS = ethers.utils.getAddress("0x5e501c482952c1f2d58a4294f9a97759968c5125");
  const HUB_ADDRESS = ethers.utils.getAddress("0xd107d49c9b2e65d0d426622f5a072dc389b11b31");

  // LayerZero Endpoint IDs
  const ARBITRUM_EID = 30110;
  const ETHEREUM_EID = 30101;

  // WETH addresses on remote chains (lowercase for correct checksum)
  const WETH_ARBITRUM = ethers.utils.getAddress("0x82af49447d8a07e3bd95bd0d56f35241523fbab1");
  const WETH_ETHEREUM = ethers.utils.getAddress("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2");

  console.log("Checking WETH linking status on Hub...\n");
  console.log(`Hub Getters: ${HUB_GETTERS}`);
  console.log(`sWETH: ${SWETH_ADDRESS}`);
  console.log(`Hub: ${HUB_ADDRESS}`);
  console.log(`WETH Arbitrum: ${WETH_ARBITRUM}`);
  console.log(`WETH Ethereum: ${WETH_ETHEREUM}`);

  const hubGetters = await ethers.getContractAt(
    [
      "function getRemoteTokenByAddress(uint32 chainId, address remoteAddress) view returns (tuple(address remoteAddress, uint8 decimalsDelta, bool paused, uint256 totalBalance, address syntheticToken))",
      "function getSyntheticTokenInfo(uint256 index) view returns (address, string memory, uint8, bool)",
      "function getSyntheticTokenCount() view returns (uint256)",
      "function getRemoteTokenInfo(address syntheticToken, uint32 chainId) view returns (tuple(address remoteAddress, uint8 decimalsDelta, bool paused, uint256 totalBalance, address syntheticToken))"
    ],
    HUB_GETTERS
  );

  // Check synthetic token count
  console.log("\n--- Synthetic Tokens on Hub ---");
  try {
    const count = await hubGetters.getSyntheticTokenCount();
    console.log(`Total synthetic tokens on Hub: ${count}`);
    
    // List all synthetic tokens
    for (let i = 0; i < Number(count); i++) {
      try {
        const info = await hubGetters.getSyntheticTokenInfo(i);
        console.log(`  Token ${i}: ${info[1]} (${info[0]})`);
      } catch (e: any) {
        console.log(`  Token ${i}: Error - ${e.message?.slice(0, 100)}`);
      }
    }
  } catch (e: any) {
    console.log(`Could not get synthetic token count: ${e.message?.slice(0, 100)}`);
  }

  console.log("\n--- Checking WETH on Arbitrum (EID: 30110) ---");
  try {
    const remoteInfo = await hubGetters.getRemoteTokenByAddress(ARBITRUM_EID, WETH_ARBITRUM);
    console.log("WETH Arbitrum -> sWETH mapping:");
    console.log(`  Remote Address: ${remoteInfo.remoteAddress}`);
    console.log(`  Decimals Delta: ${remoteInfo.decimalsDelta}`);
    console.log(`  Paused: ${remoteInfo.paused}`);
    console.log(`  Total Balance: ${ethers.utils.formatEther(remoteInfo.totalBalance)}`);
    console.log(`  Synthetic Token: ${remoteInfo.syntheticToken}`);
    
    if (remoteInfo.syntheticToken === ethers.constants.AddressZero) {
      console.log("\n  ⚠️  WETH on Arbitrum is NOT LINKED to any synthetic token!");
    }
  } catch (e: any) {
    console.log(`Error getting WETH Arbitrum info: ${e.message?.slice(0, 200)}`);
  }

  console.log("\n--- Checking sWETH -> Arbitrum reverse mapping ---");
  try {
    const remoteInfo = await hubGetters.getRemoteTokenInfo(SWETH_ADDRESS, ARBITRUM_EID);
    console.log("sWETH -> Arbitrum Remote Info:");
    console.log(`  Remote Address: ${remoteInfo.remoteAddress}`);
    console.log(`  Decimals Delta: ${remoteInfo.decimalsDelta}`);
    console.log(`  Paused: ${remoteInfo.paused}`);
    console.log(`  Total Balance: ${ethers.utils.formatEther(remoteInfo.totalBalance)}`);
    
    if (remoteInfo.remoteAddress === ethers.constants.AddressZero) {
      console.log("\n  ⚠️  sWETH has NO link to Arbitrum WETH!");
    }
  } catch (e: any) {
    console.log(`Error getting sWETH->Arbitrum info: ${e.message?.slice(0, 200)}`);
  }

  console.log("\n--- Checking WETH on Ethereum (EID: 30101) ---");
  try {
    const remoteInfo = await hubGetters.getRemoteTokenByAddress(ETHEREUM_EID, WETH_ETHEREUM);
    console.log("WETH Ethereum -> sWETH mapping:");
    console.log(`  Remote Address: ${remoteInfo.remoteAddress}`);
    console.log(`  Synthetic Token: ${remoteInfo.syntheticToken}`);
    
    if (remoteInfo.syntheticToken === ethers.constants.AddressZero) {
      console.log("\n  ⚠️  WETH on Ethereum is NOT LINKED to any synthetic token!");
    }
  } catch (e: any) {
    console.log(`Error getting WETH Ethereum info: ${e.message?.slice(0, 200)}`);
  }

  // Check hub directly
  console.log("\n--- Direct Hub Check ---");
  const hub = await ethers.getContractAt(
    [
      "function syntheticTokens(uint256) view returns (address)",
      "function owner() view returns (address)",
      "function endpoint() view returns (address)"
    ],
    HUB_ADDRESS
  );

  try {
    const owner = await hub.owner();
    console.log(`Hub owner: ${owner}`);
    
    const endpoint = await hub.endpoint();
    console.log(`Hub endpoint: ${endpoint}`);
  } catch (e: any) {
    console.log(`Could not get hub info: ${e.message?.slice(0, 100)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
