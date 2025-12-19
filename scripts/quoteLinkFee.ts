import { ethers } from "hardhat";

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
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  // Check if there's a quote function
  const abi = [
    "function quote(uint32 _dstEid, bytes _message, bytes _options, bool _payInLzToken) view returns (tuple(uint256 nativeFee, uint256 lzTokenFee))",
  ];
  
  const gateway = new ethers.Contract(GATEWAY_ARB, abi, provider);
  
  // Build the message that would be sent
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
  
  console.log("Getting quote...");
  
  try {
    // Encode the message as the gateway would
    const msgData = ethers.utils.defaultAbiCoder.encode(
      ["tuple(bool,address,uint8,address,uint256)[]"],
      [tokenConfigs.map(t => [t.onPause, t.tokenAddress, t.syntheticTokenDecimals, t.syntheticTokenAddress, t.minBridgeAmt])]
    );
    
    const msgType = 2; // LinkToken
    const payload = ethers.utils.defaultAbiCoder.encode(
      ["uint8", "bytes"],
      [msgType, msgData]
    );
    
    const fee = await gateway.quote(30332, payload, lzOptions, false);
    console.log(`Native fee: ${ethers.utils.formatEther(fee.nativeFee)} ETH`);
    console.log(`LZ token fee: ${ethers.utils.formatEther(fee.lzTokenFee)}`);
  } catch (e: any) {
    console.log(`Quote error: ${e.message?.substring(0, 100)}`);
    console.log("\nTrying simpler approach...");
  }
}

main().catch(console.error);
