import { ethers } from "hardhat";

const USER_ADDRESS = "0x4151E05ABe56192e2A6775612C2020509Fd50637";
const SONIC_RPC = "https://rpc.soniclabs.com";

// sUSDC address on Sonic (from gateway debug output)
const SUSDC_ADDRESS = "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B";

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
];

async function main() {
  console.log("=== Checking sUSDC Balance on Sonic ===\n");
  
  const provider = new ethers.providers.JsonRpcProvider(SONIC_RPC);
  
  // Check if contract exists
  const code = await provider.getCode(SUSDC_ADDRESS);
  if (code === "0x") {
    console.log(`❌ sUSDC contract not deployed at ${SUSDC_ADDRESS}`);
    return;
  }
  
  const sUSDC = new ethers.Contract(SUSDC_ADDRESS, ERC20_ABI, provider);
  
  try {
    const name = await sUSDC.name();
    const symbol = await sUSDC.symbol();
    const decimals = await sUSDC.decimals();
    const balance = await sUSDC.balanceOf(USER_ADDRESS);
    
    console.log(`Token: ${name} (${symbol})`);
    console.log(`Address: ${SUSDC_ADDRESS}`);
    console.log(`Decimals: ${decimals}`);
    console.log(`\nUser: ${USER_ADDRESS}`);
    console.log(`Balance: ${ethers.utils.formatUnits(balance, decimals)} ${symbol}`);
    
    if (balance.gte(ethers.utils.parseUnits("2", decimals))) {
      console.log(`\n✅ SUCCESS! User has at least 2 sUSDC on Sonic!`);
    } else {
      console.log(`\n⏳ Balance is less than 2 sUSDC. LayerZero message may still be in transit.`);
      console.log(`   Check: https://layerzeroscan.com`);
    }
  } catch (e: any) {
    console.log(`Error: ${e.message?.slice(0, 100)}`);
  }
}

main().catch(console.error);


