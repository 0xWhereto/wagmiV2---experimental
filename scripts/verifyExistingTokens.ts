import { ethers } from "hardhat";

const GETTERS = "0x2801131F630Fe5Cfb2f6349e40cA28a29C9788a7";
const ARB_EID = 30110;

// Remote tokens on Arbitrum
const USDC = ethers.utils.getAddress("0xaf88d065e77c8cc2239327c5edb3a432268e5831");
const WETH = ethers.utils.getAddress("0x82af49447d8a07e3bd95bd0d56f35241523fbab1");
const WBTC = ethers.utils.getAddress("0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f");

async function main() {
  console.log("=== Verify Existing Linked Tokens ===");
  
  const getters = await ethers.getContractAt("SyntheticTokenHubGetters", GETTERS);
  
  for (const [name, remote] of [["USDC", USDC], ["WETH", WETH], ["WBTC", WBTC]]) {
    console.log(`\n--- ${name} ---`);
    try {
      const synthAddr = await getters.getSyntheticAddressByRemoteAddress(ARB_EID, remote);
      console.log("Synthetic address:", synthAddr);
      
      // Check if contract exists
      const code = await ethers.provider.getCode(synthAddr);
      console.log("Contract exists:", code.length > 2);
      
      if (code.length > 2) {
        const token = await ethers.getContractAt("IERC20", synthAddr);
        try {
          const name = await token.name();
          const symbol = await token.symbol();
          const decimals = await token.decimals();
          console.log(`Token: ${name} (${symbol}), ${decimals} decimals`);
        } catch (e) {
          console.log("Could not read token metadata");
        }
      }
    } catch (e: any) {
      console.log("Error:", e.reason || e.message?.slice(0, 50));
    }
  }
  
  // Also check what gateway vault is registered for Arbitrum
  console.log("\n--- Gateway Vault ---");
  try {
    const gateway = await getters.getGatewayVaultByEid(ARB_EID);
    console.log("Registered gateway for Arbitrum:", gateway);
    console.log("New gateway:", "0x2d603F7B0d06Bd5f6232Afe1991aF3D103d68071");
    console.log("Match:", gateway.toLowerCase() === "0x2d603F7B0d06Bd5f6232Afe1991aF3D103d68071".toLowerCase());
  } catch (e: any) {
    console.log("Error:", e.reason || e.message?.slice(0, 50));
  }
}

main().catch(console.error);
