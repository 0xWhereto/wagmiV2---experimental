import { ethers } from "hardhat";

const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";
const POOL = "0x4ed3B3e2AD7e19124D921fE2F6956e1C62Cbf190";
const ORACLE = "0xeD77B9f54cc9ACb496916a4fED764869E927FFcb";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Test LevAMMTester ===\n");
  
  // Deploy fresh V3LPVault
  const V3LPVault = await ethers.getContractFactory("V3LPVault");
  const v3Vault = await V3LPVault.deploy(POSITION_MANAGER, POOL, { gasLimit: 4000000 });
  await v3Vault.deployed();
  await (await v3Vault.setDefaultLayers({ gasLimit: 500000 })).wait();
  console.log("V3LPVault:", v3Vault.address);
  
  // Deploy full stack for deposit
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
  
  console.log("LeverageAMM:", leverageAMM.address);
  console.log("WToken:", wToken.address);

  // Deposit
  const sweth = new ethers.Contract(SWETH, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)"
  ], signer);
  
  await (await sweth.approve(wToken.address, ethers.constants.MaxUint256)).wait();
  await (await wToken.deposit(ethers.utils.parseEther("0.0005"), 0, { gasLimit: 2000000 })).wait();
  console.log("\nDeposit SUCCESS");

  // Deploy LevAMMTester
  const LevAMMTester = await ethers.getContractFactory("LevAMMTester");
  const tester = await LevAMMTester.deploy(v3Vault.address, MIM, true, { gasLimit: 1000000 });
  await tester.deployed();
  await (await v3Vault.setOperator(tester.address, true)).wait();
  console.log("\nLevAMMTester:", tester.address);
  console.log("Is operator:", await v3Vault.isOperator(tester.address));

  // Test
  console.log("\n--- Testing LevAMMTester (with nonReentrant) ---");
  try {
    const tx = await tester.testClosePosition({ gasLimit: 2000000 });
    const receipt = await tx.wait();
    console.log("SUCCESS! Gas used:", receipt.gasUsed.toString());
    
    const event = receipt.events?.find((e: any) => e.event === "TestResult");
    if (event) {
      console.log("amount0:", ethers.utils.formatEther(event.args.amount0));
      console.log("amount1:", ethers.utils.formatEther(event.args.amount1));
      console.log("mimBalance:", ethers.utils.formatEther(event.args.mimBalance));
      console.log("underlyingBalance:", ethers.utils.formatEther(event.args.underlyingBalance));
    }
  } catch (err: any) {
    console.log("FAILED:", err.reason || err.message);
  }
}
main().catch(console.error);
