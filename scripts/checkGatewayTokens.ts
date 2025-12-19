import hardhat, { ethers } from "hardhat";

const GATEWAYS: Record<string, string> = {
  arbitrum: "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e",
  base: "0xB712543E7fB87C411AAbB10c6823cf39bbEBB4Bb",
  ethereum: "0xba36FC6568B953f691dd20754607590C59b7646a",
};

async function main() {
  const network = hardhat.network.name;
  const gatewayAddress = GATEWAYS[network];
  
  if (!gatewayAddress) {
    console.log(`Network ${network} not configured`);
    return;
  }

  const gateway = await ethers.getContractAt("GatewayVault", gatewayAddress);
  
  console.log(`\n=== ${network.toUpperCase()} Gateway ===`);
  console.log(`Address: ${gatewayAddress}`);
  
  const count = await gateway.getAvailableTokenLength();
  console.log(`Linked tokens: ${count}`);
  
  if (count.gt(0)) {
    const tokens = await gateway.getAllAvailableTokens();
    for (const t of tokens) {
      console.log(`\n  ${t.tokenSymbol}:`);
      console.log(`    Address: ${t.tokenAddress}`);
      console.log(`    Synthetic: ${t.syntheticTokenAddress}`);
      console.log(`    Paused: ${t.onPause}`);
      console.log(`    MinBridge: ${t.minBridgeAmt.toString()}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


