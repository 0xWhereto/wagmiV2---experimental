import hardhat, { ethers } from "hardhat";
import { Options } from "@layerzerolabs/lz-v2-utilities";

/**
 * Link tokens on Ethereum
 */

const GATEWAY_ADDRESS = "0xc792AB26B1f1670B2f5081F8d74bD6a451aD6b44";
const LZ_GAS_LIMIT = 500000;

// Ethereum token addresses
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

async function main() {
  const network = hardhat.network.name;
  if (network !== "ethereum") {
    console.log("This script should be run on Ethereum network");
    return;
  }

  const [deployer] = await ethers.getSigners();
  console.log(`\n========================================`);
  console.log(`Linking tokens on ETHEREUM`);
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

  // Link USDT
  console.log("\n--- Linking USDT ---");
  try {
    const usdtConfig = [{
      onPause: false,
      tokenAddress: USDT_ADDRESS,
      syntheticTokenDecimals: 6,
      syntheticTokenAddress: ethers.constants.AddressZero,
      minBridgeAmt: ethers.utils.parseUnits("1", 6),
    }];
    
    const usdtFee = await gatewayVault.quoteLinkTokenToHub(usdtConfig, lzOptions);
    console.log(`Fee: ${ethers.utils.formatEther(usdtFee)} ETH`);
    
    const tx2 = await gatewayVault.linkTokenToHub(usdtConfig, lzOptions, {
      value: usdtFee.mul(150).div(100),
      gasLimit: 600000,
    });
    console.log(`TX: ${tx2.hash}`);
    await tx2.wait();
    console.log("✓ USDT linked!");
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
    
    const tx3 = await gatewayVault.linkTokenToHub(usdcConfig, lzOptions, {
      value: usdcFee.mul(150).div(100),
      gasLimit: 600000,
    });
    console.log(`TX: ${tx3.hash}`);
    await tx3.wait();
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


