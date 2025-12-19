import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const SBTC_ADDRESS = "0x1DeFDa524B2B5edB94299775B23d7E3dde1Fbb6C";
const WBTC_ARBITRUM = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
const ARBITRUM_EID = 30110;

async function main() {
  const [signer] = await ethers.getSigners();
  const provider = ethers.provider;
  
  console.log("=== Checking Hub Internal State ===\n");
  
  // Read _tokenIndexByAddress for sBTC
  // Storage slot = keccak256(abi.encode(address, slot))
  // Need to find the slot number for _tokenIndexByAddress mapping
  
  // From the contract:
  // mapping(address => uint256) private _tokenIndexByAddress; // at slot ?
  
  // Let's count storage slots in SyntheticTokenHub:
  // address public immutable uniswapUniversalRouter; -- immutable, not in storage
  // address public immutable uniswapPermitV2; -- immutable, not in storage
  // address public balancer; -- slot 0
  // mapping(uint256 => SyntheticTokenInfo) private _syntheticTokens; -- slot 1
  // mapping(address => mapping(uint32 => RemoteTokenInfo)) private _remoteTokens; -- slot 2
  // uint256 private _syntheticTokenCount; -- slot 3
  // mapping(address => uint256) private _tokenIndexByAddress; -- slot 4
  // mapping(uint32 => mapping(address => address)) private _syntheticAddressByRemoteAddress; -- slot 5
  // mapping(uint32 => mapping(address => address)) private _remoteAddressBySyntheticAddress; -- slot 6
  // mapping(uint32 => address) private _gatewayVaultByEid; -- slot 7
  // mapping(address => mapping(uint32 => uint256)) private _bonusBalance; -- slot 8
  
  // First let's read _syntheticTokenCount
  console.log("=== _syntheticTokenCount ===");
  const slot3 = await provider.getStorageAt(HUB_ADDRESS, 3);
  console.log(`Slot 3 (token count): ${ethers.BigNumber.from(slot3).toString()}`);
  
  // Read _tokenIndexByAddress[sBTC]
  console.log("\n=== _tokenIndexByAddress[sBTC] ===");
  const slot4Key = ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ["address", "uint256"],
      [SBTC_ADDRESS, 4]
    )
  );
  const tokenIndex = await provider.getStorageAt(HUB_ADDRESS, slot4Key);
  console.log(`sBTC tokenIndex: ${ethers.BigNumber.from(tokenIndex).toString()}`);
  
  // Read _syntheticAddressByRemoteAddress[ARBITRUM_EID][WBTC_ARB]
  console.log("\n=== _syntheticAddressByRemoteAddress[ARB_EID][WBTC] ===");
  // For nested mapping: keccak256(key2 . keccak256(key1 . slot))
  const slot5_inner = ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ["uint32", "uint256"],
      [ARBITRUM_EID, 5]
    )
  );
  const slot5_outer = ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ["address", "bytes32"],
      [WBTC_ARBITRUM, slot5_inner]
    )
  );
  const linkedSynthetic = await provider.getStorageAt(HUB_ADDRESS, slot5_outer);
  console.log(`Raw value: ${linkedSynthetic}`);
  console.log(`Linked synthetic for WBTC Arb: ${ethers.utils.getAddress("0x" + linkedSynthetic.slice(-40))}`);
  
  // If it's not zero, WBTC is already linked
  if (linkedSynthetic !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
    console.log("\n⚠️ WBTC from Arbitrum is already linked to a synthetic token!");
    console.log("This is why manualLinkRemoteToken fails - the require check fails.");
  } else {
    console.log("\n✅ WBTC from Arbitrum is NOT linked yet. Issue is elsewhere.");
  }

  // Also check the Hub's view functions directly
  console.log("\n=== Using Hub view functions ===");
  const hub = new ethers.Contract(
    HUB_ADDRESS,
    [
      "function getSyntheticTokenInfo(uint256 index) view returns (tuple(address tokenAddress, string tokenSymbol, uint8 tokenDecimals, uint32[] chainList))",
      "function getSyntheticTokenByAddress(address token) view returns (uint256)"
    ],
    provider
  );

  // Check token count and iterate
  const tokenCount = ethers.BigNumber.from(slot3).toNumber();
  console.log(`Token count: ${tokenCount}`);
  
  for (let i = 1; i <= Math.min(tokenCount, 10); i++) {
    try {
      const info = await hub.getSyntheticTokenInfo(i);
      console.log(`\nToken ${i}: ${info.tokenSymbol}`);
      console.log(`  Address: ${info.tokenAddress}`);
      console.log(`  Chains: ${info.chainList.join(", ") || "none"}`);
    } catch (e: any) {
      console.log(`Token ${i}: Error - ${e.message?.slice(0, 50)}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

