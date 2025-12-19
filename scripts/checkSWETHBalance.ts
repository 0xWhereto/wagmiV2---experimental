import { ethers } from "hardhat";

// sWETH address from the gateway registration
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const USER = "0x4151E05ABe56192e2A6775612C2020509Fd50637";

async function main() {
  console.log("=== Checking sWETH Balance on Sonic ===\n");
  
  const sonicProvider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");
  
  const erc20Abi = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function name() view returns (string)",
  ];
  
  const sWETH = new ethers.Contract(SWETH, erc20Abi, sonicProvider);
  
  try {
    const name = await sWETH.name();
    const symbol = await sWETH.symbol();
    const decimals = await sWETH.decimals();
    const balance = await sWETH.balanceOf(USER);
    
    console.log(`Token: ${name} (${symbol})`);
    console.log(`Address: ${SWETH}`);
    console.log(`Decimals: ${decimals}`);
    console.log(`\nUser: ${USER}`);
    console.log(`Balance: ${ethers.utils.formatUnits(balance, decimals)} ${symbol}`);
    
    // $3 worth of WETH at ~$3500/ETH
    const ethPrice = 3500;
    const dollarValue = parseFloat(ethers.utils.formatUnits(balance, decimals)) * ethPrice;
    console.log(`Value: ~$${dollarValue.toFixed(2)}`);
    
    if (parseFloat(ethers.utils.formatUnits(balance, decimals)) >= 0.001) {
      console.log(`\n✅ SUCCESS! User has sWETH on Sonic!`);
    } else {
      console.log(`\n⏳ Waiting for sWETH... (message may still be in transit)`);
      console.log(`   Check: https://layerzeroscan.com`);
    }
  } catch (e: any) {
    console.log(`Error: ${e.message?.slice(0, 100)}`);
    console.log(`\nThe sWETH token may not exist yet on Sonic.`);
  }
}

main().catch(console.error);

