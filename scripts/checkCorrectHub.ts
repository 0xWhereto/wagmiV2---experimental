import { ethers } from "hardhat";

async function main() {
  // CORRECT addresses from UI config
  const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
  const HUB_GETTERS = "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e";
  
  // Synthetic tokens from UI config
  const SWETH_ADDRESS = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
  
  // LayerZero Endpoint IDs
  const ARBITRUM_EID = 30110;
  const ETHEREUM_EID = 30101;

  // WETH addresses on remote chains
  const WETH_ARBITRUM = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
  const WETH_ETHEREUM = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

  const provider = ethers.provider;
  
  console.log("=== Checking CORRECT Hub Addresses ===\n");
  
  // Check Hub bytecode
  const hubCode = await provider.getCode(HUB_ADDRESS);
  console.log(`Hub (${HUB_ADDRESS}): ${hubCode.length > 2 ? 'EXISTS (' + hubCode.length + ' bytes)' : 'NO CODE'}`);
  
  // Check Hub Getters bytecode
  const gettersCode = await provider.getCode(HUB_GETTERS);
  console.log(`Hub Getters (${HUB_GETTERS}): ${gettersCode.length > 2 ? 'EXISTS (' + gettersCode.length + ' bytes)' : 'NO CODE'}`);
  
  // Check sWETH bytecode
  const swethCode = await provider.getCode(SWETH_ADDRESS);
  console.log(`sWETH (${SWETH_ADDRESS}): ${swethCode.length > 2 ? 'EXISTS (' + swethCode.length + ' bytes)' : 'NO CODE'}`);

  // Get Hub contract  
  console.log("\n=== Testing Hub Functions ===");
  
  const hub = await ethers.getContractAt(
    [
      "function owner() view returns (address)",
      "function endpoint() view returns (address)",
      "function peers(uint32) view returns (bytes32)"
    ],
    HUB_ADDRESS
  );

  try {
    const owner = await hub.owner();
    console.log(`Hub owner: ${owner}`);
    
    const endpoint = await hub.endpoint();
    console.log(`Hub endpoint: ${endpoint}`);
    
    // Check if Arbitrum Gateway is a peer
    const arbPeer = await hub.peers(ARBITRUM_EID);
    console.log(`Arbitrum peer (EID ${ARBITRUM_EID}): ${arbPeer}`);
    if (arbPeer === ethers.constants.HashZero) {
      console.log("  ⚠️ Arbitrum is NOT a peer!");
    }
    
    const ethPeer = await hub.peers(ETHEREUM_EID);
    console.log(`Ethereum peer (EID ${ETHEREUM_EID}): ${ethPeer}`);
    if (ethPeer === ethers.constants.HashZero) {
      console.log("  ⚠️ Ethereum is NOT a peer!");
    }
  } catch (e: any) {
    console.log(`Hub call error: ${e.message?.slice(0, 200)}`);
  }

  // Get Hub Getters contract
  console.log("\n=== Testing Hub Getters Functions ===");
  
  const hubGetters = await ethers.getContractAt(
    [
      "function getSyntheticTokenCount() view returns (uint256)",
      "function getSyntheticTokenInfo(uint256 index) view returns (address, string memory, uint8, bool)",
      "function getRemoteTokenInfo(address syntheticToken, uint32 chainId) view returns (tuple(address remoteAddress, uint8 decimalsDelta, bool paused, uint256 totalBalance, address syntheticToken))"
    ],
    HUB_GETTERS
  );

  try {
    const count = await hubGetters.getSyntheticTokenCount();
    console.log(`Synthetic token count: ${count}`);
    
    for (let i = 0; i < Math.min(Number(count), 10); i++) {
      try {
        const info = await hubGetters.getSyntheticTokenInfo(i);
        console.log(`  Token ${i}: ${info[1]} (${info[0]})`);
      } catch (e: any) {
        console.log(`  Token ${i}: Error`);
      }
    }
  } catch (e: any) {
    console.log(`Hub Getters error: ${e.message?.slice(0, 200)}`);
  }

  // Check if sWETH is linked to Arbitrum WETH
  console.log("\n=== Checking sWETH -> Arbitrum WETH linking ===");
  
  try {
    const remoteInfo = await hubGetters.getRemoteTokenInfo(SWETH_ADDRESS, ARBITRUM_EID);
    console.log(`sWETH -> Arbitrum Remote Info:`);
    console.log(`  Remote Address: ${remoteInfo.remoteAddress}`);
    console.log(`  Decimals Delta: ${remoteInfo.decimalsDelta}`);
    console.log(`  Paused: ${remoteInfo.paused}`);
    console.log(`  Total Balance: ${ethers.utils.formatEther(remoteInfo.totalBalance)}`);
    
    if (remoteInfo.remoteAddress === ethers.constants.AddressZero) {
      console.log("\n  ❌ sWETH is NOT linked to any token on Arbitrum!");
      console.log("  This is WHY bridge transactions fail - the Hub doesn't know about WETH from Arbitrum");
    } else if (remoteInfo.remoteAddress.toLowerCase() !== WETH_ARBITRUM.toLowerCase()) {
      console.log(`\n  ⚠️ sWETH is linked to a DIFFERENT token on Arbitrum: ${remoteInfo.remoteAddress}`);
    } else {
      console.log("\n  ✅ sWETH is correctly linked to Arbitrum WETH!");
    }
  } catch (e: any) {
    console.log(`Error: ${e.message?.slice(0, 200)}`);
  }

  // Check Ethereum
  console.log("\n=== Checking sWETH -> Ethereum WETH linking ===");
  
  try {
    const remoteInfo = await hubGetters.getRemoteTokenInfo(SWETH_ADDRESS, ETHEREUM_EID);
    console.log(`sWETH -> Ethereum Remote Info:`);
    console.log(`  Remote Address: ${remoteInfo.remoteAddress}`);
    
    if (remoteInfo.remoteAddress === ethers.constants.AddressZero) {
      console.log("\n  ❌ sWETH is NOT linked to any token on Ethereum!");
    } else if (remoteInfo.remoteAddress.toLowerCase() !== WETH_ETHEREUM.toLowerCase()) {
      console.log(`\n  ⚠️ sWETH is linked to a DIFFERENT token on Ethereum: ${remoteInfo.remoteAddress}`);
    } else {
      console.log("\n  ✅ sWETH is correctly linked to Ethereum WETH!");
    }
  } catch (e: any) {
    console.log(`Error: ${e.message?.slice(0, 200)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


