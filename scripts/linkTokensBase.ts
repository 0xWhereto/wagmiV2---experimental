import hardhat, { ethers } from "hardhat";
import { Options } from "@layerzerolabs/lz-v2-utilities";

/**
 * Link tokens on Base
 */

const GATEWAY_ADDRESS = "0xb867d9E9D374E8b1165bcDF6D3f66d1A9AAd2447";
const LZ_GAS_LIMIT = 500000;

// Base token addresses
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

async function main() {
  const network = hardhat.network.name;
  if (network !== "base") {
    console.log("This script should be run on Base network");
    return;
  }

  const [deployer] = await ethers.getSigners();
  console.log(`\n========================================`);
  console.log(`Linking tokens on BASE`);
  console.log(`========================================`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH`);

  const gatewayVault = await ethers.getContractAt("GatewayVault", GATEWAY_ADDRESS);

  // Check existing tokens
  const existingCount = await gatewayVault.getAvailableTokenLength();
  console.log(`\nExisting linked tokens: ${existingCount}`);

  const lzOptions = Options.newOptions().addExecutorLzReceiveOption(LZ_GAS_LIMIT, 0).toHex().toString();

  // Link WETH
  console.log("\n--- Linking WETH ---");
  try {
    const wethConfig = [{
      onPause: false,
      tokenAddress: WETH_ADDRESS,
      syntheticTokenDecimals: 18,
      syntheticTokenAddress: ethers.constants.AddressZero,
      minBridgeAmt: ethers.utils.parseEther("0.001"),
    }];
    
    const wethFee = await gatewayVault.quoteLinkTokenToHub(wethConfig, lzOptions);
    console.log(`Fee: ${ethers.utils.formatEther(wethFee)} ETH`);
    
    const tx1 = await gatewayVault.linkTokenToHub(wethConfig, lzOptions, {
      value: wethFee.mul(150).div(100),
      gasLimit: 600000,
    });
    console.log(`TX: ${tx1.hash}`);
    await tx1.wait();
    console.log("✓ WETH linked!");
  } catch (e: any) {
    console.log(`Failed: ${e.message?.slice(0, 100)}`);
  }

  // Link USDC
  console.log("\n--- Linking USDC ---");
  try {
    const usdcConfig = [{
      onPause: false,
      tokenAddress: USDC_ADDRESS,
      syntheticTokenDecimals: 6,
      syntheticTokenAddress: ethers.constants.AddressZero,
      minBridgeAmt: ethers.utils.parseUnits("1", 6),
    }];
    
    const usdcFee = await gatewayVault.quoteLinkTokenToHub(usdcConfig, lzOptions);
    console.log(`Fee: ${ethers.utils.formatEther(usdcFee)} ETH`);
    
    const tx2 = await gatewayVault.linkTokenToHub(usdcConfig, lzOptions, {
      value: usdcFee.mul(150).div(100),
      gasLimit: 600000,
    });
    console.log(`TX: ${tx2.hash}`);
    await tx2.wait();
    console.log("✓ USDC linked!");
  } catch (e: any) {
    console.log(`Failed: ${e.message?.slice(0, 100)}`);
  }

  // Verify
  const finalCount = await gatewayVault.getAvailableTokenLength();
  console.log(`\n✓ Total linked tokens: ${finalCount}`);
  
  const tokens = await gatewayVault.getAllAvailableTokens();
  for (const t of tokens) {
    console.log(`  - ${t.tokenSymbol} (${t.tokenAddress})`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


