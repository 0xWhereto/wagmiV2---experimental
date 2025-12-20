import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const OLD_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const SUSDC = "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B";
const USER = "0x4151E05ABe56192e2A6775612C2020509Fd50637";

async function main() {
  console.log("=== INVESTIGATING DEPOSITS ===\n");
  
  const sonicProvider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");
  const arbProvider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  // Check sUSDC total supply and user balance
  const sUSDCAbi = [
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
  ];
  const sUSDC = new ethers.Contract(SUSDC, sUSDCAbi, sonicProvider);
  
  const totalSupply = await sUSDC.totalSupply();
  const userBalance = await sUSDC.balanceOf(USER);
  const hubBalance = await sUSDC.balanceOf(HUB);
  
  console.log("=== sUSDC Status ===");
  console.log(`Total supply: ${ethers.utils.formatUnits(totalSupply, 6)} sUSDC`);
  console.log(`User balance: ${ethers.utils.formatUnits(userBalance, 6)} sUSDC`);
  console.log(`Hub balance: ${ethers.utils.formatUnits(hubBalance, 6)} sUSDC`);
  
  // Check Gateway USDC balance
  const usdcAbi = ["function balanceOf(address) view returns (uint256)"];
  const usdcArb = new ethers.Contract("0xaf88d065e77c8cC2239327C5EDb3A432268e5831", usdcAbi, arbProvider);
  const gatewayBalance = await usdcArb.balanceOf(OLD_GATEWAY);
  
  console.log(`\n=== USDC on Gateway ===`);
  console.log(`Gateway USDC: ${ethers.utils.formatUnits(gatewayBalance, 6)} USDC`);
  
  const mismatch = gatewayBalance.sub(totalSupply);
  console.log(`\n=== Mismatch ===`);
  console.log(`USDC in Gateway - sUSDC supply = ${ethers.utils.formatUnits(mismatch, 6)}`);
  
  if (mismatch.gt(0)) {
    console.log(`\n⚠️ ${ethers.utils.formatUnits(mismatch, 6)} USDC is locked without corresponding sUSDC`);
  }
  
  // Check Hub events for deposits
  console.log("\n=== Recent Hub Events ===");
  
  // Get latest blocks
  const latestBlock = await sonicProvider.getBlockNumber();
  console.log(`Latest block: ${latestBlock}`);
  
  // Try to find Transfer events for sUSDC minting (from address(0))
  const transferTopic = ethers.utils.id("Transfer(address,address,uint256)");
  const filter = {
    address: SUSDC,
    topics: [transferTopic],
    fromBlock: latestBlock - 50000,
    toBlock: latestBlock,
  };
  
  try {
    const logs = await sonicProvider.getLogs(filter);
    console.log(`Found ${logs.length} Transfer events for sUSDC`);
    
    // Count mints (from = 0x0)
    const mints = logs.filter(l => l.topics[1] === ethers.utils.hexZeroPad("0x", 32));
    console.log(`  Mint events (from 0x0): ${mints.length}`);
    
    // Sum total minted
    let totalMinted = ethers.BigNumber.from(0);
    for (const mint of mints) {
      totalMinted = totalMinted.add(ethers.BigNumber.from(mint.data));
    }
    console.log(`  Total minted: ${ethers.utils.formatUnits(totalMinted, 6)} sUSDC`);
  } catch (e: any) {
    console.log(`Error fetching events: ${e.message?.slice(0, 100)}`);
  }
}

main().catch(console.error);
