import { ethers } from "hardhat";

const V3_VAULT = "0x39a94051A61de1F7293505974F8e39A61010D9c4";
const LEVERAGE_AMM = "0x033eD8e35b5334F69c2Fc50072926F4140925973";
const WTOKEN = "0xbEd139f379B85B68f44EEd84d519d6608C090361";
const STAKING_VAULT = "0xdeF5851B6C14559c47bf7cC98BACBeC9D31eb968";
const ORACLE = "0xf50e13ec9Aa9378B61eAdB5F62EFA69E36de8335";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x9dEb5301967DD118D9F37181EB971d1136a72635";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Debug V2 Final ===\n");
  
  const leverageAMM = (await ethers.getContractFactory("LeverageAMMV2")).attach(LEVERAGE_AMM);
  const v3Vault = (await ethers.getContractFactory("V3LPVault")).attach(V3_VAULT);
  const wToken = (await ethers.getContractFactory("WToken")).attach(WTOKEN);
  const stakingVault = (await ethers.getContractFactory("MIMStakingVaultV2")).attach(STAKING_VAULT);
  
  const sweth = new ethers.Contract(SWETH, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)"
  ], signer);
  
  console.log("1. Config checks:");
  console.log("   leverageAMM.wToken:", await leverageAMM.wToken());
  console.log("   leverageAMM.underlyingIsToken0:", await leverageAMM.underlyingIsToken0());
  console.log("   v3Vault.isOperator:", await v3Vault.isOperator(LEVERAGE_AMM));
  console.log("   stakingVault.isBorrower:", await stakingVault.isBorrower(LEVERAGE_AMM));
  console.log("   stakingVault.getCash:", ethers.utils.formatEther(await stakingVault.getCash()));
  console.log("   stakingVault.utilizationRate:", ethers.utils.formatEther(await stakingVault.utilizationRate()));
  
  // Check layers
  console.log("\n2. V3 layers:");
  for (let i = 0; i < 4; i++) {
    try {
      const layer = await v3Vault.layers(i);
      console.log(`   Layer ${i}: tokenId=${layer.tokenId}, ticks=[${layer.tickLower}, ${layer.tickUpper}]`);
    } catch { break; }
  }
  
  // Try static call
  console.log("\n3. Static call deposit...");
  const depositAmount = ethers.utils.parseEther("0.0001");
  await (await sweth.approve(WTOKEN, depositAmount)).wait();
  
  try {
    await wToken.callStatic.deposit(depositAmount, 0);
    console.log("   ✓ Static call passed!");
  } catch (e: any) {
    console.log("   ✗ Static call failed");
    if (e.data) {
      console.log("   Error data:", e.data.slice(0, 20));
      
      // Decode
      const selectors: {[k:string]: string} = {
        "0xa0640723": "ExceedsMaxUtilization",
        "0xe450d38c": "ERC20InsufficientBalance",
        "0x1f2a2005": "ZeroAmount",
        "0x48c9c98e": "InvalidLayers"
      };
      const sel = e.data.slice(0, 10);
      if (selectors[sel]) {
        console.log("   Error:", selectors[sel]);
      }
    }
    console.log("   Reason:", e.reason || "none");
  }
  
  // Check amounts that would be borrowed
  console.log("\n4. Borrow calculation:");
  const price = await (new ethers.Contract(ORACLE, ["function getPrice() view returns (uint256)"], signer)).getPrice();
  const borrowNeeded = depositAmount.mul(price).div(ethers.utils.parseEther("1"));
  console.log("   Deposit:", ethers.utils.formatEther(depositAmount), "sWETH");
  console.log("   Price:", ethers.utils.formatEther(price), "MIM/sWETH");
  console.log("   Borrow needed:", ethers.utils.formatEther(borrowNeeded), "MIM");
  
  const cash = await stakingVault.getCash();
  console.log("   Available cash:", ethers.utils.formatEther(cash), "MIM");
  console.log("   Enough:", cash.gte(borrowNeeded) ? "✓ Yes" : "✗ No");
}
main().catch(console.error);
