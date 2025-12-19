import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

async function main() {
  const provider = ethers.provider;
  
  console.log("=== Finding Hub Functions ===\n");
  
  const code = await provider.getCode(HUB_ADDRESS);
  console.log(`Hub bytecode: ${code.length / 2 - 1} bytes`);
  
  // List of potential function selectors
  const functions = [
    "owner()",
    "createSyntheticToken(string,uint8)",
    "manualLinkRemoteToken(address,uint32,address,address,int8,uint256)",
    "manualLinkRemoteToken(address,address,uint32,address,int8,uint256)",
    "linkRemoteToken(address,uint32,address,address,int8,uint256)",
    "addRemoteToken(address,uint32,address,address,int8,uint256)",
    "setRemoteToken(address,uint32,address,address,int8,uint256)",
    "bridgeTokens(address,tuple[],uint32,bytes)",
    "peers(uint32)",
    "endpoint()",
    "syntheticTokens(uint256)",
    "getSyntheticTokenCount()",
    "_lzReceive(tuple,bytes32,bytes,address,bytes)",
    "lzReceive(tuple,bytes32,bytes,address,bytes)"
  ];
  
  console.log("\nSearching for function selectors...\n");
  
  for (const func of functions) {
    const selector = ethers.utils.id(func).slice(0, 10);
    const selectorBytes = selector.slice(2).toLowerCase();
    const found = code.toLowerCase().includes(selectorBytes);
    console.log(`${found ? "✅" : "❌"} ${selector} - ${func}`);
  }

  // The old sWETH is linked. Let's check if that's the issue
  console.log("\n=== Checking linked tokens ===");
  
  const ARBITRUM_EID = 30110;
  const ETHEREUM_EID = 30101;
  const WETH_ARBITRUM = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
  const WETH_ETHEREUM = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const OLD_SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
  
  // Check _syntheticAddressByRemoteAddress at slot 8
  for (const [name, eid, remoteToken] of [
    ["WETH Arbitrum", ARBITRUM_EID, WETH_ARBITRUM],
    ["WETH Ethereum", ETHEREUM_EID, WETH_ETHEREUM],
  ]) {
    const innerKey = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(["uint32", "uint256"], [eid, 8])
    );
    const outerKey = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(["address", "bytes32"], [remoteToken, innerKey])
    );
    const value = await provider.getStorageAt(HUB_ADDRESS, outerKey);
    if (value !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      const syntheticAddr = "0x" + value.slice(26, 66);
      console.log(`${name} (EID ${eid}) -> ${syntheticAddr}`);
      if (syntheticAddr.toLowerCase() === OLD_SWETH.toLowerCase()) {
        console.log(`  ✅ This is the OLD sWETH!`);
      }
    } else {
      console.log(`${name} (EID ${eid}) -> NOT LINKED`);
    }
  }

  // The solution is: the OLD sWETH at 0x5E501C... is what's linked
  // We need to use THAT address, not create a new one!
  console.log("\n=== SOLUTION ===");
  console.log("The WETH tokens are already linked to the OLD sWETH at:");
  console.log(`  ${OLD_SWETH}`);
  console.log("\nThe problem is that this OLD sWETH is NOT registered in the Hub's");
  console.log("_tokenIndexByAddress mapping (or has index 0), so deposits fail.");
  console.log("\nWe need to either:");
  console.log("1. Update the UI to use the OLD sWETH address (if it works)");
  console.log("2. Or unlink the old tokens and relink to the new synthetic tokens");
  
  // Check if OLD sWETH has a token index
  console.log("\n=== Checking OLD sWETH token index ===");
  const oldIndexKey = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [OLD_SWETH, 7])
  );
  const oldIndexValue = await provider.getStorageAt(HUB_ADDRESS, oldIndexKey);
  const oldIndex = ethers.BigNumber.from(oldIndexValue);
  console.log(`_tokenIndexByAddress[OLD_sWETH] = ${oldIndex.toString()}`);
  
  if (oldIndex.gt(0)) {
    console.log("✅ OLD sWETH has a valid token index! Deposits should work!");
    console.log("   Update the UI config to use:", OLD_SWETH);
  } else {
    console.log("❌ OLD sWETH has NO token index. This is why deposits fail.");
    console.log("   The OLD sWETH was linked but never properly registered.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

