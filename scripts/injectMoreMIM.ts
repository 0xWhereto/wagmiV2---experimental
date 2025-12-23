import { ethers } from "hardhat";

const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const LEVERAGE_AMM = "0x8CA24d00ffcF60e9ba7F67F9d41ccA28E22dF508";
const SUSDC = "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Injecting More MIM ===\n");

  const mim = await ethers.getContractAt("IERC20", MIM);
  const susdc = await ethers.getContractAt("IERC20", SUSDC);

  // Check current balances
  let mimBalance = await mim.balanceOf(signer.address);
  const susdcBalance = await susdc.balanceOf(SUSDC);
  const ammMIM = await mim.balanceOf(LEVERAGE_AMM);
  
  console.log("My MIM balance:", ethers.utils.formatUnits(mimBalance, 18));
  console.log("My sUSDC balance:", ethers.utils.formatUnits(await susdc.balanceOf(signer.address), 6));
  console.log("LeverageAMM MIM:", ethers.utils.formatUnits(ammMIM, 18));

  // Need about 3.07 MIM more (3.12 - 0.05)
  const needed = ethers.utils.parseUnits("3.2", 18); // With buffer

  if (mimBalance.lt(needed)) {
    console.log("\nNeed to mint more MIM...");
    const toMint = ethers.utils.parseUnits("4", 6); // Mint 4 MIM
    
    // Check sUSDC
    const myUsdc = await susdc.balanceOf(signer.address);
    if (myUsdc.lt(toMint)) {
      console.log("❌ Not enough sUSDC. Have:", ethers.utils.formatUnits(myUsdc, 6));
      console.log("Need:", ethers.utils.formatUnits(toMint, 6));
      return;
    }

    // Approve and mint
    console.log("Approving sUSDC...");
    await (await susdc.approve(MIM, toMint)).wait();
    
    console.log("Minting", ethers.utils.formatUnits(toMint, 6), "MIM...");
    const mimContract = new ethers.Contract(MIM, [
      "function mintWithUSDC(uint256 amount) external returns (uint256)"
    ], signer);
    await (await mimContract.mintWithUSDC(toMint)).wait();
    
    mimBalance = await mim.balanceOf(signer.address);
    console.log("New MIM balance:", ethers.utils.formatUnits(mimBalance, 18));
  }

  // Transfer 3.1 MIM to LeverageAMM
  const toTransfer = ethers.utils.parseUnits("3.1", 18);
  console.log("\nTransferring", ethers.utils.formatUnits(toTransfer, 18), "MIM to LeverageAMM...");
  await (await mim.transfer(LEVERAGE_AMM, toTransfer)).wait();
  
  const newAmmMIM = await mim.balanceOf(LEVERAGE_AMM);
  console.log("LeverageAMM MIM now:", ethers.utils.formatUnits(newAmmMIM, 18));
}

main().catch(console.error);
