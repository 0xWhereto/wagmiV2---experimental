import { ethers, network } from "hardhat";

const GATEWAY_ARB = "0x527f843672C4CD7F45B126f3E1E82D60A741C609";

const SYNTHETICS = {
  sWETH: { address: "0x5E501C482952c1F2D58a4294F9A97759968c5125", decimals: 18 },
  sUSDC: { address: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B", decimals: 6 },
  sUSDT: { address: "0x72dFC771E515423E5B0CD2acf703d0F7eb30bdEa", decimals: 6 },
  sBTC: { address: "0x2F0324268031E6413280F3B5ddBc4A97639A284a", decimals: 8 },
};

const TOKENS = [
  { symbol: "WETH", address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", syntheticKey: "sWETH" as keyof typeof SYNTHETICS },
  { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", syntheticKey: "sUSDC" as keyof typeof SYNTHETICS },
  { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", syntheticKey: "sUSDT" as keyof typeof SYNTHETICS },
  { symbol: "WBTC", address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", syntheticKey: "sBTC" as keyof typeof SYNTHETICS },
];

async function main() {
  const [deployer] = await ethers.getSigners();
  
  const abi = [
    "function linkTokenToHub(tuple(bool onPause, address tokenAddress, uint8 syntheticTokenDecimals, address syntheticTokenAddress, uint256 minBridgeAmt)[] _tokensConfig, bytes _options) external payable",
  ];
  
  const gateway = new ethers.Contract(GATEWAY_ARB, abi, deployer);
  
  const tokenConfigs = TOKENS.map(t => {
    const synthetic = SYNTHETICS[t.syntheticKey];
    return {
      onPause: false,
      tokenAddress: t.address,
      syntheticTokenDecimals: synthetic.decimals,
      syntheticTokenAddress: synthetic.address,
      minBridgeAmt: t.symbol === "WBTC" ? 1000 : 
                    t.symbol === "WETH" ? ethers.utils.parseUnits("0.0001", 18) :
                    ethers.utils.parseUnits("0.1", 6),
    };
  });
  
  const lzOptions = ethers.utils.hexConcat([
    "0x0003",
    "0x01",
    "0x0011",
    "0x01",
    ethers.utils.hexZeroPad(ethers.utils.hexlify(400000), 16),
  ]);
  
  console.log("Simulating linkTokenToHub...");
  
  try {
    // Estimate gas to see error
    await gateway.estimateGas.linkTokenToHub(tokenConfigs, lzOptions, {
      value: ethers.utils.parseEther("0.003"),
    });
    console.log("Estimate passed!");
  } catch (e: any) {
    console.log("Estimate failed:");
    console.log(e.reason || e.message?.substring(0, 300));
    
    // Try static call
    try {
      await gateway.callStatic.linkTokenToHub(tokenConfigs, lzOptions, {
        value: ethers.utils.parseEther("0.003"),
      });
    } catch (e2: any) {
      console.log("\nStatic call error:");
      console.log(e2.reason || e2.message?.substring(0, 300));
    }
  }
}

main().catch(console.error);
