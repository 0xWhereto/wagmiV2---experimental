import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const SUSDC = "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B";
const USER = "0x4151E05ABe56192e2A6775612C2020509Fd50637";
const AMOUNT = ethers.utils.parseUnits("30", 6); // 30 sUSDC

async function main() {
  console.log("=== ADMIN MINT sUSDC ===\n");
  
  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);
  
  // Get sUSDC contract
  const sUSDCAbi = [
    "function mint(address to, uint256 amount) external",
    "function owner() view returns (address)",
    "function transferOwnership(address newOwner) external",
    "function balanceOf(address) view returns (uint256)",
  ];
  
  const sUSDC = new ethers.Contract(SUSDC, sUSDCAbi, signer);
  
  // Check current owner
  const currentOwner = await sUSDC.owner();
  console.log(`Current sUSDC owner: ${currentOwner}`);
  
  if (currentOwner.toLowerCase() !== HUB.toLowerCase()) {
    console.log("Owner is not Hub - unexpected state");
    return;
  }
  
  // We need to call transferOwnership via the Hub
  // Check if Hub can transfer ownership of synthetic token
  const hubAbi = [
    "function owner() view returns (address)",
    "function transferSyntheticTokenOwnership(address _syntheticToken, address _newOwner) external",
  ];
  
  const hub = new ethers.Contract(HUB, hubAbi, signer);
  
  const hubOwner = await hub.owner();
  console.log(`Hub owner: ${hubOwner}`);
  console.log(`Is signer hub owner: ${hubOwner.toLowerCase() === signer.address.toLowerCase()}`);
  
  // Check user's current balance
  const balanceBefore = await sUSDC.balanceOf(USER);
  console.log(`\nUser balance before: ${ethers.utils.formatUnits(balanceBefore, 6)} sUSDC`);
  
  // Try to transfer ownership via Hub
  console.log("\nStep 1: Transferring sUSDC ownership from Hub to signer...");
  try {
    const tx1 = await hub.transferSyntheticTokenOwnership(SUSDC, signer.address);
    await tx1.wait();
    console.log("✅ Ownership transferred to signer");
  } catch (e: any) {
    console.log(`Transfer ownership failed: ${e.reason || e.message?.slice(0, 100)}`);
    console.log("\nHub doesn't have transferSyntheticTokenOwnership function.");
    console.log("Need to use a different approach...");
    return;
  }
  
  // Verify ownership
  const newOwner = await sUSDC.owner();
  console.log(`New sUSDC owner: ${newOwner}`);
  
  // Mint tokens
  console.log(`\nStep 2: Minting ${ethers.utils.formatUnits(AMOUNT, 6)} sUSDC to user...`);
  const tx2 = await sUSDC.mint(USER, AMOUNT);
  await tx2.wait();
  console.log("✅ Minted!");
  
  // Transfer ownership back to Hub
  console.log("\nStep 3: Transferring ownership back to Hub...");
  const tx3 = await sUSDC.transferOwnership(HUB);
  await tx3.wait();
  console.log("✅ Ownership returned to Hub");
  
  // Check final balance
  const balanceAfter = await sUSDC.balanceOf(USER);
  console.log(`\nUser balance after: ${ethers.utils.formatUnits(balanceAfter, 6)} sUSDC`);
}

main().catch(console.error);
