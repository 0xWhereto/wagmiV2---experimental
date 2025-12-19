import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

// New synthetic token addresses (from creation TXs)
const SYNTHETIC_TOKENS = {
  sWETH: "0x895d970646bd58C697A2EF855754bd074Ef2018b",
  sUSDT: "0x18a94F23c17Ab4bE105fdC3Ea7Da3D82587cA866",
  sUSDC: "0xe9B4f5A067DbA420099a5eCCE0FB8ed416979c6E",
  sBTC: "0x221Be78CCE1465946eA17e44aa08C4b756983b5F"
};

// Gateway addresses (from peers)
const ARBITRUM_GATEWAY = "0x187ddd9a94236ba6d22376ee2e3c4c834e92f34e";
const ETHEREUM_GATEWAY = "0xba36fc6568b953f691dd20754607590c59b7646a";

// Endpoint IDs
const ARBITRUM_EID = 30110;
const ETHEREUM_EID = 30101;

// Remote token addresses
const LINKS = [
  // sWETH links
  { synthetic: SYNTHETIC_TOKENS.sWETH, remote: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", eid: ARBITRUM_EID, gateway: ARBITRUM_GATEWAY, name: "sWETH-Arbitrum" },
  { synthetic: SYNTHETIC_TOKENS.sWETH, remote: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", eid: ETHEREUM_EID, gateway: ETHEREUM_GATEWAY, name: "sWETH-Ethereum" },
  
  // sUSDT links
  { synthetic: SYNTHETIC_TOKENS.sUSDT, remote: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", eid: ARBITRUM_EID, gateway: ARBITRUM_GATEWAY, name: "sUSDT-Arbitrum" },
  { synthetic: SYNTHETIC_TOKENS.sUSDT, remote: "0xdAC17F958D2ee523a2206206994597C13D831ec7", eid: ETHEREUM_EID, gateway: ETHEREUM_GATEWAY, name: "sUSDT-Ethereum" },
  
  // sUSDC links
  { synthetic: SYNTHETIC_TOKENS.sUSDC, remote: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", eid: ARBITRUM_EID, gateway: ARBITRUM_GATEWAY, name: "sUSDC-Arbitrum" },
  { synthetic: SYNTHETIC_TOKENS.sUSDC, remote: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", eid: ETHEREUM_EID, gateway: ETHEREUM_GATEWAY, name: "sUSDC-Ethereum" },
  
  // sBTC links
  { synthetic: SYNTHETIC_TOKENS.sBTC, remote: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", eid: ARBITRUM_EID, gateway: ARBITRUM_GATEWAY, name: "sBTC-Arbitrum" },
  { synthetic: SYNTHETIC_TOKENS.sBTC, remote: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", eid: ETHEREUM_EID, gateway: ETHEREUM_GATEWAY, name: "sBTC-Ethereum" },
];

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`Using signer: ${signer.address}`);
  
  const hub = await ethers.getContractAt(
    [
      "function owner() view returns (address)",
      // CORRECT ORDER: syntheticToken, srcEid, remoteToken, gateway, decimalsDelta, minBridgeAmt
      "function manualLinkRemoteToken(address _syntheticTokenAddress, uint32 _srcEid, address _remoteTokenAddress, address _gatewayVault, int8 _decimalsDelta, uint256 _minBridgeAmt) external"
    ],
    HUB_ADDRESS,
    signer
  );

  // Verify owner
  const owner = await hub.owner();
  console.log(`Hub owner: ${owner}`);
  
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.log("\n❌ ERROR: You are not the Hub owner!");
    return;
  }

  // First verify the synthetic tokens exist
  console.log("\n=== Verifying Synthetic Tokens ===");
  for (const [name, addr] of Object.entries(SYNTHETIC_TOKENS)) {
    try {
      const token = await ethers.getContractAt(
        ["function symbol() view returns (string)", "function decimals() view returns (uint8)"],
        addr
      );
      const symbol = await token.symbol();
      const decimals = await token.decimals();
      console.log(`✅ ${name}: ${addr} (${symbol}, ${decimals} decimals)`);
    } catch (e: any) {
      console.log(`❌ ${name}: ${addr} - DOES NOT EXIST!`);
    }
  }

  console.log("\n=== Linking Remote Tokens ===");
  
  for (const link of LINKS) {
    console.log(`\nLinking ${link.name}...`);
    console.log(`  Synthetic: ${link.synthetic}`);
    console.log(`  Remote: ${link.remote}`);
    console.log(`  EID: ${link.eid}`);
    console.log(`  Gateway: ${link.gateway}`);
    
    try {
      // CORRECT ORDER: syntheticToken, srcEid, remoteToken, gateway, decimalsDelta, minBridgeAmt
      const tx = await hub.manualLinkRemoteToken(
        link.synthetic,  // address _syntheticTokenAddress
        link.eid,        // uint32 _srcEid
        link.remote,     // address _remoteTokenAddress
        link.gateway,    // address _gatewayVault
        0,               // int8 _decimalsDelta
        1000,            // uint256 _minBridgeAmt
        { gasLimit: 500000 }
      );
      
      console.log(`  TX: ${tx.hash}`);
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        console.log(`  ✅ SUCCESS`);
      } else {
        console.log(`  ❌ Transaction reverted`);
      }
    } catch (e: any) {
      if (e.message?.includes("Already linked")) {
        console.log(`  ⏭️ Already linked`);
      } else if (e.message?.includes("Synthetic token not found")) {
        console.log(`  ❌ Synthetic token not found in Hub!`);
      } else {
        console.log(`  ❌ Error: ${e.reason || e.message?.slice(0, 100)}`);
      }
    }
  }

  console.log("\n=== DONE ===");
  console.log("\nUpdate frontend config with these addresses:");
  console.log("```");
  console.log("syntheticTokens: {");
  for (const [name, addr] of Object.entries(SYNTHETIC_TOKENS)) {
    console.log(`  ${name}: "${addr}",`);
  }
  console.log("}");
  console.log("```");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

