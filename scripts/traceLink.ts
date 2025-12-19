import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const SWETH = "0x895d970646bd58C697A2EF855754bd074Ef2018b";
const WETH_ARBITRUM = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const ARBITRUM_GATEWAY = "0x187ddd9a94236ba6d22376ee2e3c4c834e92f34e";
const ARBITRUM_EID = 30110;

async function main() {
  const [signer] = await ethers.getSigners();
  const provider = ethers.provider;
  
  console.log("=== Tracing manualLinkRemoteToken ===\n");

  // First, let's verify each precondition manually
  
  // 1. Check owner
  const ownerSlot = await provider.getStorageAt(HUB_ADDRESS, 0);
  const owner = "0x" + ownerSlot.slice(26, 66);
  console.log(`1. Owner check: ${owner}`);
  console.log(`   Signer: ${signer.address}`);
  console.log(`   Is owner: ${owner.toLowerCase() === signer.address.toLowerCase()}`);

  // 2. Check _tokenIndexByAddress[sWETH]
  const indexKey = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [SWETH, 7])
  );
  const indexValue = await provider.getStorageAt(HUB_ADDRESS, indexKey);
  const tokenIndex = ethers.BigNumber.from(indexValue);
  console.log(`2. _tokenIndexByAddress[sWETH] = ${tokenIndex.toString()}`);
  console.log(`   Check: index > 0 = ${tokenIndex.gt(0)}`);

  // 3. Check _syntheticAddressByRemoteAddress[ARBITRUM_EID][WETH_ARBITRUM]
  // This is at slot 8 (based on the order: slot 7 = _tokenIndexByAddress, slot 8 = _syntheticAddressByRemoteAddress)
  // Actually need to figure out the correct slot
  
  // Let's try to find the _syntheticAddressByRemoteAddress slot
  console.log(`\n3. Looking for _syntheticAddressByRemoteAddress[${ARBITRUM_EID}][${WETH_ARBITRUM}]`);
  
  // The mapping is: mapping(uint32 => mapping(address => address))
  // Storage key: keccak256(address . keccak256(uint32 . slot))
  
  for (let slot = 8; slot <= 15; slot++) {
    const innerKey = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(["uint32", "uint256"], [ARBITRUM_EID, slot])
    );
    const outerKey = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(["address", "bytes32"], [WETH_ARBITRUM, innerKey])
    );
    const value = await provider.getStorageAt(HUB_ADDRESS, outerKey);
    if (value !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      const addr = "0x" + value.slice(26, 66);
      console.log(`   Slot ${slot}: linked to ${addr}`);
    }
  }
  console.log(`   (If nothing shown, it's not linked yet - which is correct)`);

  // 4. Let's check if maybe the issue is with the onlyOwner modifier from Ownable
  // by trying a simple owner() call first
  console.log(`\n4. Testing owner() call...`);
  const hub = await ethers.getContractAt(
    ["function owner() view returns (address)"],
    HUB_ADDRESS
  );
  const contractOwner = await hub.owner();
  console.log(`   Contract owner: ${contractOwner}`);

  // 5. Let's try to send the transaction and get the actual revert trace
  console.log(`\n5. Attempting transaction with debug...`);
  
  const hubWithLink = await ethers.getContractAt(
    [
      "function manualLinkRemoteToken(address _syntheticTokenAddress, uint32 _srcEid, address _remoteTokenAddress, address _gatewayVault, int8 _decimalsDelta, uint256 _minBridgeAmt) external"
    ],
    HUB_ADDRESS,
    signer
  );

  // Try to get gas estimate with debug
  try {
    const gasEstimate = await provider.estimateGas({
      from: signer.address,
      to: HUB_ADDRESS,
      data: hubWithLink.interface.encodeFunctionData("manualLinkRemoteToken", [
        SWETH,
        ARBITRUM_EID,
        WETH_ARBITRUM,
        ARBITRUM_GATEWAY,
        0,
        1000
      ])
    });
    console.log(`   Gas estimate: ${gasEstimate.toString()}`);
    console.log("   ✅ Should succeed!");
  } catch (e: any) {
    console.log(`   ❌ Gas estimation failed`);
    console.log(`   Error: ${e.message?.slice(0, 300)}`);
    
    // Try with hardhat_impersonateAccount if needed
    console.log(`\n   Checking if function selector matches...`);
    const funcSig = "manualLinkRemoteToken(address,uint32,address,address,int8,uint256)";
    const selector = ethers.utils.id(funcSig).slice(0, 10);
    console.log(`   Function signature: ${funcSig}`);
    console.log(`   Selector: ${selector}`);
    
    // Check the deployed contract has this function
    const code = await provider.getCode(HUB_ADDRESS);
    if (code.includes(selector.slice(2))) {
      console.log(`   ✅ Selector found in bytecode`);
    } else {
      console.log(`   ❌ Selector NOT found in bytecode!`);
      console.log(`   The deployed contract might have a different function signature!`);
    }
  }

  // 6. Let's check if the deployed contract matches what we expect
  console.log(`\n6. Checking deployed contract bytecode...`);
  const code = await provider.getCode(HUB_ADDRESS);
  console.log(`   Bytecode length: ${code.length / 2 - 1} bytes`);
  
  // Check for some known selectors
  const selectors = [
    { name: "manualLinkRemoteToken(address,uint32,address,address,int8,uint256)", expected: "0x92346442" },
    { name: "manualLinkRemoteToken(address,address,uint32,address,int8,uint256)", expected: "0x21707134" },
    { name: "createSyntheticToken(string,uint8)", expected: null },
    { name: "owner()", expected: "0x8da5cb5b" }
  ];
  
  for (const sel of selectors) {
    const selector = ethers.utils.id(sel.name).slice(0, 10);
    const inCode = code.toLowerCase().includes(selector.slice(2).toLowerCase());
    console.log(`   ${sel.name}: ${selector} - ${inCode ? "✅ Found" : "❌ Not found"}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

