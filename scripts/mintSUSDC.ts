import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const SUSDC = "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B";
const USER = "0x4151E05ABe56192e2A6775612C2020509Fd50637";

async function main() {
  console.log("=== MINTING sUSDC ON HUB ===\n");
  
  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);
  
  // Check current balance
  const sUSDC = await ethers.getContractAt("IERC20", SUSDC);
  const currentBalance = await sUSDC.balanceOf(USER);
  console.log(`Current sUSDC balance: ${ethers.utils.formatUnits(currentBalance, 6)} sUSDC`);
  
  // Target: 37.25 USDC on gateway, user has 7.72
  // Need to mint: 37.25 - 7.72 = 29.53 sUSDC
  const amountToMint = ethers.utils.parseUnits("29.53", 6);
  console.log(`Amount to mint: ${ethers.utils.formatUnits(amountToMint, 6)} sUSDC`);
  
  // Check if Hub can mint (owner should be Hub)
  const hubAbi = [
    "function owner() view returns (address)",
    "function mintSyntheticTokens(address _syntheticToken, address _to, uint256 _amount) external",
  ];
  
  const hub = new ethers.Contract(HUB, hubAbi, signer);
  
  const owner = await hub.owner();
  console.log(`Hub owner: ${owner}`);
  console.log(`Is signer owner: ${owner.toLowerCase() === signer.address.toLowerCase()}`);
  
  // The Hub is the owner of synthetic tokens, so we need to call mint through Hub
  // Let's check if there's a direct mint function or we need to use a different approach
  
  // Try minting via Hub
  console.log("\nMinting sUSDC...");
  try {
    const tx = await hub.mintSyntheticTokens(SUSDC, USER, amountToMint);
    console.log(`TX: ${tx.hash}`);
    await tx.wait();
    console.log("✅ Minted!");
  } catch (e: any) {
    console.log(`Mint via Hub failed: ${e.reason || e.message?.slice(0, 100)}`);
    
    // Try direct mint on synthetic token if Hub is owner
    console.log("\nTrying direct mint on sUSDC...");
    const sUSDCAbi = [
      "function mint(address to, uint256 amount) external",
      "function owner() view returns (address)",
    ];
    const sUSDCContract = new ethers.Contract(SUSDC, sUSDCAbi, signer);
    
    const tokenOwner = await sUSDCContract.owner();
    console.log(`sUSDC owner: ${tokenOwner}`);
    
    if (tokenOwner.toLowerCase() === HUB.toLowerCase()) {
      console.log("sUSDC is owned by Hub - need to mint via Hub");
      
      // Check what functions Hub has for minting
      const hubCode = await ethers.provider.getCode(HUB);
      console.log(`Hub code length: ${hubCode.length}`);
    }
  }
  
  // Check new balance
  const newBalance = await sUSDC.balanceOf(USER);
  console.log(`\nNew sUSDC balance: ${ethers.utils.formatUnits(newBalance, 6)} sUSDC`);
}

main().catch(console.error);
