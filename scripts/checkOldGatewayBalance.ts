import { ethers } from "hardhat";

const OLD_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const TOKENS = [
  { name: "WETH", address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", decimals: 18 },
  { name: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
  { name: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
  { name: "WBTC", address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", decimals: 8 },
];

async function main() {
  console.log("=== OLD GATEWAY TOKEN BALANCES ===\n");
  
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  for (const token of TOKENS) {
    const erc20 = new ethers.Contract(
      token.address,
      ["function balanceOf(address) view returns (uint256)"],
      provider
    );
    const balance = await erc20.balanceOf(OLD_GATEWAY);
    console.log(`${token.name}: ${ethers.utils.formatUnits(balance, token.decimals)}`);
  }
}

main().catch(console.error);
