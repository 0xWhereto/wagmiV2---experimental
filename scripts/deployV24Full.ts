import { ethers } from "hardhat";

const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";
const POOL = "0x4ed3B3e2AD7e19124D921fE2F6956e1C62Cbf190";
const ORACLE = "0xeD77B9f54cc9ACb496916a4fED764869E927FFcb";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Deploy V24 Full Test ===\n");
  
  // Deploy fresh
  const V3LPVault = await ethers.getContractFactory("V3LPVault");
  const v3Vault = await V3LPVault.deploy(POSITION_MANAGER, POOL, { gasLimit: 4000000 });
  await v3Vault.deployed();
  await (await v3Vault.setDefaultLayers({ gasLimit: 500000 })).wait();

  const LeverageAMM = await ethers.getContractFactory("LeverageAMM");
  const leverageAMM = await LeverageAMM.deploy(SWETH, MIM, STAKING_VAULT, v3Vault.address, ORACLE, { gasLimit: 3500000 });
  await leverageAMM.deployed();

  const WToken = await ethers.getContractFactory("WToken");
  const wToken = await WToken.deploy("Wagmi Zero-IL ETH", "wETH", SWETH, leverageAMM.address, v3Vault.address, { gasLimit: 3000000 });
  await wToken.deployed();

  await (await v3Vault.setOperator(leverageAMM.address, true)).wait();
  await (await leverageAMM.setWToken(wToken.address)).wait();
  const stakingVaultContract = new ethers.Contract(STAKING_VAULT, ["function setBorrower(address, bool) external"], signer);
  await (await stakingVaultContract.setBorrower(leverageAMM.address, true)).wait();

  console.log("V3LPVault:", v3Vault.address);
  console.log("LeverageAMM:", leverageAMM.address);
  console.log("WToken:", wToken.address);

  const sweth = new ethers.Contract(SWETH, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)"
  ], signer);
  const mim = new ethers.Contract(MIM, ["function balanceOf(address) view returns (uint256)"], signer);
  
  // Deposit
  const depositAmount = ethers.utils.parseEther("0.0005");
  await (await sweth.approve(wToken.address, ethers.constants.MaxUint256)).wait();
  await (await wToken.deposit(depositAmount, 0, { gasLimit: 2000000 })).wait();
  console.log("\nDeposit SUCCESS");
  console.log("wToken balance:", ethers.utils.formatEther(await wToken.balanceOf(signer.address)));

  // Now deploy OperatorTester pointing to the SAME v3Vault
  console.log("\n--- Deploying OperatorTester for comparison ---");
  const OperatorTester = await ethers.getContractFactory("OperatorTester");
  const tester = await OperatorTester.deploy(v3Vault.address, { gasLimit: 1000000 });
  await tester.deployed();
  await (await v3Vault.setOperator(tester.address, true)).wait();
  console.log("OperatorTester:", tester.address);

  // Get state
  console.log("\n--- State before withdrawal ---");
  console.log("LeverageAMM address:", leverageAMM.address);
  console.log("LeverageAMM is operator:", await v3Vault.isOperator(leverageAMM.address));
  console.log("LeverageAMM sWETH:", ethers.utils.formatEther(await sweth.balanceOf(leverageAMM.address)));
  console.log("LeverageAMM MIM:", ethers.utils.formatEther(await mim.balanceOf(leverageAMM.address)));
  
  // Compare the actual interface calls
  console.log("\n--- Testing v3Vault.removeLiquidity interface ---");
  console.log("v3Vault.address:", v3Vault.address);
  console.log("leverageAMM.v3LPVault:", await leverageAMM.v3LPVault());
  console.log("Match:", v3Vault.address.toLowerCase() === (await leverageAMM.v3LPVault()).toLowerCase());

  // Let's check if maybe there's a reentrancy issue with nonReentrant
  // or if the interface selector is different
  console.log("\n--- Checking function selectors ---");
  const removeLiqSelector = ethers.utils.id("removeLiquidity(uint256,uint256,uint256)").slice(0, 10);
  console.log("removeLiquidity selector:", removeLiqSelector);

  // Try withdraw
  console.log("\n--- Attempting Withdrawal ---");
  const wTokenBal = await wToken.balanceOf(signer.address);
  try {
    const tx = await wToken.withdraw(wTokenBal, 0, { gasLimit: 5000000 });
    const receipt = await tx.wait();
    console.log("SUCCESS!");
    console.log("Gas used:", receipt.gasUsed.toString());
  } catch (err: any) {
    console.log("FAILED!");
    
    // Check balances after failure
    console.log("\n--- Balances after failed tx ---");
    console.log("LeverageAMM sWETH:", ethers.utils.formatEther(await sweth.balanceOf(leverageAMM.address)));
    console.log("LeverageAMM MIM:", ethers.utils.formatEther(await mim.balanceOf(leverageAMM.address)));
    console.log("V3Vault sWETH:", ethers.utils.formatEther(await sweth.balanceOf(v3Vault.address)));
    console.log("V3Vault MIM:", ethers.utils.formatEther(await mim.balanceOf(v3Vault.address)));
    
    // Now test with OperatorTester
    console.log("\n--- Testing with OperatorTester ---");
    const [a0, a1] = await v3Vault.getTotalAssets();
    console.log("V3Vault assets:", ethers.utils.formatEther(a0), "sWETH,", ethers.utils.formatEther(a1), "MIM");
    
    const tx2 = await tester.testRemoveLiquidity(10000, { gasLimit: 2000000 });
    const receipt2 = await tx2.wait();
    console.log("OperatorTester SUCCESS!");
    
    const event = receipt2.events?.find((e: any) => e.event === "RemoveLiquidityResult");
    if (event) {
      console.log("Received:", ethers.utils.formatEther(event.args.balance0), "sWETH,", ethers.utils.formatEther(event.args.balance1), "MIM");
    }
  }
}
main().catch(console.error);
